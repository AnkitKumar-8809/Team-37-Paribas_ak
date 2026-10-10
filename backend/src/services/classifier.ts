import { logger } from '../utils/logger';

export type FileCategory = 'TRANSACTION_CSV' | 'ACCOUNT_MASTER' | 'UNKNOWN';

export class ClassifierService {
  /**
   * Classifies file type based on header columns and sample rows.
   */
  async classifyFileType(headers: string[]): Promise<FileCategory> {
    logger.debug(`[ClassifierService] Classifying headers: ${headers.join(',')}`);
    if (headers.includes('transaction_id') || headers.includes('amount')) {
      return 'TRANSACTION_CSV';
    }
    if (headers.includes('account_number') || headers.includes('account_name')) {
      return 'ACCOUNT_MASTER';
    }
    return 'UNKNOWN';
  }
}

export const classifierService = new ClassifierService();
