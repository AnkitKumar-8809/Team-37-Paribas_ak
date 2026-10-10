import { logger } from '../utils/logger';

/* =========================================================
   Old single-row anomaly contract
   Kept for compatibility
   ========================================================= */

export interface AnomalyResult {
  isAnomaly: boolean;
  score: number;
  explanation?: string;
}

/* =========================================================
   Layer 2 anomaly contracts
   ========================================================= */

export interface AnomalyFlag {
  row_number: number | null;

  level: string;

  anomaly_type: string;

  rule_ref: string;

  score: number;

  method: string;

  explanation: string;
}

export interface AnomalyFlagsResponse {
  fileId?: string | null;

  count: number;

  flags: AnomalyFlag[];
}

export interface FileAnomalyFeatures {
  file_type: string;

  size_bytes?: number;

  total_records?: number;

  rejected_records?: number;

  actual_seconds?: number;

  predicted_seconds?: number;
}

/* =========================================================
   Other ML contracts
   ========================================================= */

export interface PredictionResult {
  estimatedSeconds: number;
}

export interface SuggestionResult {
  suggestedValue: string | null;
  confidence: number;
  explanation?: string;
}

/* =========================================================
   ML Client
   ========================================================= */

export class MLClient {
  private readonly baseUrl: string;

  /**
   * Batch Isolation Forest / SHAP checks may
   * take longer than the old single-record call.
   */
  private readonly timeoutMs = 30000;

  constructor() {
    this.baseUrl =
      process.env.ML_SERVICE_URL ||
      'http://localhost:8000';
  }

  /* =======================================================
     OLD SINGLE ROW ENDPOINT
     ======================================================= */

  async checkAnomaly(
    fileId: string,
    features: Record<
      string,
      unknown
    >,
    fileType?: string
  ): Promise<AnomalyResult> {
    try {
      logger.debug(
        `[MLClient] Checking single anomaly | file=${fileId}`
      );

      return await this.post<AnomalyResult>(
        '/anomaly/detect',
        {
          fileId,
          features,
          fileType,
        }
      );
    } catch (error) {
      logger.warn(
        `[MLClient] Single anomaly service unavailable | file=${fileId}`,
        error
      );

      return {
        isAnomaly: false,
        score: 0,
      };
    }
  }

  /* =======================================================
     BATCH ANOMALY DETECTION
     ======================================================= */

  async detectAnomalyBatch(
    fileId: string,
    fileType: string,
    rows: Array<
      Record<string, unknown>
    >,
    rowNumbers: number[]
  ): Promise<AnomalyFlagsResponse> {
    if (rows.length === 0) {
      return {
        fileId,
        count: 0,
        flags: [],
      };
    }

    try {
      logger.debug(
        `[MLClient] Batch anomaly detection | file=${fileId} | rows=${rows.length}`
      );

      return await this.post<AnomalyFlagsResponse>(
        '/anomaly/detect-batch',
        {
          fileId,
          fileType,
          rows,
          rowNumbers,
        }
      );
    } catch (error) {
      logger.warn(
        `[MLClient] Batch anomaly detection unavailable | file=${fileId}`,
        error
      );

      /**
       * ML failure must never stop the
       * normal ingestion pipeline.
       */
      return {
        fileId,
        count: 0,
        flags: [],
      };
    }
  }

  /* =======================================================
     FINISH FILE-WIDE ANOMALY ANALYSIS
     ======================================================= */

  async finishAnomalyFile(
    fileId: string
  ): Promise<AnomalyFlagsResponse> {
    try {
      logger.debug(
        `[MLClient] Finishing anomaly analysis | file=${fileId}`
      );

      return await this.post<AnomalyFlagsResponse>(
        '/anomaly/finish',
        {
          fileId,
        }
      );
    } catch (error) {
      logger.warn(
        `[MLClient] File-wide anomaly detection unavailable | file=${fileId}`,
        error
      );

      return {
        fileId,
        count: 0,
        flags: [],
      };
    }
  }

  /* =======================================================
     FILE LEVEL ANOMALY DETECTION
     ======================================================= */

  async detectFileAnomalies(
    features: FileAnomalyFeatures,
    history:
      FileAnomalyFeatures[] = []
  ): Promise<AnomalyFlagsResponse> {
    try {
      logger.debug(
        `[MLClient] File-level anomaly detection | type=${features.file_type}`
      );

      return await this.post<AnomalyFlagsResponse>(
        '/anomaly/file-level',
        {
          features,
          history,
        }
      );
    } catch (error) {
      logger.warn(
        '[MLClient] File-level anomaly detection unavailable',
        error
      );

      return {
        count: 0,
        flags: [],
      };
    }
  }

  /* =======================================================
     PROCESSING TIME PREDICTION
     ======================================================= */

  async predictProcessingTime(
    fileSizeMb: number,
    rowCount: number
  ): Promise<number> {
    try {
      const response =
        await this.post<PredictionResult>(
          '/prediction/predict-time',
          {
            fileSizeMb,
            rowCount,
          }
        );

      return response.estimatedSeconds;
    } catch (error) {
      logger.warn(
        '[MLClient] Processing-time prediction unavailable',
        error
      );

      return Math.max(
        1,
        Math.ceil(
          rowCount / 500
        )
      );
    }
  }

  /* =======================================================
     AI FIX SUGGESTIONS
     ======================================================= */

  async suggestFix(
    fieldName: string,
    originalValue: string,
    context: Record<
      string,
      unknown
    > = {}
  ): Promise<SuggestionResult> {
    try {
      return await this.post<SuggestionResult>(
        '/suggestions/suggest-fix',
        {
          fieldName,
          originalValue,
          context,
        }
      );
    } catch (error) {
      logger.warn(
        `[MLClient] Suggestion service unavailable | field=${fieldName}`,
        error
      );

      return {
        suggestedValue: null,
        confidence: 0,
      };
    }
  }

  /* =======================================================
     HTTP HELPER
     ======================================================= */

  private async post<T>(
    endpoint: string,
    body: Record<
      string,
      unknown
    >
  ): Promise<T> {
    const controller =
      new AbortController();

    const timeout =
      setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);

    try {
      const response =
        await fetch(
          `${this.baseUrl}${endpoint}`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify(
                body
              ),

            signal:
              controller.signal,
          }
        );

      if (!response.ok) {
        const message =
          await response.text();

        throw new Error(
          `ML service returned ${response.status} ${response.statusText}: ${message}`
        );
      }

      return (
        await response.json()
      ) as T;
    } finally {
      clearTimeout(
        timeout
      );
    }
  }
}

export const mlClient =
  new MLClient();