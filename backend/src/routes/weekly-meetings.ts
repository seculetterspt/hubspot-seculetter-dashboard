import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { hubspotClient } from '../services/hubspot/HubspotClient.js';
import { pool } from '../config/database.js';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 주간회의 아이템 인터페이스
interface WeeklyMeetingItem {
  companyName: string;
  content: string;
  matchedDeals: Array<{
    id: string;
    name: string;
    stage?: string;
    amount?: number;
  }>;
}

// ─────────────────────────────────────────────
// 주간회의 목록 조회 (최근 12주)
// ─────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.json({ meetings: [] });
    }

    const result = await pool.query(
      `SELECT id, meeting_date, created_by, raw_content, parsed_items, created_at, updated_at
       FROM weekly_meetings
       ORDER BY meeting_date DESC
       LIMIT 12`
    );

    res.json({ meetings: result.rows });
  } catch (error) {
    console.error('Error fetching weekly meetings:', error);
    res.status(500).json({ error: 'Failed to fetch weekly meetings' });
  }
});

// ─────────────────────────────────────────────
// 특정 날짜 주간회의 조회
// ─────────────────────────────────────────────
router.get('/:date', async (req: Request, res: Response) => {
  try {
    const { date } = req.params;

    if (!process.env.DATABASE_URL) {
      return res.json({ meeting: null });
    }

    const result = await pool.query(
      `SELECT id, meeting_date, created_by, raw_content, parsed_items, created_at, updated_at
       FROM weekly_meetings
       WHERE meeting_date = $1`,
      [date]
    );

    res.json({ meeting: result.rows[0] || null });
  } catch (error) {
    console.error('Error fetching weekly meeting:', error);
    res.status(500).json({ error: 'Failed to fetch weekly meeting' });
  }
});

// ─────────────────────────────────────────────
// 주간회의 내용 파싱 및 딜 매칭 (LLM 사용)
// ─────────────────────────────────────────────
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length < 10) {
      return res.status(400).json({ error: 'Content too short' });
    }

    // Step 1: LLM으로 회의 내용 파싱 (회사명 + 내용 추출)
    const parsePrompt = `다음 주간회의 내용을 분석하여 회사별로 구분하세요.
각 항목에서 회사명과 해당 내용을 추출하세요.

입력:
${content}

JSON 형식으로 응답:
{
  "items": [
    {
      "companyName": "회사명 (정확히)",
      "content": "해당 회사 관련 내용 전체 (여러 줄이면 합쳐서)"
    }
  ]
}

규칙:
- 회사명은 정확히 추출 (한국투자증권, 법무부, 비엔씨, 푸본현대생명, 한국소비자원 등)
- 내용은 해당 회사에 대한 모든 정보를 포함
- 파트너사 정보(에스이정보, 오렌지아이티, 티앤디소프트 등)도 내용에 포함`;

    const parseResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: parsePrompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 2000,
    });

    const parsed = JSON.parse(parseResponse.choices[0]?.message?.content || '{"items":[]}');
    const items: WeeklyMeetingItem[] = [];

    // Step 2: 각 회사명으로 HubSpot 딜 검색
    for (const item of parsed.items || []) {
      const companyName = item.companyName?.trim();
      if (!companyName) continue;

      let matchedDeals: Array<{ id: string; name: string; stage?: string; amount?: number }> = [];

      try {
        // 회사명으로 딜 검색
        const dealResults = await hubspotClient.searchDeals(companyName, 5);

        if (dealResults.length > 0) {
          // 딜 상세 정보 조회
          for (const deal of dealResults) {
            try {
              const dealDetail = await hubspotClient.api.crm.deals.basicApi.getById(
                deal.id,
                ['dealname', 'dealstage', 'amount', 'pipeline']
              );
              matchedDeals.push({
                id: deal.id,
                name: dealDetail.properties.dealname || deal.name,
                stage: dealDetail.properties.dealstage ?? undefined,
                amount: dealDetail.properties.amount ? parseFloat(dealDetail.properties.amount) : undefined,
              });
            } catch (e) {
              // 딜 상세 조회 실패 시 기본 정보만 사용
              matchedDeals.push({ id: deal.id, name: deal.name });
            }
          }
        }

        // 회사명으로 회사 검색 후 연결된 딜 조회
        if (matchedDeals.length === 0) {
          const companyResults = await hubspotClient.searchCompanies(companyName, 3);

          for (const company of companyResults) {
            try {
              // 회사에 연결된 딜 조회
              const dealAssoc = await hubspotClient.api.crm.associations.v4.basicApi.getPage(
                'companies',
                company.id,
                'deals',
                undefined,
                10
              );

              for (const assoc of dealAssoc.results || []) {
                try {
                  const dealDetail = await hubspotClient.api.crm.deals.basicApi.getById(
                    assoc.toObjectId,
                    ['dealname', 'dealstage', 'amount']
                  );
                  // 중복 체크
                  if (!matchedDeals.find(d => d.id === assoc.toObjectId)) {
                    matchedDeals.push({
                      id: assoc.toObjectId,
                      name: dealDetail.properties.dealname || '(거래명 없음)',
                      stage: dealDetail.properties.dealstage ?? undefined,
                      amount: dealDetail.properties.amount ? parseFloat(dealDetail.properties.amount) : undefined,
                    });
                  }
                } catch (e) {
                  // 딜 조회 실패 무시
                }
              }
            } catch (e) {
              // 연결 조회 실패 무시
            }
          }
        }
      } catch (e) {
        console.error(`Error searching deals for ${companyName}:`, e);
      }

      items.push({
        companyName,
        content: item.content || '',
        matchedDeals,
      });
    }

    res.json({ items });
  } catch (error) {
    console.error('Error parsing weekly meeting:', error);
    res.status(500).json({ error: 'Failed to parse content' });
  }
});

// ─────────────────────────────────────────────
// 주간회의 저장 (새로 생성 또는 업데이트)
// ─────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const { meetingDate, rawContent, parsedItems } = req.body;

    if (!meetingDate || !rawContent) {
      return res.status(400).json({ error: 'Meeting date and content are required' });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: 'Database not configured' });
    }

    const userEmail = req.user?.email || 'unknown';

    // 해당 날짜에 기존 기록이 있는지 확인
    const existing = await pool.query(
      'SELECT id FROM weekly_meetings WHERE meeting_date = $1',
      [meetingDate]
    );

    let result;
    if (existing.rows.length > 0) {
      // 기존 기록 업데이트
      result = await pool.query(
        `UPDATE weekly_meetings
         SET raw_content = $1, parsed_items = $2, created_by = $3, updated_at = CURRENT_TIMESTAMP
         WHERE meeting_date = $4
         RETURNING id, meeting_date, raw_content, parsed_items`,
        [rawContent, JSON.stringify(parsedItems || []), userEmail, meetingDate]
      );
    } else {
      // 새 기록 생성
      result = await pool.query(
        `INSERT INTO weekly_meetings (meeting_date, created_by, raw_content, parsed_items)
         VALUES ($1, $2, $3, $4)
         RETURNING id, meeting_date, raw_content, parsed_items`,
        [meetingDate, userEmail, rawContent, JSON.stringify(parsedItems || [])]
      );
    }

    res.json({
      success: true,
      meeting: result.rows[0],
      action: existing.rows.length > 0 ? 'updated' : 'created'
    });
  } catch (error) {
    console.error('Error saving weekly meeting:', error);
    res.status(500).json({ error: 'Failed to save weekly meeting' });
  }
});

// ─────────────────────────────────────────────
// 주간회의 삭제
// ─────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!process.env.DATABASE_URL) {
      return res.status(400).json({ error: 'Database not configured' });
    }

    const result = await pool.query(
      'DELETE FROM weekly_meetings WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Error deleting weekly meeting:', error);
    res.status(500).json({ error: 'Failed to delete weekly meeting' });
  }
});

// ─────────────────────────────────────────────
// 수동 딜 검색 (연결용)
// ─────────────────────────────────────────────
router.get('/search/deals', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || String(q).length < 2) {
      return res.json({ deals: [] });
    }

    const deals = await hubspotClient.searchDeals(String(q), 10);

    // 딜 상세 정보 조회
    const dealsWithDetails = await Promise.all(
      deals.map(async (deal) => {
        try {
          const detail = await hubspotClient.api.crm.deals.basicApi.getById(
            deal.id,
            ['dealname', 'dealstage', 'amount', 'pipeline']
          );
          return {
            id: deal.id,
            name: detail.properties.dealname || deal.name,
            stage: detail.properties.dealstage,
            amount: detail.properties.amount ? parseFloat(detail.properties.amount) : undefined,
          };
        } catch (e) {
          return { id: deal.id, name: deal.name };
        }
      })
    );

    res.json({ deals: dealsWithDetails });
  } catch (error) {
    console.error('Error searching deals:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
