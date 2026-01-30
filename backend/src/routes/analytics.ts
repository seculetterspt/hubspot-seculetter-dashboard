import { Router, Request, Response } from 'express';
import { hubspotClient } from '../services/hubspot/HubspotClient.js';
import { summaryService } from '../services/openai/SummaryService.js';

const router = Router();

// 딜 요약 (파이프라인별 스테이지 정리)
router.get('/deal-summary', async (req: Request, res: Response) => {
  try {
    const { pipelineId, year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    // 파이프라인 정보 조회
    const pipelines = await hubspotClient.getDealPipelines();

    // 모든 딜 조회 (페이지네이션 처리)
    let allDeals: any[] = [];
    let after: string | undefined = undefined;

    do {
      const dealsResponse = await hubspotClient.getDeals(100, after);
      allDeals = allDeals.concat(dealsResponse.results);
      after = dealsResponse.paging?.next?.after;
    } while (after);

    // Owner 정보 조회
    const ownersResponse = await hubspotClient.getOwners();
    const ownersMap = new Map<string, string>();
    ownersResponse.results.forEach((owner: any) => {
      const name = `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.email || '(담당자 없음)';
      ownersMap.set(owner.id, name);
    });

    // 파이프라인별로 데이터 구성
    const pipelineData = pipelines.results.map((pipeline: any) => {
      // 해당 파이프라인의 딜만 필터링
      const pipelineDeals = allDeals.filter(deal => {
        const dealPipeline = deal.properties.pipeline;
        const closeDate = deal.properties.closedate ? new Date(deal.properties.closedate) : null;

        // 파이프라인 매칭 확인
        if (dealPipeline !== pipeline.id) return false;

        // 연도 필터링 (closedate 기준)
        if (closeDate) {
          return closeDate.getFullYear() === targetYear;
        }

        return true; // closedate 없는 경우 포함
      });

      // 스테이지별로 그룹화
      const stageMap = new Map<string, any>();
      pipeline.stages.forEach((stage: any) => {
        stageMap.set(stage.id, {
          id: stage.id,
          label: stage.label,
          displayOrder: stage.displayOrder,
          probability: parseFloat(stage.metadata?.probability || '0'),
          deals: [],
          totalAmount: 0,
          weightedAmount: 0,
          count: 0
        });
      });

      // 딜을 스테이지별로 분류
      pipelineDeals.forEach(deal => {
        const stageId = deal.properties.dealstage;
        const stage = stageMap.get(stageId);
        if (stage) {
          const amount = parseFloat(deal.properties.amount) || 0;
          const probability = stage.probability / 100;

          // Association 정보 조회를 위한 데이터 준비
          const dealData = {
            id: deal.id,
            name: deal.properties.dealname || '(거래명 없음)',
            amount,
            weightedAmount: amount * probability,
            closeDate: deal.properties.closedate,
            createDate: deal.properties.createdate,
            lastModified: deal.properties.hs_lastmodifieddate,
            ownerId: deal.properties.hubspot_owner_id,
            ownerName: deal.properties.hubspot_owner_id
              ? ownersMap.get(deal.properties.hubspot_owner_id) || '(담당자 없음)'
              : '(담당자 없음)',
            probability: stage.probability
          };

          stage.deals.push(dealData);
          stage.totalAmount += amount;
          stage.weightedAmount += dealData.weightedAmount;
          stage.count++;
        }
      });

      // 스테이지 배열로 변환 및 정렬
      const stages = Array.from(stageMap.values()).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );

      // 각 스테이지의 딜을 금액 순으로 정렬
      stages.forEach(stage => {
        stage.deals.sort((a: any, b: any) => (b.amount || 0) - (a.amount || 0));
      });

      // 파이프라인 합계 계산
      const pipelineTotals = stages.reduce(
        (acc, stage) => ({
          totalAmount: acc.totalAmount + stage.totalAmount,
          weightedAmount: acc.weightedAmount + stage.weightedAmount,
          totalCount: acc.totalCount + stage.count,
          closedWonAmount: stage.probability === 100 ? acc.closedWonAmount + stage.totalAmount : acc.closedWonAmount,
          openAmount: stage.probability < 100 && stage.probability > 0 ? acc.openAmount + stage.totalAmount : acc.openAmount
        }),
        { totalAmount: 0, weightedAmount: 0, totalCount: 0, closedWonAmount: 0, openAmount: 0 }
      );

      return {
        id: pipeline.id,
        label: pipeline.label,
        stages,
        totals: pipelineTotals
      };
    });

    // 특정 파이프라인만 요청된 경우 필터링
    const result = pipelineId
      ? pipelineData.filter((p: any) => p.id === pipelineId)
      : pipelineData;

    res.json({
      year: targetYear,
      pipelines: result,
      summary: {
        totalPipelines: result.length,
        totalDeals: result.reduce((acc: number, p: any) => acc + p.totals.totalCount, 0),
        totalAmount: result.reduce((acc: number, p: any) => acc + p.totals.totalAmount, 0),
        totalWeightedAmount: result.reduce((acc: number, p: any) => acc + p.totals.weightedAmount, 0)
      }
    });
  } catch (error) {
    console.error('Error fetching deal summary:', error);
    res.status(500).json({ error: 'Failed to fetch deal summary' });
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
    const emptyAssociations = { companies: [], contacts: [], deals: [] };

    // 전화 조회
    try {
      const callsRes = await hubspotClient.getCalls(100);
      const filteredCalls = callsRes.results.filter(c => {
        const timestamp = c.properties.hs_timestamp ? new Date(c.properties.hs_timestamp) : null;
        return timestamp && timestamp >= fromDate && timestamp <= toDate;
      });

      for (const call of filteredCalls) {
        const timestamp = call.properties.hs_timestamp || '';
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : '';

        activities.push({
          id: call.id,
          type: 'call',
          title: call.properties.hs_call_title || '(제목 없음)',
          body: call.properties.hs_call_body || '',
          timestamp,
          date,
          associations: emptyAssociations
        });
      }
    } catch (error) {
      console.error('Error fetching calls for timeline:', error);
    }

    // 메모 조회
    try {
      const notesRes = await hubspotClient.getNotes(100);
      const filteredNotes = notesRes.results.filter(n => {
        const timestamp = n.properties.hs_timestamp ? new Date(n.properties.hs_timestamp) : null;
        return timestamp && timestamp >= fromDate && timestamp <= toDate;
      });

      for (const note of filteredNotes) {
        const timestamp = note.properties.hs_timestamp || '';
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : '';

        activities.push({
          id: note.id,
          type: 'note',
          title: '메모',
          body: note.properties.hs_note_body || '',
          timestamp,
          date,
          associations: emptyAssociations
        });
      }
    } catch (error) {
      console.error('Error fetching notes for timeline:', error);
    }

    // 미팅 조회 (예정된 미팅 포함)
    try {
      const meetingsRes = await hubspotClient.getMeetings(100);
      const filteredMeetings = meetingsRes.results.filter(m => {
        const startTime = m.properties.hs_meeting_start_time ? new Date(m.properties.hs_meeting_start_time) : null;
        return startTime && startTime >= fromDate && startTime <= toDate;
      });

      for (const meeting of filteredMeetings) {
        const timestamp = meeting.properties.hs_meeting_start_time || '';
        const date = timestamp ? new Date(timestamp).toISOString().split('T')[0] : '';

        activities.push({
          id: meeting.id,
          type: 'meeting',
          title: meeting.properties.hs_meeting_title || '(제목 없음)',
          body: meeting.properties.hs_meeting_body || '',
          timestamp,
          date,
          associations: emptyAssociations
        });
      }
    } catch (error) {
      console.error('Error fetching meetings for timeline:', error);
    }

    // 이메일 조회 (scope 미승인시 무시)
    try {
      const emailsRes = await hubspotClient.api.crm.objects.basicApi.getPage(
        'emails',
        100,
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

        activities.push({
          id: email.id,
          type: 'email',
          title: email.properties.hs_email_subject || '(제목 없음)',
          body: email.properties.hs_email_text || '',
          timestamp,
          date,
          associations: emptyAssociations
        });
      }
    } catch (error) {
      console.error('Error fetching emails for timeline:', error);
    }

    // Association 조회 (선택적, generateSummaries 요청 시에만)
    const shouldFetchAssociations = req.query.includeAssociations === 'true' || generateSummaries === 'true';
    if (shouldFetchAssociations && activities.length > 0) {
      console.log(`Fetching associations for ${activities.length} activities...`);
      // 병렬 처리하되 동시 요청 수 제한 (10개씩)
      const batchSize = 10;
      for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize);
        const associationPromises = batch.map(async (activity) => {
          const objectType = activity.type === 'call' ? 'calls' :
                            activity.type === 'note' ? 'notes' :
                            activity.type === 'meeting' ? 'meetings' : 'emails';
          try {
            const assoc = await hubspotClient.getActivityAssociations(objectType, activity.id);
            activity.associations = assoc;
          } catch (e) {
            // 개별 association 조회 실패 시 무시
          }
        });
        await Promise.all(associationPromises);
      }
    }

    // AI 요약 생성 (DB 캐싱 적용)
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

        // DB에서 기존 요약 조회 후 없는 것만 새로 생성하고 저장
        const summaries = await summaryService.generateAndSaveSummaries(activitiesForSummary);

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

export default router;
