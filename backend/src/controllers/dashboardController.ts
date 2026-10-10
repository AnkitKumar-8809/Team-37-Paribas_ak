import { Request, Response } from 'express';
import { logger } from '../utils/logger';

export const getDashboardSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = {
      totalFiles: 24,
      activeProcessing: 3,
      totalRejections: 14,
      totalAnomalies: 2,
      systemThroughput: 1450 // rows per second
    };

    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('[DashboardController] getDashboardSummary error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
