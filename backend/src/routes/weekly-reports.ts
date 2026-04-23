import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { hubspotClient } from '../services/hubspot/HubspotClient.js';
import { pool } from '../config/database.js';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RelatedActivity {
  id: string;
  type: 'call' | 'note' | 'meeting' | 'email';
  title: string;
  timestamp: string;
  companyName?: string;
  summary?: string;
}

// ─────────────────────────────────────────────
// 디버그: DB 상태 확인
// ─────────────────────────────────────────────
router.get('/debug/status', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ error: 'DATABASE_URL not set' });
    }

    // 테이블 존재 확인
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'weekly_reports'
      );
    `);

    // 데이터 개수 확인
    let count = 0;
    let latestRecord = null;
    if (tableCheck.rows[0].exists) {
      const countResult = await pool.query('SELECT COUNT(*) FROM weekly_reports');
      count = parseInt(countResult.rows[0].count);

      if (count > 0) {
        const latest = await pool.query('SELECT id, report_date, team_name, created_at FROM weekly_reports ORDER BY created_at DESC LIMIT 1');
        latestRecord = latest.rows[0];
      }
    }

    res.json({
      tableExists: tableCheck.rows[0].exists,
      recordCount: count,
      latestRecord
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// 주간보고 목록 조회
// ─────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ reports: [] });
    }

    const result = await pool.query(
      `SELECT id, report_date, team_name, brief_content, generated_content,
              related_activities, created_by, created_at, updated_at
       FROM weekly_reports
       ORDER BY report_date DESC
       LIMIT 50`
    );

    res.json({ reports: result.rows });
  } catch (error) {
    console.error('Error fetching weekly reports:', error);
    res.status(500).json({ error: 'Failed to fetch weekly reports' });
  }
});

// ─────────────────────────────────────────────
// 주간보고 상세 조회
// ─────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!process.env.DATABASE_URL) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const result = await pool.query(
      `SELECT id, report_date, team_name, brief_content, generated_content,
              related_activities, created_by, created_at, updated_at
       FROM weekly_reports
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ report: result.rows[0] });
  } catch (error) {
    console.error('Error fetching weekly report:', error);
    res.status(500).json({ error: 'Failed to fetch weekly report' });
  }
});

// ─────────────────────────────────────────────
// AI 보고서 생성 (HubSpot Activity 연동)
// ─────────────────────────────────────────────
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { reportDate, teamName, briefContent } = req.body;

    if (!briefContent || briefContent.trim().length < 5) {
      return res.status(400).json({ error: 'Content too short' });
    }

    // Step 1: 간략 내용에서 회사명/키워드 추출
    const extractPrompt = `다음 주간보고 간략 내용에서 회사명과 주요 키워드를 추출하세요.

내용:
${briefContent}

JSON 형식으로 응답:
{
  "companies": ["회사명1", "회사명2"],
  "keywords": ["POC", "시연", "계약"]
}`;

    const extractResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: extractPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    const extracted = JSON.parse(extractResponse.choices[0]?.message?.content || '{"companies":[],"keywords":[]}');
    const companies: string[] = extracted.companies || [];
    const keywords: string[] = extracted.keywords || [];

    // Step 2: HubSpot에서 관련 활동 검색 (최근 3개월)
    const relatedActivities: RelatedActivity[] = [];
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

    // 회사별로 활동 검색
    for (const companyName of companies.slice(0, 10)) { // 최대 10개 회사
      try {
        // 회사 검색
        const companyResults = await hubspotClient.searchCompanies(companyName, 1);
        if (companyResults.length === 0) continue;

        const companyId = companyResults[0].id;

        // 회사에 연결된 미팅 조회
        try {
          const meetingAssoc = await hubspotClient.api.crm.associations.v4.basicApi.getPage(
            'companies',
            companyId,
            'meetings',
            undefined,
            5
          );

          for (const assoc of meetingAssoc.results || []) {
            try {
              const meeting = await hubspotClient.api.crm.objects.basicApi.getById(
                'meetings',
                assoc.toObjectId,
                ['hs_meeting_title', 'hs_meeting_start_time', 'hs_meeting_body']
              );

              const meetingDate = new Date(meeting.properties.hs_meeting_start_time || '');
              if (meetingDate >= threeMonthsAgo) {
                relatedActivities.push({
                  id: meeting.id,
                  type: 'meeting',
                  title: meeting.properties.hs_meeting_title || '(제목 없음)',
                  timestamp: meeting.properties.hs_meeting_start_time || '',
                  companyName,
                  summary: meeting.properties.hs_meeting_body?.substring(0, 500) || ''
                });
              }
            } catch (e) {
              // 개별 미팅 조회 실패 무시
            }
          }
        } catch (e) {
          // 미팅 연결 조회 실패 무시
        }

        // 회사에 연결된 전화 조회
        try {
          const callAssoc = await hubspotClient.api.crm.associations.v4.basicApi.getPage(
            'companies',
            companyId,
            'calls',
            undefined,
            3
          );

          for (const assoc of callAssoc.results || []) {
            try {
              const call = await hubspotClient.api.crm.objects.basicApi.getById(
                'calls',
                assoc.toObjectId,
                ['hs_call_title', 'hs_timestamp', 'hs_call_body']
              );

              const callDate = new Date(call.properties.hs_timestamp || '');
              if (callDate >= threeMonthsAgo) {
                relatedActivities.push({
                  id: call.id,
                  type: 'call',
                  title: call.properties.hs_call_title || '(제목 없음)',
                  timestamp: call.properties.hs_timestamp || '',
                  companyName,
                  summary: call.properties.hs_call_body?.substring(0, 500) || ''
                });
              }
            } catch (e) {
              // 개별 전화 조회 실패 무시
            }
          }
        } catch (e) {
          // 전화 연결 조회 실패 무시
        }

        // 회사에 연결된 노트 조회
        try {
          const noteAssoc = await hubspotClient.api.crm.associations.v4.basicApi.getPage(
            'companies',
            companyId,
            'notes',
            undefined,
            3
          );

          for (const assoc of noteAssoc.results || []) {
            try {
              const note = await hubspotClient.api.crm.objects.basicApi.getById(
                'notes',
                assoc.toObjectId,
                ['hs_note_body', 'hs_timestamp']
              );

              const noteDate = new Date(note.properties.hs_timestamp || '');
              if (noteDate >= threeMonthsAgo) {
                relatedActivities.push({
                  id: note.id,
                  type: 'note',
                  title: '메모',
                  timestamp: note.properties.hs_timestamp || '',
                  companyName,
                  summary: note.properties.hs_note_body?.substring(0, 500) || ''
                });
              }
            } catch (e) {
              // 개별 노트 조회 실패 무시
            }
          }
        } catch (e) {
          // 노트 연결 조회 실패 무시
        }

        // 회사에 연결된 딜(거래) 정보 조회
        try {
          const dealAssoc = await hubspotClient.api.crm.associations.v4.basicApi.getPage(
            'companies',
            companyId,
            'deals',
            undefined,
            5
          );

          for (const assoc of dealAssoc.results || []) {
            try {
              const deal = await hubspotClient.api.crm.deals.basicApi.getById(
                assoc.toObjectId,
                ['dealname', 'amount', 'dealstage', 'closedate', 'pipeline', 'notes_last_updated']
              );

              const amount = deal.properties.amount ? parseInt(deal.properties.amount) : 0;
              const amountStr = amount >= 100000000
                ? `${(amount / 100000000).toFixed(1)}억원`
                : amount >= 10000
                  ? `${(amount / 10000).toFixed(0)}만원`
                  : amount > 0 ? `${amount.toLocaleString()}원` : '';

              relatedActivities.push({
                id: deal.id,
                type: 'note', // 딜은 note 타입으로 표시
                title: `[딜] ${deal.properties.dealname || '(거래명 없음)'}`,
                timestamp: deal.properties.notes_last_updated || deal.properties.closedate || new Date().toISOString(),
                companyName,
                summary: `금액: ${amountStr || '미정'}, 예상종료: ${deal.properties.closedate || '미정'}`
              });
            } catch (e) {
              // 개별 딜 조회 실패 무시
            }
          }
        } catch (e) {
          // 딜 연결 조회 실패 무시
        }

      } catch (e) {
        console.error(`Error searching activities for ${companyName}:`, e);
      }
    }

    // 중복 제거 및 시간순 정렬
    const uniqueActivities = relatedActivities
      .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20); // 최대 20개

    // Step 3: CEO 보고용 보고서 생성
    const activityContext = uniqueActivities.length > 0
      ? `\n\n[중요: HubSpot CRM에서 찾은 실제 활동 기록 - 반드시 보고서에 반영할 것]\n${uniqueActivities.map(a =>
          `■ ${a.companyName} (${a.type === 'meeting' ? '미팅' : a.type === 'call' ? '전화' : '메모'})
  제목: ${a.title}
  내용: ${a.summary || '(내용 없음)'}`
        ).join('\n\n')}`
      : '';

    const generatePrompt = `당신은 B2B 보안 솔루션 회사 "시큐레터"의 ${teamName} 주간보고를 작성하는 담당자입니다.

[사용자 입력 - 간략 내용]
${briefContent}
${activityContext}

[핵심 지시]
1. 사용자가 입력한 간략 내용을 기반으로 작성
2. **HubSpot 활동 기록이 있으면 해당 내용을 반드시 보고서에 추가** (미팅 내용, 논의 사항, 합의 내용 등)
3. HubSpot 활동에서 발견된 구체적인 정보(금액, 일정, 담당자, 기술 세부사항 등)를 보고서에 포함

[작성 규칙]
1. 거짓말이나 과장 절대 금지
2. CEO가 빠르게 스캔할 수 있도록 핵심만 간결하게
3. 각 회사별 ### 제목, 각 내용은 개별 불렛(-)으로
4. 한 불렛에 한 가지 내용만 (긴 문장은 여러 불렛으로 분리)
5. 명사형 종결 필수 ("~완료", "~예정", "~진행 중", "~검토 중")
6. "~니다", "~습니다" 문장 종결 절대 금지
7. 버전/수치 변경은 화살표 사용 (예: 3.0.2 → 3.0.19)
8. 금액/일정이 있으면 괄호로 표기 (예: 제안서 제출 예정 (4월 중))

[형식 예시]
### 대신증권
- 시스템 패치 및 취약점 조치 완료
- 버전 업그레이드: 2.5.5.12 → 2.5.5.13
- CVE-2025-11187 취약점 조치 완료
- 시스템 안정성 모니터링 예정

### 푸본현대생명
- CDR 제품 소개 미팅 완료
- 2027년 제품 도입 검토 중
- 현 솔루션 불만족 → 시큐레터 CDR 추가 검토 중
- 제안 발표 준비 필요
- 커스터마이징 요구 대응 준비 예정`;

    const generateResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: generatePrompt }],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const generatedContent = generateResponse.choices[0]?.message?.content || briefContent;

    res.json({
      content: generatedContent,
      activities: uniqueActivities
    });

  } catch (error) {
    console.error('Error generating weekly report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ─────────────────────────────────────────────
// 주간보고 저장
// ─────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { reportDate, teamName, briefContent, generatedContent, relatedActivities } = req.body;

    if (!reportDate || !teamName || !generatedContent) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: 'Database not configured' });
    }

    const userEmail = req.user?.email || 'unknown';

    const result = await pool.query(
      `INSERT INTO weekly_reports
        (report_date, team_name, brief_content, generated_content, related_activities, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, report_date, team_name, brief_content, generated_content, related_activities, created_by, created_at`,
      [
        reportDate,
        teamName,
        briefContent || '',
        generatedContent,
        JSON.stringify(relatedActivities || []),
        userEmail
      ]
    );

    res.json({
      success: true,
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving weekly report:', error);
    res.status(500).json({ error: 'Failed to save weekly report' });
  }
});

// ─────────────────────────────────────────────
// 주간보고 수정
// ─────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { generatedContent } = req.body;

    if (!generatedContent) {
      return res.status(400).json({ error: 'Content is required' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: 'Database not configured' });
    }

    const result = await pool.query(
      `UPDATE weekly_reports
       SET generated_content = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, report_date, team_name, generated_content, updated_at`,
      [generatedContent, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({
      success: true,
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating weekly report:', error);
    res.status(500).json({ error: 'Failed to update weekly report' });
  }
});

// ─────────────────────────────────────────────
// 주간보고 삭제
// ─────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: 'Database not configured' });
    }

    const result = await pool.query(
      'DELETE FROM weekly_reports WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting weekly report:', error);
    res.status(500).json({ error: 'Failed to delete weekly report' });
  }
});

export default router;
