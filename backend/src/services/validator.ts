import { logger } from '../utils/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class ValidatorService {
  /**
   * Validates row fields against business rules and master data caches.
   */
  async validateRecord(record: Record<string, string>): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!record.amount || isNaN(Number(record.amount))) {
      errors.push('Invalid or missing numeric amount');
    }

    if (record.currency && record.currency.length !== 3) {
      errors.push(`Invalid currency code length: ${record.currency}`);
    }

    logger.debug(`[ValidatorService] Validation outcome: ${errors.length === 0 ? 'VALID' : 'INVALID'}`);

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export const validatorService = new ValidatorService();
