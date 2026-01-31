import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { hubspotClient } from '../services/hubspot/HubspotClient.js';
import { summaryService } from '../services/openai/SummaryService.js';

// OpenAI 클라이언트 (딜 활동 요약용)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate Limit 방지용 딜레이 함수
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const router = Router();

// 딜 요약 (파이프라인별 스테이지 정리)
router.get('/deal-summary', async (req: Request, res: Response) => {
  try {
    const { pipelineId, year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    // 파이프라인 정보 조회
    const pipelines = await hubspotClient.getDealPipelines();

    // 모든 딜 조회 (페이지네이션 처리, 변경 이력 포함 - 최대 50개씩)
    let allDeals: any[] = [];
    let after: string | undefined = undefined;

    do {
      const dealsResponse = await hubspotClient.getDealsWithHistory(50, after);
      allDeals = allDeals.concat(dealsResponse.results);
      after = dealsResponse.paging?.next?.after;
    } while (after);

    // 스테이지 라벨 매핑을 위해 모든 파이프라인 스테이지 수집
    const allStageLabels = new Map<string, string>();
    pipelines.results.forEach((p: any) => {
      p.stages.forEach((s: any) => {
        allStageLabels.set(s.id, s.label);
      });
    });

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

          // 최근 7일 이내 변경 이력 추출
          const recentChanges: Array<{
            type: 'stage' | 'amount';
            previousValue: string;
            currentValue: string;
            changedAt: string;
          }> = [];

          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          // 스테이지 변경 이력
          if (deal.propertiesWithHistory?.dealstage) {
            const stageHistory = deal.propertiesWithHistory.dealstage;
            if (stageHistory.length > 1) {
              const currentStage = stageHistory[0];
              const previousStage = stageHistory[1];
              const changedAt = new Date(currentStage.timestamp);

              if (changedAt >= sevenDaysAgo) {
                recentChanges.push({
                  type: 'stage',
                  previousValue: allStageLabels.get(previousStage.value) || previousStage.value,
                  currentValue: allStageLabels.get(currentStage.value) || currentStage.value,
                  changedAt: currentStage.timestamp
                });
              }
            }
          }

          // 금액 변경 이력
          if (deal.propertiesWithHistory?.amount) {
            const amountHistory = deal.propertiesWithHistory.amount;
            if (amountHistory.length > 1) {
              const currentAmount = amountHistory[0];
              const previousAmount = amountHistory[1];
              const changedAt = new Date(currentAmount.timestamp);

              if (changedAt >= sevenDaysAgo && currentAmount.value !== previousAmount.value) {
                const prevVal = parseFloat(previousAmount.value) || 0;
                const currVal = parseFloat(currentAmount.value) || 0;
                recentChanges.push({
                  type: 'amount',
                  previousValue: prevVal >= 100000000
                    ? `${(prevVal / 100000000).toFixed(2)}억`
                    : prevVal >= 10000
                      ? `${(prevVal / 10000).toFixed(0)}만`
                      : `${prevVal.toLocaleString()}원`,
                  currentValue: currVal >= 100000000
                    ? `${(currVal / 100000000).toFixed(2)}억`
                    : currVal >= 10000
                      ? `${(currVal / 10000).toFixed(0)}만`
                      : `${currVal.toLocaleString()}원`,
                  changedAt: currentAmount.timestamp
                });
              }
            }
          }

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
            probability: stage.probability,
            recentChanges: recentChanges.length > 0 ? recentChanges : undefined
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
      // "거래 완료", "성사", "won" 등의 라벨을 가진 스테이지를 성사된 거래로 인식
      const isClosedWonStage = (stageLabel: string): boolean => {
        const label = stageLabel.toLowerCase();
        return label.includes('완료') || label.includes('성사') || label.includes('won') || label.includes('closed');
      };

      const pipelineTotals = stages.reduce(
        (acc, stage) => ({
          totalAmount: acc.totalAmount + stage.totalAmount,
          weightedAmount: acc.weightedAmount + stage.weightedAmount,
          totalCount: acc.totalCount + stage.count,
          closedWonAmount: isClosedWonStage(stage.label) ? acc.closedWonAmount + stage.totalAmount : acc.closedWonAmount,
          openAmount: !isClosedWonStage(stage.label) && stage.probability > 0 ? acc.openAmount + stage.totalAmount : acc.openAmount
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
// groupByDeals=true 시 딜별로 그룹화된 활동도 함께 반환
router.get('/activity-timeline', async (req: Request, res: Response) => {
  try {
    const { from, to, generateSummaries, groupByDeals, pipelineId, year } = req.query;

    // 기본값: 2주 전 ~ 2주 후
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
    const defaultTo = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000));

    const fromDate = from ? new Date(from as string) : defaultFrom;
    const toDate = to ? new Date(to as string) : defaultTo;

    // 날짜 범위 설정 (시작일 00:00:00, 종료일 23:59:59)
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    interface ActivityNote {
      id: string;
      body: string;
      timestamp: string;
    }

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
      comments: ActivityNote[];
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
          associations: emptyAssociations,
          comments: []
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
          associations: emptyAssociations,
          comments: []
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
          associations: emptyAssociations,
          comments: []
        });
      }
    } catch (error) {
      console.error('Error fetching meetings for timeline:', error);
    }

    // 이메일 조회 (scope 미승인시 조용히 무시)
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
          associations: emptyAssociations,
          comments: []
        });
      }
    } catch (error: any) {
      // 스코프 미승인 에러(403)는 조용히 무시, 다른 에러만 로그
      if (error?.code !== 403 && error?.body?.category !== 'MISSING_SCOPES') {
        console.error('Error fetching emails for timeline:', error);
      }
    }

    // Association 및 댓글 조회 (선택적, generateSummaries 요청 시에만)
    const shouldFetchAssociations = req.query.includeAssociations === 'true' || generateSummaries === 'true';
    if (shouldFetchAssociations && activities.length > 0) {
      console.log(`Fetching associations and comments for ${activities.length} activities...`);
      // 병렬 처리하되 동시 요청 수 제한 (10개씩)
      const batchSize = 10;
      for (let i = 0; i < activities.length; i += batchSize) {
        const batch = activities.slice(i, i + batchSize);
        const associationPromises = batch.map(async (activity) => {
          const objectType = activity.type === 'call' ? 'calls' :
                            activity.type === 'note' ? 'notes' :
                            activity.type === 'meeting' ? 'meetings' : 'emails';
          try {
            // 회사/연락처/거래 연결 조회
            const assoc = await hubspotClient.getActivityAssociations(objectType, activity.id);
            activity.associations = assoc;

            // 댓글(노트) 조회 (note 타입은 제외 - 자기 자신이 노트이므로)
            if (activity.type !== 'note') {
              const comments = await hubspotClient.getActivityNotes(objectType, activity.id);
              activity.comments = comments;
            }
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
          comments: a.comments?.map(c => ({ body: c.body, timestamp: c.timestamp })),
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

    // 딜별 그룹화 (groupByDeals=true인 경우)
    let dealActivities: any[] = [];
    if (groupByDeals === 'true') {
      const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

      // Rate Limit 방지를 위한 대기
      await delay(1000);

      // 딜 정보 조회 (재시도 로직 포함)
      let allDeals: any[] = [];
      let after: string | undefined = undefined;
      let retryCount = 0;
      const maxRetries = 3;

      do {
        try {
          const dealsRes = await hubspotClient.getDeals(100, after);
          allDeals = allDeals.concat(dealsRes.results);
          after = dealsRes.paging?.next?.after;
          retryCount = 0; // 성공하면 재시도 카운트 리셋
        } catch (e: any) {
          if (e.code === 429 && retryCount < maxRetries) {
            retryCount++;
            console.log(`[Deal Grouping] Rate limit hit, waiting ${retryCount * 2}s before retry...`);
            await delay(retryCount * 2000);
            continue;
          }
          throw e;
        }
        if (after) await delay(500);
      } while (after);

      await delay(500);

      // 파이프라인 정보 조회
      const pipelines = await hubspotClient.getDealPipelines();
      const stageMap = new Map<string, string>();
      pipelines.results.forEach((p: any) => {
        p.stages.forEach((s: any) => {
          stageMap.set(s.id, s.label);
        });
      });

      // 딜 필터링 (연도, 파이프라인)
      const dealMap = new Map<string, any>();
      allDeals.forEach(deal => {
        const closeDate = deal.properties.closedate ? new Date(deal.properties.closedate) : null;
        if (closeDate && closeDate.getFullYear() !== targetYear) return;
        if (pipelineId && deal.properties.pipeline !== pipelineId) return;

        dealMap.set(deal.id, {
          id: deal.id,
          name: deal.properties.dealname || '(거래명 없음)',
          amount: parseFloat(deal.properties.amount) || 0,
          pipeline: deal.properties.pipeline,
          stage: deal.properties.dealstage,
          stageName: stageMap.get(deal.properties.dealstage) || deal.properties.dealstage,
          closeDate: deal.properties.closedate
        });
      });

      console.log(`[Deal Grouping] Total deals: ${allDeals.length}, Filtered deals: ${dealMap.size}`);
      console.log(`[Deal Grouping] Target year: ${targetYear}, Pipeline: ${pipelineId || 'all'}`);

      // 활동에서 딜 연결 확인
      const activitiesWithDeals = activities.filter(a => a.associations.deals.length > 0);
      console.log(`[Deal Grouping] Activities with deal associations: ${activitiesWithDeals.length}/${activities.length}`);

      if (activitiesWithDeals.length > 0) {
        console.log(`[Deal Grouping] Sample activity deal IDs:`, activitiesWithDeals.slice(0, 5).map(a => ({
          activityId: a.id,
          dealId: a.associations.deals[0]?.id,
          dealName: a.associations.deals[0]?.name
        })));
      }

      // 딜에 연결된 활동 필터링 및 그룹화
      const dealActivityMap = new Map<string, {
        deal: any;
        activities: ActivityItem[];
        companyName: string;
      }>();

      let matchedCount = 0;
      let unmatchedCount = 0;

      activities.forEach(activity => {
        if (activity.associations.deals.length > 0) {
          // dealId를 문자열로 변환하여 매칭 (타입 불일치 방지)
          const dealId = String(activity.associations.deals[0].id);
          const deal = dealMap.get(dealId);
          if (deal) {
            matchedCount++;
            if (!dealActivityMap.has(dealId)) {
              dealActivityMap.set(dealId, {
                deal,
                activities: [],
                companyName: activity.associations.companies[0]?.name || ''
              });
            }
            const entry = dealActivityMap.get(dealId)!;
            entry.activities.push(activity);
            if (!entry.companyName && activity.associations.companies[0]?.name) {
              entry.companyName = activity.associations.companies[0].name;
            }
          } else {
            unmatchedCount++;
          }
        }
      });

      console.log(`[Deal Grouping] Matched: ${matchedCount}, Unmatched (filtered out): ${unmatchedCount}`);

      // 최근 활동 순으로 정렬
      const sortedDealActivities = Array.from(dealActivityMap.values())
        .map(entry => {
          entry.activities.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          return {
            ...entry,
            latestActivityDate: entry.activities[0]?.timestamp || ''
          };
        })
        .sort((a, b) =>
          new Date(b.latestActivityDate).getTime() - new Date(a.latestActivityDate).getTime()
        );

      // AI 요약 생성 (딜별) + 회사명 추출
      if (generateSummaries === 'true' && sortedDealActivities.length > 0) {
        const summaryPromises = sortedDealActivities.map(async (entry) => {
          try {
            // 활동 내용을 날짜와 함께 상세하게 포함
            const activityTexts = entry.activities.slice(0, 10).map(a => {
              const typeLabel = a.type === 'call' ? '전화' :
                               a.type === 'note' ? '메모' :
                               a.type === 'meeting' ? '미팅' : '이메일';
              const dateStr = a.date || a.timestamp?.split('T')[0] || '날짜 미상';
              const bodyText = a.body?.substring(0, 500) || '(내용 없음)';
              return `[${dateStr}] ${typeLabel} - ${a.title}\n내용: ${bodyText}`;
            }).join('\n\n');

            const today = new Date().toISOString().split('T')[0];

            // 회사명 추출 + 요약을 한번에 요청 (API 호출 최소화)
            const prompt = `당신은 영업 활동을 정확하게 요약하는 비서입니다.

## 작업 1: 고객사명 추출
딜 이름에서 실제 고객사(엔드 고객)를 추출하세요.
- 딜 이름: "${entry.deal.name}"
- 연결된 회사: "${entry.companyName || '없음'}"

주의:
- 괄호 안의 "구축형", "SLF", "APT", "CDR" 등은 제품 유형이지 회사명이 아닙니다
- "아이앤테크", "휴네시온", "구축형" 같은 파트너사/제품유형이 아닌 실제 고객사를 찾으세요
- 딜 이름에서 실제 고객사명(예: DB손해보험, 출입국사무소, 중앙선거관리위원회, HB저축은행)을 추출하세요
- 파트너사(고객사) 형식이면 괄호 안이 고객사입니다
- 찾을 수 없으면 "확인필요"라고 답하세요

## 작업 2: 활동 요약
오늘 날짜: ${today}
중요: 오늘 이후의 날짜는 "예정"으로 표현하세요.
오늘 이전의 날짜는 과거형으로 표현하세요.

거래 단계: ${entry.deal.stageName}

=== 활동 기록 (최신순) ===
${activityTexts}
===

## 응답 형식 (반드시 이 형식으로):
고객사: [추출한 고객사명]

• 최근/예정 활동: [날짜] - [활동 내용]
• 진행 상황: [실제 기록에 있는 내용만]
• 다음 단계: [기록에 있는 경우만, 없으면 생략]`;

            const response = await openai.chat.completions.create({
              model: 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content: '당신은 정확한 정보만 전달하는 영업 비서입니다. 주어진 데이터에 없는 내용은 절대 추측하거나 생성하지 않습니다.'
                },
                { role: 'user', content: prompt }
              ],
              max_tokens: 400,
              temperature: 0.1
            });

            const content = response.choices[0]?.message?.content || '';

            // 고객사명 추출
            const companyMatch = content.match(/고객사:\s*(.+?)(?:\n|$)/);
            const extractedCompany = companyMatch ? companyMatch[1].trim() : null;

            // 요약 부분 추출 (고객사: 라인 이후)
            const summaryPart = content.replace(/고객사:\s*.+?\n/, '').trim();

            return {
              dealId: entry.deal.id,
              summary: summaryPart,
              extractedCompany: extractedCompany && extractedCompany !== '확인필요' ? extractedCompany : null
            };
          } catch (e) {
            return { dealId: entry.deal.id, summary: '', extractedCompany: null };
          }
        });

        const summaries = await Promise.all(summaryPromises);
        const summaryMap = new Map(summaries.map(s => [s.dealId, { summary: s.summary, company: s.extractedCompany }]));

        dealActivities = sortedDealActivities.map(entry => {
          const aiResult = summaryMap.get(entry.deal.id);
          return {
            dealId: entry.deal.id,
            dealName: entry.deal.name,
            companyName: aiResult?.company || entry.companyName || '(확인 필요)',
            stageName: entry.deal.stageName,
            amount: entry.deal.amount,
            activityCount: entry.activities.length,
            latestActivityDate: entry.latestActivityDate,
            aiSummary: aiResult?.summary || '',
            activities: entry.activities.slice(0, 5).map(a => ({
              type: a.type,
              title: a.title,
              date: a.date
            }))
          };
        });
      } else {
        dealActivities = sortedDealActivities.map(entry => ({
          dealId: entry.deal.id,
          dealName: entry.deal.name,
          companyName: entry.companyName,
          stageName: entry.deal.stageName,
          amount: entry.deal.amount,
          activityCount: entry.activities.length,
          latestActivityDate: entry.latestActivityDate,
          aiSummary: '',
          activities: entry.activities.slice(0, 5).map(a => ({
            type: a.type,
            title: a.title,
            date: a.date
          }))
        }));
      }
    }

    const responseData: any = {
      dateRange: {
        from: fromDate.toISOString().split('T')[0],
        to: toDate.toISOString().split('T')[0]
      },
      totalCount: activities.length,
      dates,
      activitiesByDate: groupedByDate
    };

    // 딜별 그룹화 데이터 추가
    if (groupByDeals === 'true') {
      responseData.dealActivities = {
        totalDeals: dealActivities.length,
        deals: dealActivities
      };
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error fetching activity timeline:', error);
    res.status(500).json({ error: 'Failed to fetch activity timeline' });
  }
});

export default router;
