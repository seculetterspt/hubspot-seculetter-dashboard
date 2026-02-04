import { Router, Request, Response } from 'express';
import { hubspotClient } from '../services/hubspot/HubspotClient.js';

const router = Router();

// Search companies and deals for autocomplete
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || String(q).length < 2) {
      return res.json({ companies: [], deals: [] });
    }

    const query = String(q);

    // Search companies and deals in parallel
    const [companies, deals] = await Promise.all([
      hubspotClient.searchCompanies(query, 5),
      hubspotClient.searchDeals(query, 5),
    ]);

    res.json({ companies, deals });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Create meeting log from mobile app
router.post('/log', async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      companyId,
      dealId,
      meetingType,
      outcome,
      notes,
      nextSteps,
      isImportant,
      needsFollowUp,
    } = req.body;

    // Build meeting title
    const typeLabel = meetingType === 'in_person' ? '대면미팅' :
                      meetingType === 'video' ? '화상미팅' : '전화미팅';
    const title = `[${typeLabel}] ${companyName || '(미지정)'}`;

    // Build meeting body with structured sections
    const bodyParts: string[] = [];

    if (notes) {
      bodyParts.push(`<h3>미팅 내용</h3>\n<p>${notes.replace(/\n/g, '<br/>')}</p>`);
    }

    if (nextSteps) {
      bodyParts.push(`<h3>후속 조치</h3>\n<p>${nextSteps.replace(/\n/g, '<br/>')}</p>`);
    }

    const flags: string[] = [];
    if (isImportant) flags.push('⭐ 중요 미팅');
    if (needsFollowUp) flags.push('🔄 후속조치 필요');
    if (flags.length > 0) {
      bodyParts.push(`<h3>표시</h3>\n<p>${flags.join(' | ')}</p>`);
    }

    const outcomeLabel = outcome === 'positive' ? '긍정적' :
                         outcome === 'neutral' ? '보통' :
                         outcome === 'negative' ? '부정적' : '미지정';
    bodyParts.push(`<p><strong>미팅 결과:</strong> ${outcomeLabel}</p>`);

    const body = bodyParts.join('\n\n');

    // Build internal notes for manager visibility
    const internalNotes: string[] = [];
    internalNotes.push(`미팅 결과: ${outcomeLabel}`);
    internalNotes.push(`미팅 유형: ${typeLabel}`);
    if (isImportant) internalNotes.push('⭐ 중요 미팅으로 표시됨');
    if (needsFollowUp) internalNotes.push('🔄 후속조치 필요');
    if (nextSteps) internalNotes.push(`후속 조치: ${nextSteps}`);

    // Create meeting in HubSpot
    const now = new Date();
    const meetingProperties: Record<string, string> = {
      hs_meeting_title: title,
      hs_meeting_body: body,
      hs_meeting_start_time: now.toISOString(),
      hs_meeting_end_time: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      hs_meeting_outcome: 'COMPLETED',
      hs_internal_meeting_notes: internalNotes.join('\n'),
      hs_timestamp: now.toISOString(),
    };

    // Set location based on meeting type
    if (meetingType === 'video') {
      meetingProperties.hs_meeting_location = '화상 미팅';
    } else if (meetingType === 'phone') {
      meetingProperties.hs_meeting_location = '전화';
    }

    const meeting = await hubspotClient.createMeeting(meetingProperties);

    // Associate with company if provided
    if (companyId) {
      try {
        await hubspotClient.associateMeetingWith('companies', meeting.id, companyId);
      } catch (e) {
        console.error('Failed to associate meeting with company:', e);
      }
    }

    // Associate with deal if provided
    if (dealId) {
      try {
        await hubspotClient.associateMeetingWith('deals', meeting.id, dealId);
      } catch (e) {
        console.error('Failed to associate meeting with deal:', e);
      }
    }

    res.json({
      success: true,
      meetingId: meeting.id,
      message: 'Meeting logged successfully',
    });
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting log' });
  }
});

export default router;
