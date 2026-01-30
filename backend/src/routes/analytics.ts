import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { dailySnapshotService } from '../services/analytics/DailySnapshot.js';
import { hubspotClient } from '../services/hubspot/HubspotClient.js';
import { summaryService } from '../services/openai/SummaryService.js';

const router = Router();

// 최근 24시간 활동 내역 (KST 기준)
router.get('/recent-activities', async (req: Request, res: Response) => {
  const now = new Date();

  // 24시간 전 (UTC 기준 - HubSpot API는 UTC 사용)
  const utc24hAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

  let calls: any[] = [];
  let notes: any[] = [];
  let meetings: any[] = [];
  let emails: any[] = [];

  // 전화 (Calls) - 최근 24시간 내 발생한 통화
  try {
    const callsRes = await hubspotClient.getCalls(100);
    calls = callsRes.results
      .filter(c => {
        const timestamp = c.properties.hs_timestamp ? new Date(c.properties.hs_timestamp) : null;
        // 과거 24시간 내 통화만 (미래 제외)
        return timestamp && timestamp >= utc24hAgo && timestamp <= now;
      })
      .map(c => ({
        id: c.id,
        title: c.properties.hs_call_title || '(제목 없음)',
        body: c.properties.hs_call_body || '-',
        duration: c.properties.hs_call_duration ? Math.round(Number(c.properties.hs_call_duration) / 1000) : 0,
        status: c.properties.hs_call_status || '-',
        direction: c.properties.hs_call_direction || '-',
        disposition: c.properties.hs_call_disposition || '-',
        timestamp: c.properties.hs_timestamp
      }))
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } catch (error) {
    console.error('Error fetching calls:', error);
  }

  // 메모 (Notes) - 최근 24시간 내 작성된 메모
  try {
    const notesRes = await hubspotClient.getNotes(100);
    notes = notesRes.results
      .filter(n => {
        const timestamp = n.properties.hs_timestamp ? new Date(n.properties.hs_timestamp) : null;
        return timestamp && timestamp >= utc24hAgo && timestamp <= now;
      })
      .map(n => ({
        id: n.id,
        body: n.properties.hs_note_body || '(내용 없음)',
        timestamp: n.properties.hs_timestamp
      }))
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } catch (error) {
    console.error('Error fetching notes:', error);
  }

  // 미팅 (Meetings) - 최근 24시간 내 시작된 미팅 (과거만, 미래 예정 제외)
  try {
    const meetingsRes = await hubspotClient.getMeetings(100);
    meetings = meetingsRes.results
      .filter(m => {
        const startTime = m.properties.hs_meeting_start_time ? new Date(m.properties.hs_meeting_start_time) : null;
        // 과거 24시간 내 시작된 미팅만 (미래 예정 일정 제외)
        return startTime && startTime >= utc24hAgo && startTime <= now;
      })
      .map(m => ({
        id: m.id,
        title: m.properties.hs_meeting_title || '(제목 없음)',
        body: m.properties.hs_meeting_body || '-',
        startTime: m.properties.hs_meeting_start_time,
        endTime: m.properties.hs_meeting_end_time,
        outcome: m.properties.hs_meeting_outcome || '-',
        location: m.properties.hs_meeting_location || '-'
      }))
      .sort((a, b) => new Date(b.startTime || 0).getTime() - new Date(a.startTime || 0).getTime());
  } catch (error) {
    console.error('Error fetching meetings:', error);
  }

  // 이메일 (Emails) - 권한 있을 경우만
  try {
    const emailsRes = await hubspotClient.api.crm.objects.basicApi.getPage(
      'emails',
      100,
      undefined,
      ['hs_email_subject', 'hs_email_text', 'hs_email_direction', 'hs_email_status', 'hs_timestamp']
    );
    emails = emailsRes.results
      .filter(e => {
        const timestamp = e.properties.hs_timestamp ? new Date(e.properties.hs_timestamp) : null;
        return timestamp && timestamp >= utc24hAgo && timestamp <= now;
      })
      .map(e => ({
        id: e.id,
        subject: e.properties.hs_email_subject || '(제목 없음)',
        body: (e.properties.hs_email_text || '').substring(0, 200),
        direction: e.properties.hs_email_direction || '-',
        status: e.properties.hs_email_status || '-',
        timestamp: e.properties.hs_timestamp
      }))
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  } catch (error) {
    console.error('Error fetching emails (scope may be missing):', error);
  }

  // 시간 범위 정보 (KST로 변환해서 표시)
  const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const kst24hAgo = new Date(utc24hAgo.getTime() + (9 * 60 * 60 * 1000));

  // 활동별 AI 요약 생성 (쿼리 파라미터로 옵션 처리)
  const includeSummaries = req.query.includeSummaries === 'true';
  let activitySummaries: Map<string, string> = new Map();

  if (includeSummaries) {
    try {
      const allActivities = [
        ...calls.map(c => ({ id: c.id, type: 'call' as const, subject: c.title, body: c.body, timestamp: c.timestamp })),
        ...notes.map(n => ({ id: n.id, type: 'note' as const, body: n.body, timestamp: n.timestamp })),
        ...meetings.map(m => ({ id: m.id, type: 'meeting' as const, subject: m.title, body: m.body, timestamp: m.startTime })),
        ...emails.map(e => ({ id: e.id, type: 'email' as const, subject: e.subject, body: e.body, timestamp: e.timestamp })),
      ];
      activitySummaries = await summaryService.summarizeIndividualActivities(allActivities);
    } catch (error) {
      console.error('Error generating activity summaries:', error);
    }
  }

  // 요약을 각 활동에 추가
  const addSummary = (items: any[], type: string) => {
    return items.map(item => ({
      ...item,
      aiSummary: activitySummaries.get(item.id) || undefined
    }));
  };

  res.json({
    timeRange: {
      from: kst24hAgo.toISOString(),
      to: kstNow.toISOString(),
      timezone: 'KST (UTC+9)'
    },
    summary: {
      calls: calls.length,
      notes: notes.length,
      meetings: meetings.length,
      emails: emails.length,
      total: calls.length + notes.length + meetings.length + emails.length
    },
    activities: {
      calls: includeSummaries ? addSummary(calls, 'call') : calls,
      notes: includeSummaries ? addSummary(notes, 'note') : notes,
      meetings: includeSummaries ? addSummary(meetings, 'meeting') : meetings,
      emails: includeSummaries ? addSummary(emails, 'email') : emails
    }
  });
});

// 활동 요약 (OpenAI LLM)
router.get('/activity-summary', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const utc24hAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));

    // 활동 데이터 수집 (과거 24시간 내 활동만)
    const activities: Array<{
      id: string;
      type: 'call' | 'note' | 'meeting' | 'email';
      subject?: string;
      body?: string;
      timestamp: string;
    }> = [];

    // 전화 (과거 24시간 내)
    try {
      const callsRes = await hubspotClient.getCalls(50);
      callsRes.results
        .filter(c => {
          const timestamp = c.properties.hs_timestamp ? new Date(c.properties.hs_timestamp) : null;
          return timestamp && timestamp >= utc24hAgo && timestamp <= now;
        })
        .forEach(c => {
          activities.push({
            id: c.id,
            type: 'call',
            subject: c.properties.hs_call_title || undefined,
            body: c.properties.hs_call_body || undefined,
            timestamp: c.properties.hs_timestamp || ''
          });
        });
    } catch (error) {
      console.error('Error fetching calls for summary:', error);
    }

    // 메모 (과거 24시간 내)
    try {
      const notesRes = await hubspotClient.getNotes(50);
      notesRes.results
        .filter(n => {
          const timestamp = n.properties.hs_timestamp ? new Date(n.properties.hs_timestamp) : null;
          return timestamp && timestamp >= utc24hAgo && timestamp <= now;
        })
        .forEach(n => {
          activities.push({
            id: n.id,
            type: 'note',
            body: n.properties.hs_note_body || undefined,
            timestamp: n.properties.hs_timestamp || ''
          });
        });
    } catch (error) {
      console.error('Error fetching notes for summary:', error);
    }

    // 미팅 (과거 24시간 내 시작된 미팅만, 미래 예정 제외)
    try {
      const meetingsRes = await hubspotClient.getMeetings(50);
      meetingsRes.results
        .filter(m => {
          const startTime = m.properties.hs_meeting_start_time ? new Date(m.properties.hs_meeting_start_time) : null;
          return startTime && startTime >= utc24hAgo && startTime <= now;
        })
        .forEach(m => {
          activities.push({
            id: m.id,
            type: 'meeting',
            subject: m.properties.hs_meeting_title || undefined,
            body: m.properties.hs_meeting_body || undefined,
            timestamp: m.properties.hs_meeting_start_time || ''
          });
        });
    } catch (error) {
      console.error('Error fetching meetings for summary:', error);
    }

    // 이메일 (과거 24시간 내)
    try {
      const emailsRes = await hubspotClient.api.crm.objects.basicApi.getPage(
        'emails',
        50,
        undefined,
        ['hs_email_subject', 'hs_email_text', 'hs_timestamp']
      );
      emailsRes.results
        .filter(e => {
          const timestamp = e.properties.hs_timestamp ? new Date(e.properties.hs_timestamp) : null;
          return timestamp && timestamp >= utc24hAgo && timestamp <= now;
        })
        .forEach(e => {
          activities.push({
            id: e.id,
            type: 'email',
            subject: e.properties.hs_email_subject || undefined,
            body: e.properties.hs_email_text || undefined,
            timestamp: e.properties.hs_timestamp || ''
          });
        });
    } catch (error) {
      console.error('Error fetching emails for summary (scope may be missing):', error);
    }

    // OpenAI로 요약 생성
    const summary = await summaryService.summarizeActivities(activities);

    res.json({
      activityCount: activities.length,
      summary,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating activity summary:', error);
    res.status(500).json({
      error: 'Failed to generate activity summary',
      summary: {
        overview: '요약 생성 중 오류가 발생했습니다.',
        keyActivities: [],
        insights: [],
        recommendations: ['잠시 후 다시 시도해주세요.']
      }
    });
  }
});

// 활동 타임라인 (날짜 범위 기반) - 회사 연결 정보 포함
router.get('/activity-timeline', async (req: Request, res: Response) => {
  try {
    const { from, to, generateSummaries } = req.query;

    // 기본값: 2주 전 ~ 2주 후
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
    const defaultTo = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    const fromDate = from ? new Date(from as string) : defaultFrom;
    const toDate = to ? new Date(to as string) : defaultTo;

    // 날짜 범위 설정 (시작일 00:00:00, 종료일 23:59:59)
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    interface ActivityItem {
      id: string;
      type: 'call' | 'note' | 'meeting' | 'email';
      title: string;
      body: string;
      timestamp: string;
      date: string;
      associations: {
        companies: { id: string; name: string }[];
        contacts: { id: string; name: string }[];
        deals: { id: string; name: string }[];
      };
      aiSummary?: string;
    }

    const activities: ActivityItem[] = [];

    // 전화 조회
    try {
      const callsRes = await hubspotClient.getCalls(200);
      const filteredCalls = callsRes.results.filter(c => {
        const timestamp = c.properties.hs_timestamp ? new Date(c.properties.hs_timestamp) : null;
        return timestamp && timestamp >= fromDate && timestamp <= toDate;
      });

      for (const call of filteredCalls) {
        const timestamp = call.properties.hs_timestamp || '';
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : '';
        const associations = await hubspotClient.getActivityAssociations('calls', call.id);

        activities.push({
          id: call.id,
          type: 'call',
          title: call.properties.hs_call_title || '(제목 없음)',
          body: call.properties.hs_call_body || '',
          timestamp,
          date,
          associations
        });
      }
    } catch (error) {
      console.error('Error fetching calls for timeline:', error);
    }

    // 메모 조회
    try {
      const notesRes = await hubspotClient.getNotes(200);
      const filteredNotes = notesRes.results.filter(n => {
        const timestamp = n.properties.hs_timestamp ? new Date(n.properties.hs_timestamp) : null;
        return timestamp && timestamp >= fromDate && timestamp <= toDate;
      });

      for (const note of filteredNotes) {
        const timestamp = note.properties.hs_timestamp || '';
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : '';
        const associations = await hubspotClient.getActivityAssociations('notes', note.id);

        activities.push({
          id: note.id,
          type: 'note',
          title: '메모',
          body: note.properties.hs_note_body || '',
          timestamp,
          date,
          associations
        });
      }
    } catch (error) {
      console.error('Error fetching notes for timeline:', error);
    }

    // 미팅 조회 (예정된 미팅 포함)
    try {
      const meetingsRes = await hubspotClient.getMeetings(200);
      const filteredMeetings = meetingsRes.results.filter(m => {
        const startTime = m.properties.hs_meeting_start_time ? new Date(m.properties.hs_meeting_start_time) : null;
        return startTime && startTime >= fromDate && startTime <= toDate;
      });

      for (const meeting of filteredMeetings) {
        const timestamp = meeting.properties.hs_meeting_start_time || '';
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : '';
        const associations = await hubspotClient.getActivityAssociations('meetings', meeting.id);

        activities.push({
          id: meeting.id,
          type: 'meeting',
          title: meeting.properties.hs_meeting_title || '(제목 없음)',
          body: meeting.properties.hs_meeting_body || '',
          timestamp,
          date,
          associations
        });
      }
    } catch (error) {
      console.error('Error fetching meetings for timeline:', error);
    }

    // 이메일 조회
    try {
      const emailsRes = await hubspotClient.api.crm.objects.basicApi.getPage(
        'emails',
        200,
        undefined,
        ['hs_email_subject', 'hs_email_text', 'hs_email_direction', 'hs_timestamp']
      );
      const filteredEmails = emailsRes.results.filter(e => {
        const timestamp = e.properties.hs_timestamp ? new Date(e.properties.hs_timestamp) : null;
        return timestamp && timestamp >= fromDate && timestamp <= toDate;
      });

      for (const email of filteredEmails) {
        const timestamp = email.properties.hs_timestamp || '';
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : '';
        const associations = await hubspotClient.getActivityAssociations('emails', email.id);

        activities.push({
          id: email.id,
          type: 'email',
          title: email.properties.hs_email_subject || '(제목 없음)',
          body: email.properties.hs_email_text || '',
          timestamp,
          date,
          associations
        });
      }
    } catch (error) {
      console.error('Error fetching emails for timeline:', error);
    }

    // AI 요약 생성
    if (generateSummaries === 'true' && activities.length > 0) {
      try {
        const activitiesForSummary = activities.map(a => ({
          id: a.id,
          type: a.type,
          title: a.title,
          body: a.body,
          timestamp: a.timestamp,
          date: a.date,
          companyName: a.associations.companies[0]?.name,
          contactName: a.associations.contacts[0]?.name,
          dealName: a.associations.deals[0]?.name,
        }));

        const summaries = await summaryService.summarizeActivitiesWithContext(activitiesForSummary);

        activities.forEach(a => {
          a.aiSummary = summaries.get(a.id);
        });
      } catch (error) {
        console.error('Error generating AI summaries:', error);
      }
    }

    // 날짜별로 그룹화
    const groupedByDate: Record<string, ActivityItem[]> = {};
    activities.forEach(a => {
      if (!groupedByDate[a.date]) {
        groupedByDate[a.date] = [];
      }
      groupedByDate[a.date].push(a);
    });

    // 각 날짜 내에서 시간순 정렬
    Object.keys(groupedByDate).forEach(date => {
      groupedByDate[date].sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    });

    // 날짜 목록 생성 (활동이 있는 날짜만)
    const dates = Object.keys(groupedByDate).sort((a, b) => a.localeCompare(b));

    res.json({
      dateRange: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0]
      },
      totalCount: activities.length,
      dates,
      activitiesByDate: groupedByDate
    });
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    res.status(500).json({ error: 'Failed to fetch activity timeline' });
  }
});

// 오늘 수정된 데이터 (오브젝트별 테이블)
router.get('/today-modified', async (req: Request, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let modifiedContacts: any[] = [];
  let modifiedCompanies: any[] = [];
  let modifiedDeals: any[] = [];
  let modifiedTickets: any[] = [];
  let todayMeetings: any[] = [];
  let todayCalls: any[] = [];
  let todayNotes: any[] = [];

  // 연락처 (개별 에러 처리)
  try {
    const contactsRes = await hubspotClient.getContacts(100);
    modifiedContacts = contactsRes.results
      .filter(c => {
        const modDate = c.properties.lastmodifieddate ? new Date(c.properties.lastmodifieddate) : null;
        return modDate && modDate >= today;
      })
      .map(c => ({
        id: c.id,
        name: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim() || '(이름 없음)',
        email: c.properties.email || '-',
        company: c.properties.company || '-',
        lifecycleStage: c.properties.lifecyclestage || '-',
        source: c.properties.hs_analytics_source || '-',
        modifiedAt: c.properties.lastmodifieddate,
        createdAt: c.properties.createdate
      }));
  } catch (error) {
    console.error('Error fetching contacts:', error);
  }

  // 회사 (개별 에러 처리)
  try {
    const companiesRes = await hubspotClient.getCompanies(100);
    modifiedCompanies = companiesRes.results
      .filter(c => {
        const modDate = c.properties.lastmodifieddate ? new Date(c.properties.lastmodifieddate) : null;
        return modDate && modDate >= today;
      })
      .map(c => ({
        id: c.id,
        name: c.properties.name || '(이름 없음)',
        domain: c.properties.domain || '-',
        industry: c.properties.industry || '-',
        employees: c.properties.numberofemployees || '-',
        modifiedAt: c.properties.lastmodifieddate,
        createdAt: c.properties.createdate
      }));
  } catch (error) {
    console.error('Error fetching companies:', error);
  }

  // 거래 (개별 에러 처리)
  try {
    const dealsRes = await hubspotClient.getDeals(100);
    modifiedDeals = dealsRes.results
      .filter(d => {
        const modDate = d.properties.hs_lastmodifieddate ? new Date(d.properties.hs_lastmodifieddate) : null;
        return modDate && modDate >= today;
      })
      .map(d => ({
        id: d.id,
        name: d.properties.dealname || '(이름 없음)',
        amount: d.properties.amount ? Number(d.properties.amount) : 0,
        stage: d.properties.dealstage || '-',
        pipeline: d.properties.pipeline || '-',
        closeDate: d.properties.closedate || '-',
        modifiedAt: d.properties.hs_lastmodifieddate,
        createdAt: d.properties.createdate
      }));
  } catch (error) {
    console.error('Error fetching deals:', error);
  }

  // 티켓 (개별 에러 처리)
  try {
    const ticketsRes = await hubspotClient.getTickets(100);
    modifiedTickets = ticketsRes.results
      .filter(t => {
        const modDate = t.properties.hs_lastmodifieddate ? new Date(t.properties.hs_lastmodifieddate) : null;
        return modDate && modDate >= today;
      })
      .map(t => ({
        id: t.id,
        subject: t.properties.subject || '(제목 없음)',
        priority: t.properties.hs_ticket_priority || '-',
        status: t.properties.hs_pipeline_stage || '-',
        modifiedAt: t.properties.hs_lastmodifieddate,
        createdAt: t.properties.createdate
      }));
  } catch (error) {
    console.error('Error fetching tickets:', error);
  }

  // 미팅 (개별 에러 처리)
  try {
    const meetingsRes = await hubspotClient.getMeetings(100);
    todayMeetings = meetingsRes.results.map(m => ({
      id: m.id,
      title: m.properties.hs_meeting_title || '(제목 없음)',
      startTime: m.properties.hs_meeting_start_time || '-',
      endTime: m.properties.hs_meeting_end_time || '-',
      outcome: m.properties.hs_meeting_outcome || '-'
    }));
  } catch (error) {
    console.error('Error fetching meetings (scope may be missing):', error);
  }

  // 통화 (개별 에러 처리)
  try {
    const callsRes = await hubspotClient.getCalls(100);
    todayCalls = callsRes.results.map(c => ({
      id: c.id,
      title: c.properties.hs_call_title || '(제목 없음)',
      duration: c.properties.hs_call_duration || '-',
      status: c.properties.hs_call_status || '-',
      timestamp: c.properties.hs_timestamp || '-'
    }));
  } catch (error) {
    console.error('Error fetching calls (scope may be missing):', error);
  }

  // 메모 (개별 에러 처리)
  try {
    const notesRes = await hubspotClient.getNotes(100);
    todayNotes = notesRes.results.map(n => ({
      id: n.id,
      body: (n.properties.hs_note_body || '').substring(0, 100) + '...',
      timestamp: n.properties.hs_timestamp || '-'
    }));
  } catch (error) {
    console.error('Error fetching notes (scope may be missing):', error);
  }

  res.json({
    date: today.toISOString().split('T')[0],
    contacts: {
      count: modifiedContacts.length,
      items: modifiedContacts
    },
    companies: {
      count: modifiedCompanies.length,
      items: modifiedCompanies
    },
    deals: {
      count: modifiedDeals.length,
      items: modifiedDeals
    },
    tickets: {
      count: modifiedTickets.length,
      items: modifiedTickets
    },
    activities: {
      meetings: { count: todayMeetings.length, items: todayMeetings },
      calls: { count: todayCalls.length, items: todayCalls },
      notes: { count: todayNotes.length, items: todayNotes }
    }
  });
});

// 어제 vs 오늘 스냅샷 비교
router.get('/daily-comparison', async (req: Request, res: Response) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  // 오늘 실제 데이터 가져오기
  let todayContacts: any[] = [];
  let todayCompanies: any[] = [];
  let todayDeals: any[] = [];
  let todayTickets: any[] = [];

  try {
    const contactsRes = await hubspotClient.getContacts(100);
    todayContacts = contactsRes.results.map(c => ({
      id: c.id,
      name: `${c.properties.firstname || ''} ${c.properties.lastname || ''}`.trim() || '(이름 없음)',
      email: c.properties.email || '-',
      company: c.properties.company || '-',
      lifecycleStage: c.properties.lifecyclestage || '-',
      source: c.properties.hs_analytics_source || '-',
      modifiedAt: c.properties.lastmodifieddate,
      createdAt: c.properties.createdate
    }));
  } catch (error) {
    console.error('Error fetching contacts:', error);
  }

  try {
    const companiesRes = await hubspotClient.getCompanies(100);
    todayCompanies = companiesRes.results.map(c => ({
      id: c.id,
      name: c.properties.name || '(이름 없음)',
      domain: c.properties.domain || '-',
      industry: c.properties.industry || '-',
      employees: c.properties.numberofemployees || '-',
      modifiedAt: c.properties.lastmodifieddate,
      createdAt: c.properties.createdate
    }));
  } catch (error) {
    console.error('Error fetching companies:', error);
  }

  try {
    const dealsRes = await hubspotClient.getDeals(100);
    todayDeals = dealsRes.results.map(d => ({
      id: d.id,
      name: d.properties.dealname || '(이름 없음)',
      amount: d.properties.amount ? Number(d.properties.amount) : 0,
      stage: d.properties.dealstage || '-',
      pipeline: d.properties.pipeline || '-',
      closeDate: d.properties.closedate || '-',
      modifiedAt: d.properties.hs_lastmodifieddate,
      createdAt: d.properties.createdate
    }));
  } catch (error) {
    console.error('Error fetching deals:', error);
  }

  try {
    const ticketsRes = await hubspotClient.getTickets(100);
    todayTickets = ticketsRes.results.map(t => ({
      id: t.id,
      subject: t.properties.subject || '(제목 없음)',
      priority: t.properties.hs_ticket_priority || '-',
      status: t.properties.hs_pipeline_stage || '-',
      modifiedAt: t.properties.hs_lastmodifieddate,
      createdAt: t.properties.createdate
    }));
  } catch (error) {
    console.error('Error fetching tickets:', error);
  }

  // 어제 스냅샷을 DB에서 조회
  let yesterdayContacts: any[] = [];
  let yesterdayCompanies: any[] = [];
  let yesterdayDeals: any[] = [];
  let yesterdayTickets: any[] = [];
  let isYesterdayRealData = false;

  const yesterdaySnapshot = await dailySnapshotService.getRawSnapshot(yesterday);

  if (yesterdaySnapshot) {
    // DB에서 실제 어제 데이터 사용
    yesterdayContacts = yesterdaySnapshot.contacts;
    yesterdayCompanies = yesterdaySnapshot.companies;
    yesterdayDeals = yesterdaySnapshot.deals;
    yesterdayTickets = yesterdaySnapshot.tickets;
    isYesterdayRealData = true;
    console.log('Using real yesterday snapshot from DB');
  } else {
    // 더미 데이터 생성 (fallback)
    console.log('No yesterday snapshot in DB, using dummy data');
    const generateYesterdayDummy = (todayData: any[]) => {
      const removedCount = Math.floor(todayData.length * 0.1);
      return todayData.slice(removedCount).map(item => ({
        ...item,
        modifiedAt: yesterday.toISOString()
      }));
    };
    yesterdayContacts = generateYesterdayDummy(todayContacts);
    yesterdayCompanies = generateYesterdayDummy(todayCompanies);
    yesterdayDeals = generateYesterdayDummy(todayDeals);
    yesterdayTickets = generateYesterdayDummy(todayTickets);
  }

  // 변화 계산 (실제 변경 감지)
  const calculateChanges = (today: any[], yesterday: any[], keyField: string = 'id') => {
    const todayMap = new Map(today.map(i => [i[keyField], i]));
    const yesterdayMap = new Map(yesterday.map(i => [i[keyField], i]));

    const added = today.filter(i => !yesterdayMap.has(i[keyField]));
    const removed = yesterday.filter(i => !todayMap.has(i[keyField]));

    // 실제 수정 감지: 같은 ID인데 modifiedAt이 다른 항목
    const modified: any[] = [];
    const unchanged: any[] = [];

    today.forEach(item => {
      const yesterdayItem = yesterdayMap.get(item[keyField]);
      if (yesterdayItem) {
        // modifiedAt 비교로 실제 수정 여부 판단
        const todayMod = item.modifiedAt || '';
        const yesterdayMod = yesterdayItem.modifiedAt || '';
        if (todayMod !== yesterdayMod) {
          modified.push({ today: item, yesterday: yesterdayItem });
        } else {
          unchanged.push(item);
        }
      }
    });

    return {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged: unchanged.length,
      addedItems: added,
      removedItems: removed,
      modifiedItems: modified
    };
  };

  res.json({
    dates: {
      today: today.toISOString().split('T')[0],
      yesterday: yesterday.toISOString().split('T')[0]
    },
    isYesterdayRealData,
    dataSource: isYesterdayRealData ? '실제 스냅샷 (DB)' : '테스트용 더미 데이터',
    summary: {
      contacts: {
        today: todayContacts.length,
        yesterday: yesterdayContacts.length,
        change: todayContacts.length - yesterdayContacts.length,
        changePercent: yesterdayContacts.length > 0
          ? ((todayContacts.length - yesterdayContacts.length) / yesterdayContacts.length * 100).toFixed(1)
          : '0'
      },
      companies: {
        today: todayCompanies.length,
        yesterday: yesterdayCompanies.length,
        change: todayCompanies.length - yesterdayCompanies.length,
        changePercent: yesterdayCompanies.length > 0
          ? ((todayCompanies.length - yesterdayCompanies.length) / yesterdayCompanies.length * 100).toFixed(1)
          : '0'
      },
      deals: {
        today: todayDeals.length,
        yesterday: yesterdayDeals.length,
        change: todayDeals.length - yesterdayDeals.length,
        changePercent: yesterdayDeals.length > 0
          ? ((todayDeals.length - yesterdayDeals.length) / yesterdayDeals.length * 100).toFixed(1)
          : '0',
        todayValue: todayDeals.reduce((sum, d) => sum + (d.amount || 0), 0),
        yesterdayValue: yesterdayDeals.reduce((sum, d) => sum + (d.amount || 0), 0)
      },
      tickets: {
        today: todayTickets.length,
        yesterday: yesterdayTickets.length,
        change: todayTickets.length - yesterdayTickets.length,
        changePercent: yesterdayTickets.length > 0
          ? ((todayTickets.length - yesterdayTickets.length) / yesterdayTickets.length * 100).toFixed(1)
          : '0'
      }
    },
    details: {
      contacts: calculateChanges(todayContacts, yesterdayContacts),
      companies: calculateChanges(todayCompanies, yesterdayCompanies),
      deals: calculateChanges(todayDeals, yesterdayDeals),
      tickets: calculateChanges(todayTickets, yesterdayTickets)
    },
    data: {
      today: {
        contacts: todayContacts,
        companies: todayCompanies,
        deals: todayDeals,
        tickets: todayTickets
      },
      yesterday: {
        contacts: yesterdayContacts,
        companies: yesterdayCompanies,
        deals: yesterdayDeals,
        tickets: yesterdayTickets
      }
    }
  });
});

// 오버뷰 KPI 데이터
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const snapshot = await dailySnapshotService.generateSnapshot();

    // Get yesterday's data for comparison
    const yesterdayResult = await pool.query(`
      SELECT * FROM daily_deals_snapshot WHERE snapshot_date = CURRENT_DATE - 1
    `).catch(() => ({ rows: [] }));

    const yesterday = yesterdayResult.rows[0] || {};

    const overview = {
      kpi: {
        newContactsToday: snapshot.contacts.created,
        newContactsChange: 15, // percentage change from yesterday
        activeDeals: snapshot.deals.totalActive,
        pipelineValue: snapshot.deals.pipelineValue,
        dealsWonMonth: snapshot.deals.won,
        dealsWonValue: snapshot.deals.wonValue,
        openTickets: snapshot.tickets.totalOpen,
        stalledDeals: snapshot.deals.stalledCount
      },
      trends: {
        contacts: snapshot.contacts,
        deals: snapshot.deals,
        tickets: snapshot.tickets,
        activities: snapshot.activities
      }
    };

    res.json(overview);
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: 'Failed to fetch overview data' });
  }
});

// 일별/주별/월별 트렌드 데이터
router.get('/trends', async (req: Request, res: Response) => {
  const { period = 'daily', range = 30 } = req.query;

  try {
    // For demo, generate sample trend data
    const trendData = generateTrendData(Number(range));
    res.json(trendData);
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

// 파이프라인 현황
router.get('/pipeline', async (req: Request, res: Response) => {
  try {
    const snapshot = await dailySnapshotService.generateSnapshot();

    const pipeline = {
      stages: [
        { id: 'lead', name: '리드', count: 15, value: 750000000, color: '#94A3B8' },
        { id: 'needs', name: '니즈파악', count: 12, value: 620000000, color: '#60A5FA' },
        { id: 'proposal', name: '제안', count: 18, value: 1200000000, color: '#34D399' },
        { id: 'poc', name: 'POC/BMT', count: 10, value: 980000000, color: '#A78BFA' },
        { id: 'negotiation', name: '협상', count: 8, value: 850000000, color: '#FBBF24' },
        { id: 'contract', name: '계약', count: 4, value: 450000000, color: '#10B981' }
      ],
      totalValue: snapshot.deals.pipelineValue,
      totalCount: snapshot.deals.totalActive,
      conversionRates: {
        'lead_to_needs': 80,
        'needs_to_proposal': 75,
        'proposal_to_poc': 56,
        'poc_to_negotiation': 80,
        'negotiation_to_contract': 50
      }
    };

    res.json(pipeline);
  } catch (error) {
    console.error('Error fetching pipeline:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline data' });
  }
});

// 정체 거래 목록 (30일 이상)
router.get('/stalled-deals', async (req: Request, res: Response) => {
  try {
    const stalledDeals = [
      { id: '1', name: '삼성전자 이메일 보안 솔루션', amount: 350000000, stage: '제안', owner: '김영업', daysSinceActivity: 45, lastActivity: '2024-12-15' },
      { id: '2', name: 'LG CNS 파일 보안', amount: 280000000, stage: 'POC/BMT', owner: '이매니저', daysSinceActivity: 38, lastActivity: '2024-12-22' },
      { id: '3', name: '현대자동차 CDR 솔루션', amount: 420000000, stage: '니즈파악', owner: '박대리', daysSinceActivity: 52, lastActivity: '2024-12-08' },
      { id: '4', name: 'SK하이닉스 APT 대응', amount: 180000000, stage: '협상', owner: '김영업', daysSinceActivity: 31, lastActivity: '2024-12-29' },
      { id: '5', name: 'KB금융 이메일 보안', amount: 290000000, stage: '제안', owner: '최주임', daysSinceActivity: 42, lastActivity: '2024-12-18' }
    ];

    res.json({
      totalCount: stalledDeals.length,
      totalValue: stalledDeals.reduce((sum, d) => sum + d.amount, 0),
      deals: stalledDeals
    });
  } catch (error) {
    console.error('Error fetching stalled deals:', error);
    res.status(500).json({ error: 'Failed to fetch stalled deals' });
  }
});

// 오늘의 할 일
router.get('/today-tasks', async (req: Request, res: Response) => {
  try {
    const tasks = {
      meetings: [
        { id: '1', title: '삼성전자 2차 미팅', time: '10:00', contact: '김보안 부장', deal: '삼성전자 이메일 보안' },
        { id: '2', title: 'KB금융 POC 킥오프', time: '14:00', contact: '이정보 과장', deal: 'KB금융 이메일 보안' },
        { id: '3', title: '현대차 기술 검토 회의', time: '16:00', contact: '박시스템 차장', deal: '현대자동차 CDR' }
      ],
      followUps: [
        { id: '1', title: '제안서 수정 요청 회신', deal: 'LG CNS 파일 보안', dueDate: '오늘', priority: 'high' },
        { id: '2', title: 'POC 결과 보고서 작성', deal: '롯데정보통신 APT', dueDate: '오늘', priority: 'medium' },
        { id: '3', title: '계약서 검토 요청', deal: 'NH농협 보안 솔루션', dueDate: '오늘', priority: 'high' }
      ],
      expiringQuotes: [
        { id: '1', deal: '신한은행 CDR 도입', expiresIn: 3, amount: 180000000 },
        { id: '2', deal: '포스코 이메일 보안', expiresIn: 5, amount: 220000000 }
      ],
      totalMeetings: 3,
      totalFollowUps: 3,
      totalExpiringQuotes: 2
    };

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching today tasks:', error);
    res.status(500).json({ error: 'Failed to fetch today tasks' });
  }
});

// 팀 성과
router.get('/team-performance', async (req: Request, res: Response) => {
  try {
    const performance = {
      period: 'thisMonth',
      team: [
        { id: '1', name: '김영업', dealsCount: 18, dealsWon: 3, wonValue: 520000000, winRate: 65, activitiesCount: 45, target: 800000000, achievement: 65 },
        { id: '2', name: '이매니저', dealsCount: 15, dealsWon: 2, wonValue: 380000000, winRate: 58, activitiesCount: 38, target: 600000000, achievement: 63 },
        { id: '3', name: '박대리', dealsCount: 12, dealsWon: 2, wonValue: 290000000, winRate: 52, activitiesCount: 32, target: 500000000, achievement: 58 },
        { id: '4', name: '최주임', dealsCount: 10, dealsWon: 1, wonValue: 150000000, winRate: 45, activitiesCount: 28, target: 400000000, achievement: 38 },
        { id: '5', name: '정사원', dealsCount: 8, dealsWon: 1, wonValue: 120000000, winRate: 42, activitiesCount: 22, target: 300000000, achievement: 40 }
      ],
      totalWonValue: 1460000000,
      totalTarget: 2600000000,
      teamAchievement: 56
    };

    res.json(performance);
  } catch (error) {
    console.error('Error fetching team performance:', error);
    res.status(500).json({ error: 'Failed to fetch team performance' });
  }
});

// 영업 예측 (Forecast)
router.get('/forecast', async (req: Request, res: Response) => {
  try {
    const forecast = {
      currentMonth: {
        name: '2024년 1월',
        expected: 1850000000,
        weighted: 1280000000,
        bestCase: 2400000000,
        worstCase: 980000000,
        closed: 520000000
      },
      nextMonth: {
        name: '2024년 2월',
        expected: 2200000000,
        weighted: 1450000000,
        bestCase: 2800000000,
        worstCase: 1100000000
      },
      quarter: {
        name: 'Q1 2024',
        expected: 5800000000,
        weighted: 3950000000,
        bestCase: 7200000000,
        worstCase: 2800000000,
        target: 6000000000
      },
      byStage: [
        { stage: '협상', value: 850000000, probability: 80, weighted: 680000000 },
        { stage: '계약', value: 450000000, probability: 90, weighted: 405000000 },
        { stage: 'POC/BMT', value: 980000000, probability: 50, weighted: 490000000 },
        { stage: '제안', value: 1200000000, probability: 30, weighted: 360000000 }
      ]
    };

    res.json(forecast);
  } catch (error) {
    console.error('Error fetching forecast:', error);
    res.status(500).json({ error: 'Failed to fetch forecast data' });
  }
});

// POC/BMT 현황
router.get('/poc-status', async (req: Request, res: Response) => {
  try {
    const pocStatus = {
      active: [
        { id: '1', name: 'KB금융 이메일 보안 POC', company: 'KB금융', startDate: '2024-01-15', expectedEndDate: '2024-02-15', progress: 45, owner: '이매니저', status: 'in_progress' },
        { id: '2', name: '현대자동차 CDR POC', company: '현대자동차', startDate: '2024-01-10', expectedEndDate: '2024-02-10', progress: 65, owner: '박대리', status: 'in_progress' },
        { id: '3', name: '신한은행 APT POC', company: '신한은행', startDate: '2024-01-20', expectedEndDate: '2024-02-20', progress: 25, owner: '김영업', status: 'in_progress' }
      ],
      summary: {
        totalActive: 3,
        startedThisMonth: 2,
        completedThisMonth: 1,
        successRate: 75,
        avgDurationDays: 28
      },
      history: [
        { month: '2024-01', started: 2, completed: 1, success: 1, failed: 0 },
        { month: '2023-12', started: 3, completed: 2, success: 2, failed: 0 },
        { month: '2023-11', started: 4, completed: 3, success: 2, failed: 1 },
        { month: '2023-10', started: 2, completed: 2, success: 1, failed: 1 }
      ]
    };

    res.json(pocStatus);
  } catch (error) {
    console.error('Error fetching POC status:', error);
    res.status(500).json({ error: 'Failed to fetch POC status' });
  }
});

// 연락처 통계
router.get('/contacts', async (req: Request, res: Response) => {
  try {
    const snapshot = await dailySnapshotService.generateSnapshot();
    res.json(snapshot.contacts);
  } catch (error) {
    console.error('Error fetching contacts analytics:', error);
    res.status(500).json({ error: 'Failed to fetch contacts data' });
  }
});

// 회사 통계
router.get('/companies', async (req: Request, res: Response) => {
  try {
    const snapshot = await dailySnapshotService.generateSnapshot();
    res.json(snapshot.companies);
  } catch (error) {
    console.error('Error fetching companies analytics:', error);
    res.status(500).json({ error: 'Failed to fetch companies data' });
  }
});

// 티켓 통계
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const snapshot = await dailySnapshotService.generateSnapshot();
    res.json(snapshot.tickets);
  } catch (error) {
    console.error('Error fetching tickets analytics:', error);
    res.status(500).json({ error: 'Failed to fetch tickets data' });
  }
});

// 활동 통계
router.get('/activities', async (req: Request, res: Response) => {
  try {
    const snapshot = await dailySnapshotService.generateSnapshot();
    res.json(snapshot.activities);
  } catch (error) {
    console.error('Error fetching activities analytics:', error);
    res.status(500).json({ error: 'Failed to fetch activities data' });
  }
});

function generateTrendData(days: number) {
  const data = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    data.push({
      date: date.toISOString().split('T')[0],
      contacts: {
        created: Math.floor(Math.random() * 15) + 5,
        total: 1200 + Math.floor(Math.random() * 50)
      },
      deals: {
        created: Math.floor(Math.random() * 5) + 1,
        won: Math.floor(Math.random() * 3),
        lost: Math.floor(Math.random() * 2),
        pipelineValue: 4500000000 + Math.floor(Math.random() * 500000000)
      },
      tickets: {
        created: Math.floor(Math.random() * 8) + 2,
        resolved: Math.floor(Math.random() * 10) + 3
      },
      activities: {
        meetings: Math.floor(Math.random() * 10) + 3,
        calls: Math.floor(Math.random() * 25) + 10,
        notes: Math.floor(Math.random() * 15) + 5
      }
    });
  }

  return data;
}

export default router;
