import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { emitFileProgress } from '../sockets/socket';

export const uploadFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    const fileRecord = {
      id: `file_${Date.now()}`,
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      status: 'PROCESSING',
      progress: 0,
      totalRows: 100,
      processedRows: 0,
      createdAt: new Date()
    };

    logger.info(`[FileController] File uploaded: ${file.originalname}`);

    // Emit initial realtime progress via Socket.IO
    emitFileProgress(fileRecord.id, 0, 'PROCESSING');

    res.status(201).json({ success: true, data: fileRecord });
  } catch (error) {
    logger.error('[FileController] uploadFile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getFiles = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Starter placeholder list of files
    const mockFiles = [
      {
        id: 'file_mock_1',
        filename: 'transactions_october.csv',
        originalName: 'transactions_october.csv',
        status: 'PROCESSING',
        progress: 68.5,
        totalRows: 500,
        processedRows: 342,
        errorCount: 2,
        createdAt: new Date().toISOString()
      },
      {
        id: 'file_mock_2',
        filename: 'payroll_batch_sep.csv',
        originalName: 'payroll_batch_sep.csv',
        status: 'COMPLETED',
        progress: 100,
        totalRows: 1200,
        processedRows: 1200,
        errorCount: 0,
        createdAt: new Date(Date.now() - 3600000).toISOString()
      }
    ];

    res.json({ success: true, data: mockFiles });
  } catch (error) {
    logger.error('[FileController] getFiles error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getFileById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    res.json({
      success: true,
      data: {
        id,
        filename: 'transactions_october.csv',
        status: 'PROCESSING',
        progress: 68.5,
        totalRows: 500,
        processedRows: 342,
        errorCount: 2
      }
    });
  } catch (error) {
    logger.error('[FileController] getFileById error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
