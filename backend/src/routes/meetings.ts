import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { toFile } from 'openai';
import { hubspotClient } from '../services/hubspot/HubspotClient.js';
import { pool } from '../config/database.js';
import { transcribeLimiter, structureLimiter, saveLimiter } from '../middleware/rateLimit.js';
import auditService from '../services/audit.js';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 시큐레터 영업팀 이메일 목록 (config)
const SALES_TEAM_EMAILS = [
  'dongjin.jung@seculetter.com',
  'jinwoo.han@seculetter.com',
  'suu.shin@seculetter.com',
  'yebin.jo@seculetter.com',
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─────────────────────────────────────────────
// Step 1: 작성자 목록 조회
// ─────────────────────────────────────────────
router.get('/owners', async (req: Request, res: Response) => {
  try {
    const ownersResponse = await hubspotClient.getOwners();
    const teamOwners = ownersResponse.results
      .filter((o: any) => SALES_TEAM_EMAILS.includes(o.email?.toLowerCase()))
      .map((o: any) => ({
        id: o.id,
        name: `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email,
        email: o.email,
      }));

    res.json({ owners: teamOwners });
  } catch (error) {
    console.error('Error fetching owners:', error);
    res.status(500).json({ error: 'Failed to fetch owners' });
  }
});

// ─────────────────────────────────────────────
// Step 2: 예정/완료 미팅 목록 (±3일)
// ─────────────────────────────────────────────
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const { ownerId, days = '3', myOnly } = req.query;
    const dayRange = parseInt(days as string) || 3;

    const now = new Date();
    const from = new Date(now.getTime() - dayRange * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + dayRange * 24 * 60 * 60 * 1000);

    const meetingsRes = await hubspotClient.getMeetings(100);

    const filtered = meetingsRes.results.filter((m: any) => {
      const startTime = m.properties.hs_meeting_start_time
        ? new Date(m.properties.hs_meeting_start_time) : null;
      if (!startTime || startTime < from || startTime > to) return false;
      // myOnly=true일 때만 owner 필터 적용
      if (myOnly === 'true' && ownerId && m.properties.hubspot_owner_id !== ownerId) return false;
      return true;
    });

    filtered.sort((a: any, b: any) => {
      return new Date(b.properties.hs_meeting_start_time).getTime() -
             new Date(a.properties.hs_meeting_start_time).getTime();
    });

    // 각 미팅의 연결 정보(회사/거래/연락처) 조회
    const batchSize = 3;
    const meetingsWithAssoc: any[] = [];

    for (let i = 0; i < filtered.length; i += batchSize) {
      const batch = filtered.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (m: any) => {
          let associations: any = { companies: [], contacts: [], deals: [] };
          try {
            associations = await hubspotClient.getActivityAssociations('meetings', m.id);
          } catch (e) {
            // association 조회 실패는 무시
          }
          return {
            id: m.id,
            title: m.properties.hs_meeting_title || '(제목 없음)',
            startTime: m.properties.hs_meeting_start_time,
            endTime: m.properties.hs_meeting_end_time,
            outcome: m.properties.hs_meeting_outcome,
            location: m.properties.hs_meeting_location,
            body: m.properties.hs_meeting_body,
            associations,
          };
        })
      );
      meetingsWithAssoc.push(...results);
      if (i + batchSize < filtered.length) await delay(300);
    }

    // 날짜별 그룹화
    const groupedByDate: Record<string, any[]> = {};
    meetingsWithAssoc.forEach((m: any) => {
      const date = new Date(m.startTime).toISOString().split('T')[0];
      if (!groupedByDate[date]) groupedByDate[date] = [];
      groupedByDate[date].push(m);
    });

    res.json({ meetings: groupedByDate });
  } catch (error) {
    console.error('Error fetching scheduled meetings:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled meetings' });
  }
});

// ─────────────────────────────────────────────
// Step 4: 음성 → 텍스트 변환 (OpenAI Whisper)
// ─────────────────────────────────────────────
router.post('/transcribe', transcribeLimiter, async (req: Request, res: Response) => {
  try {
    const { audio, mimeType } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'No audio data provided' });
    }

    // base64 디코딩
    const base64Data = audio.includes(',') ? audio.split(',')[1] : audio;
    const buffer = Buffer.from(base64Data, 'base64');

    const ext = (mimeType || 'audio/webm').includes('mp4') ? 'mp4' : 'webm';
    const file = await toFile(buffer, `recording.${ext}`, { type: mimeType || 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'ko',
    });

    const transcript = transcription.text || '';
    const isEmpty = transcript.trim().length < 10;

    res.json({ transcript, isEmpty });
  } catch (error) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// ─────────────────────────────────────────────
// Step 5: 트랜스크립트 → LLM 구조화
// ─────────────────────────────────────────────
router.post('/structure', structureLimiter, async (req: Request, res: Response) => {
  try {
    const { transcript, meetingContext, clarificationAnswers, manualMemo } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'No transcript provided' });
    }

    const contextInfo = meetingContext
      ? `회사: ${meetingContext.companyName || '미정'}\n거래: ${meetingContext.dealName || '미정'}\n연락처: ${meetingContext.contactName || '미정'}`
      : '';

    const answersInfo = clarificationAnswers?.length > 0
      ? `\n\n[이전 질문에 대한 답변]\n${clarificationAnswers.map((a: any) => `Q: ${a.question}\nA: ${a.answer}`).join('\n')}`
      : '';

    const memoInfo = manualMemo
      ? `\n\n[작성자 추가 메모 - 높은 신뢰도]\n${manualMemo}`
      : '';

    const systemPrompt = `당신은 B2B 보안솔루션(SecuLetter) 영업 미팅 내용을 구조화하는 전문 비서입니다.
음성 녹음을 텍스트로 변환한 내용을 분석하여 아래 JSON 형식으로 정리하세요.

중요 규칙:
- 녹음 내용에 없는 정보를 절대 만들어내지 마세요 (hallucination 금지)
- 확실하지 않거나 누락된 정보는 clarification_questions에 질문으로 추가하세요
- 질문은 예/아니오로 답할 수 있는 형태를 우선하세요
- meeting_outcome은 녹음 톤과 내용을 기반으로 LLM이 판단하세요
- action_items에는 반드시 담당자와 기한을 포함하세요 (모르면 '미정')
- summary_one_liner는 타임라인 카드에 표시될 핵심 1줄 (20자 내외)
- detail_markdown은 HubSpot CRM 노트 본문용. 아래 형식을 엄격히 따르세요
- 이모지, 특수 장식 문자 절대 사용 금지
- 한국어로 작성하세요

detail_markdown 형식 (반드시 이 구조로 작성):
미팅 목적
- 내용

주요 논의
- 항목 1
- 항목 2

고객 니즈 / Pain Point
- 항목 1

제안 솔루션
- 내용

결정 사항
- 내용

액션 아이템
- 할 일 (담당자 / 기한)

다음 단계
- 내용

반드시 아래 JSON 형식으로만 응답하세요:
{
  "summary_one_liner": "타임라인 카드용 1줄 요약",
  "meeting_purpose": "미팅 목적",
  "key_discussions": "주요 논의 내용 (마크다운 리스트)",
  "customer_needs": "고객 니즈 / Pain Point",
  "proposed_solution": "제안한 솔루션",
  "decisions": "결정 사항",
  "action_items": [
    { "task": "할 일", "assignee": "담당자", "deadline": "기한 (YYYY-MM-DD 또는 '미정')" }
  ],
  "next_steps": "다음 단계",
  "detail_markdown": "미팅 목적\\n- ...\\n\\n주요 논의\\n- ...\\n\\n고객 니즈 / Pain Point\\n- ...\\n\\n제안 솔루션\\n- ...\\n\\n결정 사항\\n- ...\\n\\n액션 아이템\\n- 할 일 (담당자 / 기한)\\n\\n다음 단계\\n- ...",
  "meeting_outcome": "positive | neutral | negative",
  "follow_up_required": true,
  "importance": false,
  "clarification_questions": [
    { "question": "질문 내용", "type": "yesno" }
  ]
}`;

    const userPrompt = `${contextInfo ? `[미팅 정보]\n${contextInfo}\n\n` : ''}[녹음 내용]\n${transcript}${memoInfo}${answersInfo}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const content = JSON.parse(response.choices[0]?.message?.content || '{}');
    res.json(content);
  } catch (error) {
    console.error('Error structuring content:', error);
    res.status(500).json({ error: 'Structuring failed' });
  }
});

// ─────────────────────────────────────────────
// Step 6: HubSpot 연결 추천
// ─────────────────────────────────────────────
router.post('/recommend', async (req: Request, res: Response) => {
  try {
    const { structuredContent, existingAssociations } = req.body;

    const existingNames = [
      ...(existingAssociations?.companies || []).map((c: any) => c.name),
      ...(existingAssociations?.contacts || []).map((c: any) => c.name),
      ...(existingAssociations?.deals || []).map((d: any) => d.name),
    ].join(', ') || '없음';

    const extractPrompt = `다음 미팅 내용에서 언급된 회사명, 사람 이름, 거래/프로젝트명을 추출하세요.
이미 연결된 항목은 제외하세요.

미팅 내용:
${structuredContent.detail_markdown || structuredContent.key_discussions}

이미 연결됨: ${existingNames}

JSON으로 응답:
{
  "companies": ["회사명"],
  "contacts": ["사람이름"],
  "deals": ["거래명"]
}`;

    const extractResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: extractPrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 500,
    });

    const extracted = JSON.parse(extractResponse.choices[0]?.message?.content || '{}');
    const recommendations: any[] = [];

    // HubSpot에서 추출된 엔티티 검색
    for (const companyName of (extracted.companies || [])) {
      const results = await hubspotClient.searchCompanies(companyName, 2);
      if (results.length > 0) {
        recommendations.push({
          type: 'company',
          id: results[0].id,
          name: results[0].name,
          reason: `미팅에서 "${companyName}" 언급됨`,
        });
      }
    }

    for (const contactName of (extracted.contacts || [])) {
      const results = await hubspotClient.searchContacts(contactName, 2);
      if (results.length > 0) {
        recommendations.push({
          type: 'contact',
          id: results[0].id,
          name: results[0].name,
          reason: `미팅에서 "${contactName}" 언급됨`,
        });
      }
    }

    for (const dealName of (extracted.deals || [])) {
      const results = await hubspotClient.searchDeals(dealName, 2);
      if (results.length > 0) {
        recommendations.push({
          type: 'deal',
          id: results[0].id,
          name: results[0].name,
          reason: `미팅에서 "${dealName}" 언급됨`,
        });
      }
    }

    res.json({ recommendations });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({ error: 'Recommendation failed' });
  }
});

// ─────────────────────────────────────────────
// Step 7: 최종 저장 (HubSpot 미팅 생성/업데이트)
// ─────────────────────────────────────────────
router.post('/save', saveLimiter, async (req: Request, res: Response) => {
  try {
    const { structuredContent, associations, meetingId, ownerId } = req.body;

    if (!structuredContent) {
      return res.status(400).json({ error: 'No structured content provided' });
    }

    // 마크다운 텍스트를 HubSpot HTML로 변환
    const toHubspotHtml = (text: string): string => {
      return text
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '<br>';
          // 섹션 헤더 (불릿 아닌 줄) → 볼드 처리
          if (!trimmed.startsWith('- ') && !trimmed.startsWith('[')) {
            return `<strong>${trimmed}</strong>`;
          }
          return trimmed;
        })
        .join('<br>');
    };

    // HubSpot 노트 본문 구성 (clean, professional, no emojis)
    const bodyMarkdown = structuredContent.detail_markdown || [
      structuredContent.meeting_purpose ? `미팅 목적\n- ${structuredContent.meeting_purpose}` : '',
      structuredContent.key_discussions ? `주요 논의\n${structuredContent.key_discussions}` : '',
      structuredContent.customer_needs ? `고객 니즈 / Pain Point\n- ${structuredContent.customer_needs}` : '',
      structuredContent.proposed_solution ? `제안 솔루션\n- ${structuredContent.proposed_solution}` : '',
      structuredContent.decisions ? `결정 사항\n- ${structuredContent.decisions}` : '',
      structuredContent.action_items?.length > 0
        ? `액션 아이템\n${structuredContent.action_items.map((a: any) => `- ${a.task} (${a.assignee} / ${a.deadline})`).join('\n')}`
        : '',
      structuredContent.next_steps ? `다음 단계\n- ${structuredContent.next_steps}` : '',
    ].filter(Boolean).join('\n\n');

    const bodyHtml = toHubspotHtml(bodyMarkdown);

    const outcomeLabel = structuredContent.meeting_outcome === 'positive' ? '긍정적' :
                         structuredContent.meeting_outcome === 'negative' ? '부정적' : '보통';

    // 내부 노트 (매니저 가시성, no emojis)
    const internalNotesMarkdown = [
      `[1줄 요약] ${structuredContent.summary_one_liner}`,
      `[미팅 결과] ${outcomeLabel}`,
      structuredContent.follow_up_required ? '[후속조치 필요]' : '',
      structuredContent.importance ? '[중요 미팅]' : '',
      structuredContent.action_items?.length > 0
        ? `[액션 아이템]\n${structuredContent.action_items.map((a: any) => `- ${a.task} (${a.assignee} / ${a.deadline})`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n');

    const internalNotesHtml = toHubspotHtml(internalNotesMarkdown);

    let resultMeetingId: string;

    if (meetingId) {
      // 기존 미팅 업데이트 - 기존 본문 보존 후 뒤에 추가
      let finalBody = bodyHtml;
      let finalNotes = internalNotesHtml;

      try {
        const existing = await hubspotClient.getMeetingById(meetingId);
        const existingBody = existing.properties.hs_meeting_body?.trim() || '';
        const existingNotes = existing.properties.hs_internal_meeting_notes?.trim() || '';

        if (existingBody) {
          finalBody = existingBody + '<br><br><hr><br><strong>[AI 미팅 기록]</strong><br>' + bodyHtml;
        }
        if (existingNotes) {
          finalNotes = existingNotes + '<br><br>---<br>' + internalNotesHtml;
        }
      } catch (fetchErr: any) {
        console.warn(`[Save] Could not fetch existing meeting ${meetingId}:`, fetchErr.message);
        // 기존 미팅 조회 실패 시 새 본문만 저장
      }

      await hubspotClient.updateMeeting(meetingId, {
        hs_meeting_body: finalBody,
        hs_meeting_outcome: 'COMPLETED',
        hs_internal_meeting_notes: finalNotes,
      });
      resultMeetingId = meetingId;
    } else {
      // 새 미팅 생성
      const now = new Date();
      const meeting = await hubspotClient.createMeeting({
        hs_meeting_title: structuredContent.summary_one_liner || '미팅 기록',
        hs_meeting_body: bodyHtml,
        hs_meeting_start_time: now.toISOString(),
        hs_meeting_end_time: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
        hs_meeting_outcome: 'COMPLETED',
        hs_internal_meeting_notes: internalNotesHtml,
        hs_timestamp: now.toISOString(),
        ...(ownerId ? { hubspot_owner_id: ownerId } : {}),
      });
      resultMeetingId = meeting.id;
    }

    // 연결 생성 (기존 + 새로 추가된 것 모두)
    const allAssociations = associations || { companies: [], contacts: [], deals: [] };
    const associationErrors: string[] = [];

    console.log(`[Save] Meeting ${resultMeetingId} - Associations to create:`,
      `companies=${(allAssociations.companies || []).length}`,
      `deals=${(allAssociations.deals || []).length}`,
      `contacts=${(allAssociations.contacts || []).length}`);

    for (const company of allAssociations.companies || []) {
      try {
        console.log(`[Save] Associating meeting ${resultMeetingId} → company ${company.id} (${company.name})`);
        await hubspotClient.associateMeetingWith('companies', resultMeetingId, company.id);
        console.log(`[Save] ✓ company ${company.id} associated`);
      } catch (e: any) {
        const msg = `company ${company.id} (${company.name}): ${e.body?.message || e.message || 'unknown error'}`;
        console.error(`[Save] ✗ ${msg}`);
        associationErrors.push(msg);
      }
    }
    for (const deal of allAssociations.deals || []) {
      try {
        console.log(`[Save] Associating meeting ${resultMeetingId} → deal ${deal.id} (${deal.name})`);
        await hubspotClient.associateMeetingWith('deals', resultMeetingId, deal.id);
        console.log(`[Save] ✓ deal ${deal.id} associated`);
      } catch (e: any) {
        const msg = `deal ${deal.id} (${deal.name}): ${e.body?.message || e.message || 'unknown error'}`;
        console.error(`[Save] ✗ ${msg}`);
        associationErrors.push(msg);
      }
    }
    for (const contact of allAssociations.contacts || []) {
      try {
        console.log(`[Save] Associating meeting ${resultMeetingId} → contact ${contact.id} (${contact.name})`);
        await hubspotClient.associateMeetingWith('contacts', resultMeetingId, contact.id);
        console.log(`[Save] ✓ contact ${contact.id} associated`);
      } catch (e: any) {
        const msg = `contact ${contact.id} (${contact.name}): ${e.body?.message || e.message || 'unknown error'}`;
        console.error(`[Save] ✗ ${msg}`);
        associationErrors.push(msg);
      }
    }

    if (associationErrors.length > 0) {
      console.warn(`[Save] Meeting ${resultMeetingId} saved but ${associationErrors.length} association(s) failed`);
    }

    // Audit logging for write operation
    try {
      const userEmail = req.user?.email || 'unknown';
      await auditService.log({
        timestamp: new Date(),
        userEmail,
        actionType: meetingId ? 'update_meeting' : 'create_meeting',
        targetId: resultMeetingId,
        targetType: 'meeting',
        status: 'success',
        metadata: {
          summary: structuredContent.summary_one_liner || '',
          companiesCount: (allAssociations.companies || []).length,
          dealsCount: (allAssociations.deals || []).length,
          contactsCount: (allAssociations.contacts || []).length,
          associationErrors: associationErrors.length,
        },
      });
    } catch (auditErr: any) {
      console.error('[Save] Audit logging failed:', auditErr.message);
      // Don't throw - audit failure shouldn't block the response
    }

    // 로컬 DB에 미팅 기록 저장 (추적용)
    try {
      if (process.env.DATABASE_URL) {
        await pool.query(
          `INSERT INTO meeting_records
            (owner_id, owner_name, hubspot_meeting_id, is_new_meeting, summary, structured_content, associations, hubspot_status, association_errors)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            ownerId || null,
            req.body.ownerName || null,
            resultMeetingId,
            !meetingId,
            structuredContent.summary_one_liner || '',
            JSON.stringify(structuredContent),
            JSON.stringify(allAssociations),
            'saved',
            JSON.stringify(associationErrors),
          ]
        );
      }
    } catch (dbErr: any) {
      console.error('[Save] Local DB insert failed:', dbErr.message);
    }

    res.json({
      success: true,
      meetingId: resultMeetingId,
      action: meetingId ? 'updated' : 'created',
      associationErrors: associationErrors.length > 0 ? associationErrors : undefined,
    });
  } catch (error) {
    console.error('Error saving meeting:', error);

    // Audit logging for failure
    try {
      const userEmail = req.user?.email || 'unknown';
      await auditService.log({
        timestamp: new Date(),
        userEmail,
        actionType: 'save_meeting',
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    } catch (auditErr: any) {
      console.error('[Save] Audit logging failed:', auditErr.message);
    }

    res.status(500).json({ error: 'Failed to save meeting' });
  }
});

// ─────────────────────────────────────────────
// 회사/거래 검색 (기존 유지)
// ─────────────────────────────────────────────
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || String(q).length < 2) {
      return res.json({ companies: [], contacts: [], deals: [] });
    }
    const query = String(q);
    const [companies, contacts, deals] = await Promise.all([
      hubspotClient.searchCompanies(query, 5),
      hubspotClient.searchContacts(query, 5),
      hubspotClient.searchDeals(query, 5),
    ]);
    res.json({ companies, contacts, deals });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─────────────────────────────────────────────
// 미팅 기록 목록 조회 (로컬 DB)
// ─────────────────────────────────────────────
router.get('/records', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ records: [] });
    }
    const result = await pool.query(
      `SELECT id, owner_id, owner_name, hubspot_meeting_id, is_new_meeting,
              summary, associations, hubspot_status, hubspot_error,
              association_errors, created_at
       FROM meeting_records
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json({ records: result.rows });
  } catch (error) {
    console.error('Error fetching meeting records:', error);
    res.status(500).json({ error: 'Failed to fetch records' });
  }
});

// ─────────────────────────────────────────────
// 미팅 기록 삭제 (로컬 DB만, HubSpot은 삭제하지 않음)
// ─────────────────────────────────────────────
router.delete('/records/:id', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: 'Database not configured' });
    }
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM meeting_records WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting meeting record:', error);
    res.status(500).json({ error: 'Failed to delete record' });
  }
});

export default router;
