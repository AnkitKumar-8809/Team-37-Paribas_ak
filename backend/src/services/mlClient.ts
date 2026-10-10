import { logger } from '../utils/logger';

export class MLClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:8000';
  }

  async checkAnomaly(fileId: string, features: Record<string, unknown>): Promise<{ isAnomaly: boolean; score: number }> {
    try {
      logger.info(`[MLClient] Invoking ML service anomaly endpoint for file: ${fileId}`);
      // Starter fetch call to FastAPI
      const response = await fetch(`${this.baseUrl}/anomaly/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, features })
      });

      if (!response.ok) {
        throw new Error(`ML service returned ${response.status}`);
      }

      return (await response.json()) as { isAnomaly: boolean; score: number };
    } catch (err) {
      logger.warn(`[MLClient] Anomaly check fallback due to connection error:`, err);
      return { isAnomaly: false, score: 0.0 };
    }
  }

  async predictProcessingTime(fileSizeMb: number, rowCount: number): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/prediction/predict-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileSizeMb, rowCount })
      });

      if (!response.ok) return Math.ceil(rowCount / 200);
      const data = (await response.json()) as { estimatedSeconds: number };
      return data.estimatedSeconds;
    } catch {
      return Math.ceil(rowCount / 200);
    }
  }
}

export const mlClient = new MLClient();
