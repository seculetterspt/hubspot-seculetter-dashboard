import { pool } from '../../config/database.js';
import { hubspotClient } from '../hubspot/HubspotClient.js';

interface PipelineTotals {
  totalAmount: number;
  weightedAmount: number;
  openAmount: number;
  closedWonAmount: number;
  totalCount: number;
}

interface StageSnapshot {
  id: string;
  label: string;
  totalAmount: number;
  weightedAmount: number;
  count: number;
  probability: number;
}

interface PipelineSnapshot {
  pipelineId: string;
  pipelineLabel: string;
  targetYear: number;
  totals: PipelineTotals;
  stages: StageSnapshot[];
}

interface WeeklyComparison {
  current: PipelineTotals;
  previous: PipelineTotals | null;
  previousSnapshotDate: string | null; // 이전 스냅샷 날짜 (YYYY-MM-DD)
  changes: {
    totalAmount: number;
    weightedAmount: number;
    openAmount: number;
    closedWonAmount: number;
    totalCount: number;
  } | null;
}

class SnapshotService {
  // 현재 파이프라인 데이터 가져오기 (deal-summary 로직 재사용)
  async getCurrentPipelineData(pipelineId?: string, year?: number): Promise<PipelineSnapshot[]> {
    const targetYear = year || new Date().getFullYear();

    // 파이프라인 정보 조회
    const pipelines = await hubspotClient.getDealPipelines();

    // 모든 딜 조회
    let allDeals: any[] = [];
    let after: string | undefined = undefined;

    do {
      const dealsResponse = await hubspotClient.getDealsWithHistory(50, after);
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

    const result: PipelineSnapshot[] = [];

    for (const pipeline of pipelines.results) {
      // 특정 파이프라인만 필터링 (선택적)
      if (pipelineId && pipeline.id !== pipelineId) continue;

      // 해당 파이프라인의 딜만 필터링
      const pipelineDeals = allDeals.filter(deal => {
        const dealPipeline = deal.properties.pipeline;
        const closeDate = deal.properties.closedate ? new Date(deal.properties.closedate) : null;

        if (dealPipeline !== pipeline.id) return false;

        if (closeDate) {
          return closeDate.getFullYear() === targetYear;
        }

        return true;
      });

      // 스테이지별로 그룹화
      const stageMap = new Map<string, any>();
      pipeline.stages.forEach((stage: any) => {
        const rawProbability = parseFloat(stage.metadata?.probability || '0');
        const probabilityDecimal = rawProbability > 1 ? rawProbability / 100 : rawProbability;
        const probabilityPercent = rawProbability > 1 ? rawProbability : rawProbability * 100;

        stageMap.set(stage.id, {
          id: stage.id,
          label: stage.label,
          displayOrder: stage.displayOrder,
          probability: probabilityPercent,
          probabilityDecimal: probabilityDecimal,
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
          stage.totalAmount += amount;
          stage.weightedAmount += amount * stage.probabilityDecimal;
          stage.count++;
        }
      });

      // 스테이지 배열로 변환
      const stages = Array.from(stageMap.values()).sort(
        (a, b) => a.displayOrder - b.displayOrder
      );

      // 파이프라인 합계 계산
      const isClosedWonStage = (stageLabel: string): boolean => {
        const label = stageLabel.toLowerCase();
        return label.includes('완료') || label.includes('성사') || label.includes('won') || label.includes('closed');
      };

      const totals = stages.reduce(
        (acc, stage) => ({
          totalAmount: acc.totalAmount + stage.totalAmount,
          weightedAmount: acc.weightedAmount + stage.weightedAmount,
          totalCount: acc.totalCount + stage.count,
          closedWonAmount: isClosedWonStage(stage.label) ? acc.closedWonAmount + stage.totalAmount : acc.closedWonAmount,
          openAmount: !isClosedWonStage(stage.label) && stage.probability > 0 ? acc.openAmount + stage.totalAmount : acc.openAmount
        }),
        { totalAmount: 0, weightedAmount: 0, totalCount: 0, closedWonAmount: 0, openAmount: 0 }
      );

      result.push({
        pipelineId: pipeline.id,
        pipelineLabel: pipeline.label,
        targetYear,
        totals,
        stages: stages.map(s => ({
          id: s.id,
          label: s.label,
          totalAmount: s.totalAmount,
          weightedAmount: s.weightedAmount,
          count: s.count,
          probability: s.probability
        }))
      });
    }

    return result;
  }

  // 스냅샷 저장
  async saveSnapshot(snapshotDate?: Date): Promise<void> {
    const date = snapshotDate || new Date();
    const dateStr = date.toISOString().split('T')[0];

    console.log(`[Snapshot] Saving weekly snapshot for ${dateStr}...`);

    // 현재 연도와 작년 데이터 저장
    const currentYear = date.getFullYear();
    const years = [currentYear, currentYear - 1];

    for (const year of years) {
      const pipelineData = await this.getCurrentPipelineData(undefined, year);

      for (const pipeline of pipelineData) {
        await pool.query(
          `INSERT INTO weekly_pipeline_snapshot
           (snapshot_date, pipeline_id, pipeline_label, target_year, total_amount, weighted_amount, open_amount, closed_won_amount, total_count, by_stage)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (snapshot_date, pipeline_id, target_year)
           DO UPDATE SET
             pipeline_label = EXCLUDED.pipeline_label,
             total_amount = EXCLUDED.total_amount,
             weighted_amount = EXCLUDED.weighted_amount,
             open_amount = EXCLUDED.open_amount,
             closed_won_amount = EXCLUDED.closed_won_amount,
             total_count = EXCLUDED.total_count,
             by_stage = EXCLUDED.by_stage`,
          [
            dateStr,
            pipeline.pipelineId,
            pipeline.pipelineLabel,
            year,
            pipeline.totals.totalAmount,
            pipeline.totals.weightedAmount,
            pipeline.totals.openAmount,
            pipeline.totals.closedWonAmount,
            pipeline.totals.totalCount,
            JSON.stringify(pipeline.stages)
          ]
        );

        console.log(`[Snapshot] Saved: ${pipeline.pipelineLabel} (${year})`);
      }
    }

    console.log(`[Snapshot] Weekly snapshot completed for ${dateStr}`);
  }

  // 가장 최근 월요일 날짜 계산
  getLastMonday(fromDate?: Date): Date {
    const date = fromDate ? new Date(fromDate) : new Date();
    const day = date.getDay();
    const diff = day === 0 ? 6 : day - 1; // 일요일이면 6일 전, 아니면 (요일-1)일 전
    date.setDate(date.getDate() - diff);
    date.setHours(7, 0, 0, 0);
    return date;
  }

  // 지난주 월요일 날짜 계산
  getPreviousMonday(fromDate?: Date): Date {
    const lastMonday = this.getLastMonday(fromDate);
    lastMonday.setDate(lastMonday.getDate() - 7);
    return lastMonday;
  }

  // 이전 스냅샷 조회 (날짜 포함)
  async getPreviousSnapshot(pipelineId: string, targetYear: number, beforeDate?: Date): Promise<{ data: PipelineTotals; snapshotDate: string } | null> {
    const date = beforeDate || new Date();
    const dateStr = date.toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT snapshot_date, total_amount, weighted_amount, open_amount, closed_won_amount, total_count, by_stage
       FROM weekly_pipeline_snapshot
       WHERE pipeline_id = $1 AND target_year = $2 AND snapshot_date < $3
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [pipelineId, targetYear, dateStr]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      data: {
        totalAmount: parseFloat(row.total_amount) || 0,
        weightedAmount: parseFloat(row.weighted_amount) || 0,
        openAmount: parseFloat(row.open_amount) || 0,
        closedWonAmount: parseFloat(row.closed_won_amount) || 0,
        totalCount: parseInt(row.total_count) || 0
      },
      snapshotDate: row.snapshot_date.toISOString().split('T')[0]
    };
  }

  // 특정 날짜의 스냅샷 조회
  async getSnapshotByDate(pipelineId: string, targetYear: number, snapshotDate: Date): Promise<PipelineTotals | null> {
    const dateStr = snapshotDate.toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT total_amount, weighted_amount, open_amount, closed_won_amount, total_count, by_stage
       FROM weekly_pipeline_snapshot
       WHERE pipeline_id = $1 AND target_year = $2 AND snapshot_date = $3`,
      [pipelineId, targetYear, dateStr]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      totalAmount: parseFloat(row.total_amount) || 0,
      weightedAmount: parseFloat(row.weighted_amount) || 0,
      openAmount: parseFloat(row.open_amount) || 0,
      closedWonAmount: parseFloat(row.closed_won_amount) || 0,
      totalCount: parseInt(row.total_count) || 0
    };
  }

  // 주간 비교 데이터 가져오기
  async getWeeklyComparison(pipelineId: string, targetYear: number): Promise<WeeklyComparison> {
    // 현재 라이브 데이터 가져오기 (HubSpot API에서 직접)
    const currentData = await this.getCurrentPipelineData(pipelineId, targetYear);
    const current = currentData[0]?.totals || {
      totalAmount: 0,
      weightedAmount: 0,
      openAmount: 0,
      closedWonAmount: 0,
      totalCount: 0
    };

    // 이전 주 스냅샷 가져오기 (스냅샷 2개 이상이면 두 번째로 최신 것 사용)
    const previousResult = await this.getPreviousWeekSnapshot(pipelineId, targetYear);

    if (!previousResult) {
      return {
        current,
        previous: null,
        previousSnapshotDate: null,
        changes: null
      };
    }

    const previous = previousResult.data;

    return {
      current,
      previous,
      previousSnapshotDate: previousResult.snapshotDate,
      changes: {
        totalAmount: current.totalAmount - previous.totalAmount,
        weightedAmount: current.weightedAmount - previous.weightedAmount,
        openAmount: current.openAmount - previous.openAmount,
        closedWonAmount: current.closedWonAmount - previous.closedWonAmount,
        totalCount: current.totalCount - previous.totalCount
      }
    };
  }

  // 이전 주 월요일 스냅샷 조회 (비교용)
  // 항상 "지난주 월요일" 스냅샷과 비교
  // 예: 2/17(월)이면 2/10(월)과 비교, 2/19(수)이면 2/10(월)과 비교
  async getPreviousWeekSnapshot(pipelineId: string, targetYear: number): Promise<{ data: PipelineTotals; snapshotDate: string } | null> {
    // 지난주 월요일 날짜 계산
    const prevMonday = this.getPreviousMonday();
    const prevMondayStr = prevMonday.toISOString().split('T')[0];

    console.log(`[Snapshot] Looking for snapshot on or before previous Monday: ${prevMondayStr}`);

    // 지난주 월요일 또는 그 이전의 가장 최근 스냅샷 조회
    const result = await pool.query(
      `SELECT snapshot_date, total_amount, weighted_amount, open_amount, closed_won_amount, total_count
       FROM weekly_pipeline_snapshot
       WHERE pipeline_id = $1 AND target_year = $2 AND snapshot_date <= $3
       ORDER BY snapshot_date DESC
       LIMIT 1`,
      [pipelineId, targetYear, prevMondayStr]
    );

    if (result.rows.length === 0) {
      console.log(`[Snapshot] No snapshot found on or before ${prevMondayStr}`);
      return null;
    }

    const row = result.rows[0];
    console.log(`[Snapshot] Found snapshot from: ${row.snapshot_date}`);

    return {
      data: {
        totalAmount: parseFloat(row.total_amount) || 0,
        weightedAmount: parseFloat(row.weighted_amount) || 0,
        openAmount: parseFloat(row.open_amount) || 0,
        closedWonAmount: parseFloat(row.closed_won_amount) || 0,
        totalCount: parseInt(row.total_count) || 0
      },
      snapshotDate: row.snapshot_date.toISOString().split('T')[0]
    };
  }

  // 모든 스냅샷 목록 조회
  async getSnapshotHistory(pipelineId: string, targetYear: number, limit = 10): Promise<any[]> {
    const result = await pool.query(
      `SELECT snapshot_date, total_amount, weighted_amount, open_amount, closed_won_amount, total_count, by_stage, created_at
       FROM weekly_pipeline_snapshot
       WHERE pipeline_id = $1 AND target_year = $2
       ORDER BY snapshot_date DESC
       LIMIT $3`,
      [pipelineId, targetYear, limit]
    );

    return result.rows.map(row => ({
      snapshotDate: row.snapshot_date,
      totalAmount: parseFloat(row.total_amount) || 0,
      weightedAmount: parseFloat(row.weighted_amount) || 0,
      openAmount: parseFloat(row.open_amount) || 0,
      closedWonAmount: parseFloat(row.closed_won_amount) || 0,
      totalCount: parseInt(row.total_count) || 0,
      byStage: row.by_stage,
      createdAt: row.created_at
    }));
  }
}

export const snapshotService = new SnapshotService();
