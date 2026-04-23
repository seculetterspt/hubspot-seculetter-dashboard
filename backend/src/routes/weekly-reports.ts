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

    // Step 2: HubSpot에서 관련 활동 검색 (최근 2주)
    const relatedActivities: RelatedActivity[] = [];
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // 회사별로 활동 검색
    for (const companyName of companies.slice(0, 5)) { // 최대 5개 회사
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
              if (meetingDate >= twoWeeksAgo) {
                relatedActivities.push({
                  id: meeting.id,
                  type: 'meeting',
                  title: meeting.properties.hs_meeting_title || '(제목 없음)',
                  timestamp: meeting.properties.hs_meeting_start_time || '',
                  companyName,
                  summary: meeting.properties.hs_meeting_body?.substring(0, 200) || ''
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
              if (callDate >= twoWeeksAgo) {
                relatedActivities.push({
                  id: call.id,
                  type: 'call',
                  title: call.properties.hs_call_title || '(제목 없음)',
                  timestamp: call.properties.hs_timestamp || '',
                  companyName,
                  summary: call.properties.hs_call_body?.substring(0, 200) || ''
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
              if (noteDate >= twoWeeksAgo) {
                relatedActivities.push({
                  id: note.id,
                  type: 'note',
                  title: '메모',
                  timestamp: note.properties.hs_timestamp || '',
                  companyName,
                  summary: note.properties.hs_note_body?.substring(0, 200) || ''
                });
              }
            } catch (e) {
              // 개별 노트 조회 실패 무시
            }
          }
        } catch (e) {
          // 노트 연결 조회 실패 무시
        }

      } catch (e) {
        console.error(`Error searching activities for ${companyName}:`, e);
      }
    }

    // 중복 제거 및 시간순 정렬
    const uniqueActivities = relatedActivities
      .filter((a, i, arr) => arr.findIndex(x => x.id === a.id) === i)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10); // 최대 10개

    // Step 3: CEO 보고용 보고서 생성
    const activityContext = uniqueActivities.length > 0
      ? `\n\n[참고: HubSpot에서 발견된 관련 활동]\n${uniqueActivities.map(a =>
          `- ${a.companyName}: ${a.type === 'meeting' ? '미팅' : a.type === 'call' ? '전화' : '메모'} - ${a.title}${a.summary ? ` (${a.summary.substring(0, 100)}...)` : ''}`
        ).join('\n')}`
      : '';

    const generatePrompt = `당신은 B2B 보안 솔루션 회사 "시큐레터"의 ${teamName} 주간보고를 작성하는 담당자입니다.

아래 간략 내용을 CEO 보고용으로 전문적이고 풍성하게 작성하세요.

[간략 내용]
${briefContent}
${activityContext}

[작성 규칙]
1. 거짓말이나 과장은 절대 금지 - 입력된 내용과 HubSpot 활동 기반으로만 작성
2. CEO가 빠르게 파악할 수 있도록 핵심 위주로 간결하게
3. 각 회사별로 구분하여 작성
4. 진행 상황, 다음 단계, 예상 일정을 명확히 표기
5. 금액이나 규모가 있으면 포함
6. 한국어로 작성

[형식]
■ [회사명]
  - 현황: ...
  - 진행상황: ...
  - 다음단계: ...

(위 형식으로 각 회사별 작성)`;

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
