import { Request, Response } from 'express';
import { logger } from '../utils/logger';

export const getPendingRejections = async (_req: Request, res: Response): Promise<void> => {
  try {
    const rejections = [
      {
        id: 'rej_1',
        fileId: 'file_mock_1',
        rowNumber: 42,
        rawData: 'TXN9004,INVALID_ACC,KKBK0000321,INR,1200.00,2026-10-10T10:00:15Z',
        reason: 'Account number INVALID_ACC does not exist in master records',
        status: 'PENDING'
      },
      {
        id: 'rej_2',
        fileId: 'file_mock_1',
        rowNumber: 108,
        rawData: 'TXN9005,ACC100004,WRONG_IFSC,GBP,53000.00,2026-10-10T10:00:20Z',
        reason: 'Invalid IFSC format: WRONG_IFSC',
        status: 'PENDING'
      }
    ];

    res.json({ success: true, data: rejections });
  } catch (error) {
    logger.error('[ResolutionController] getPendingRejections error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const resolveRejection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, correctedData, notes } = req.body;

    logger.info(`[ResolutionController] Resolving rejection ${id} with action: ${action}`);

    res.json({
      success: true,
      data: {
        id,
        action,
        correctedData,
        notes,
        status: 'RESOLVED',
        resolvedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('[ResolutionController] resolveRejection error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
