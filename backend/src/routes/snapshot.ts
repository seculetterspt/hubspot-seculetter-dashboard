import { Router, Request, Response } from 'express';
import { snapshotService } from '../services/snapshot/SnapshotService.js';

const router = Router();

// 스냅샷 수동 생성 (테스트용)
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { date } = req.body;
    const snapshotDate = date ? new Date(date) : new Date();

    await snapshotService.saveSnapshot(snapshotDate);

    res.json({
      success: true,
      message: `Snapshot created for ${snapshotDate.toISOString().split('T')[0]}`
    });
  } catch (error: any) {
    console.error('Error creating snapshot:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create snapshot'
    });
  }
});

// 주간 비교 데이터 조회
router.get('/comparison', async (req: Request, res: Response) => {
  try {
    const { pipelineId, year } = req.query;

    if (!pipelineId) {
      return res.status(400).json({
        success: false,
        error: 'pipelineId is required'
      });
    }

    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    const comparison = await snapshotService.getWeeklyComparison(pipelineId as string, targetYear);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error: any) {
    console.error('Error getting comparison:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get comparison'
    });
  }
});

// 스냅샷 이력 조회
router.get('/history', async (req: Request, res: Response) => {
  try {
    const { pipelineId, year, limit } = req.query;

    if (!pipelineId) {
      return res.status(400).json({
        success: false,
        error: 'pipelineId is required'
      });
    }

    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    const historyLimit = limit ? parseInt(limit as string) : 10;

    const history = await snapshotService.getSnapshotHistory(
      pipelineId as string,
      targetYear,
      historyLimit
    );

    res.json({
      success: true,
      data: history
    });
  } catch (error: any) {
    console.error('Error getting snapshot history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get snapshot history'
    });
  }
});

// 현재 파이프라인 데이터 조회 (스냅샷 없이)
router.get('/current', async (req: Request, res: Response) => {
  try {
    const { pipelineId, year } = req.query;
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();

    const data = await snapshotService.getCurrentPipelineData(
      pipelineId as string | undefined,
      targetYear
    );

    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error getting current pipeline data:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get current pipeline data'
    });
  }
});

export default router;
