"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mlClient = exports.MLClient = exports.MLServiceError = void 0;
const logger_1 = require("../utils/logger");
/* =========================================================
   CUSTOM ML ERROR
   ========================================================= */
class MLServiceError extends Error {
    endpoint;
    status;
    responseBody;
    constructor(message, endpoint, status, responseBody) {
        super(message);
        this.name =
            'MLServiceError';
        this.endpoint =
            endpoint;
        this.status =
            status;
        this.responseBody =
            responseBody;
    }
}
exports.MLServiceError = MLServiceError;
/* =========================================================
   ML CLIENT
   ========================================================= */
class MLClient {
    baseUrl;
    /**
     * Isolation Forest + SHAP can take longer
     * than simple validation calls.
     */
    timeoutMs = 30000;
    constructor() {
        const configuredUrl = process.env.ML_SERVICE_URL ||
            'http://localhost:8000';
        /**
         * Remove trailing slash so:
         *
         * http://localhost:8000/
         *
         * does not become:
         *
         * http://localhost:8000//anomaly/...
         */
        this.baseUrl =
            configuredUrl.replace(/\/+$/, '');
        logger_1.logger.info(`[MLClient] ML service URL=${this.baseUrl}`);
    }
    /* =======================================================
       HEALTH CHECK
       ======================================================= */
    async healthCheck() {
        const endpoint = '/health';
        try {
            const response = await this.get(endpoint);
            return (response.status ===
                'ok');
        }
        catch (error) {
            logger_1.logger.error('[MLClient] ML health check failed', error);
            return false;
        }
    }
    /* =======================================================
       SINGLE-ROW ANOMALY CHECK
  
       This is no longer used by the new processor,
       but keep it because Python still supports it.
       ======================================================= */
    async checkAnomaly(fileId, features, fileType) {
        const endpoint = '/anomaly/detect';
        logger_1.logger.debug(`[MLClient] Single anomaly request | ` +
            `file=${fileId} | ` +
            `type=${fileType ?? 'auto'}`);
        return this.post(endpoint, {
            fileId,
            features,
            fileType,
        });
    }
    /* =======================================================
       BATCH ANOMALY DETECTION
  
       Python:
       POST /anomaly/detect-batch
       ======================================================= */
    async detectAnomalyBatch(fileId, fileType, rows, rowNumbers) {
        const endpoint = '/anomaly/detect-batch';
        if (rows.length ===
            0) {
            return {
                fileId,
                count: 0,
                flags: [],
            };
        }
        if (rowNumbers.length !==
            rows.length) {
            throw new Error(`ML row mapping mismatch. ` +
                `rows=${rows.length}, ` +
                `rowNumbers=${rowNumbers.length}`);
        }
        logger_1.logger.info(`[MLClient] POST ${endpoint} | ` +
            `file=${fileId} | ` +
            `type=${fileType} | ` +
            `rows=${rows.length}`);
        try {
            const response = await this.post(endpoint, {
                fileId,
                fileType,
                rows,
                rowNumbers,
            });
            logger_1.logger.info(`[MLClient] Batch anomaly success | ` +
                `file=${fileId} | ` +
                `count=${response.count}`);
            return response;
        }
        catch (error) {
            /**
             * IMPORTANT:
             *
             * Do NOT return:
             *
             * {
             *   count: 0,
             *   flags: []
             * }
             *
             * here.
             *
             * That would make an ML failure look
             * like the model found no anomalies.
             */
            logger_1.logger.error(`[MLClient] Batch anomaly detection FAILED | ` +
                `file=${fileId} | ` +
                `type=${fileType}`, error);
            throw error;
        }
    }
    /* =======================================================
       FINISH FILE SESSION
  
       Python keeps state for multiple batches.
  
       This detects patterns such as:
       - TXN_VELOCITY
       - PAYMENT_BURST
       - NEAR_DUPLICATE
       - RATE_JUMP
       - STALE_RATE
       ======================================================= */
    async finishAnomalyFile(fileId) {
        const endpoint = '/anomaly/finish';
        logger_1.logger.info(`[MLClient] POST ${endpoint} | file=${fileId}`);
        try {
            const response = await this.post(endpoint, {
                fileId,
            });
            logger_1.logger.info(`[MLClient] Finish anomaly success | ` +
                `file=${fileId} | ` +
                `count=${response.count}`);
            return response;
        }
        catch (error) {
            logger_1.logger.error(`[MLClient] Finish anomaly detection FAILED | file=${fileId}`, error);
            throw error;
        }
    }
    /* =======================================================
       FILE-LEVEL ANOMALIES
  
       Detects:
       - FILE_SIZE_UNUSUAL
       - RECORD_COUNT_UNUSUAL
       - REJECTION_RATE_HIGH
       - PROCESSING_TIME_MISS
       ======================================================= */
    async detectFileAnomalies(features, history = []) {
        const endpoint = '/anomaly/file-level';
        logger_1.logger.info(`[MLClient] POST ${endpoint} | ` +
            `type=${features.file_type} | ` +
            `records=${features.total_records ?? 0} | ` +
            `history=${history.length}`);
        try {
            const response = await this.post(endpoint, {
                features,
                history,
            });
            logger_1.logger.info(`[MLClient] File-level anomaly success | ` +
                `type=${features.file_type} | ` +
                `count=${response.count}`);
            return response;
        }
        catch (error) {
            logger_1.logger.error(`[MLClient] File-level anomaly detection FAILED | ` +
                `type=${features.file_type}`, error);
            throw error;
        }
    }
    /* =======================================================
       PROCESSING TIME PREDICTION
       ======================================================= */
    async predictProcessingTime(fileSizeMb, rowCount, fileType, sizeBytes, concurrency = 1) {
        const endpoint = '/prediction/predict-time';
        try {
            const response = await this.post(endpoint, {
                fileType,
                rowCount,
                fileSizeMb,
                sizeBytes,
                concurrency,
            });
            logger_1.logger.info(`[MLClient] ETA prediction | ` +
                `type=${fileType ?? 'unknown'} | ` +
                `rows=${rowCount} | ` +
                `seconds=${response.estimatedSeconds} | ` +
                `method=${response.method ?? 'unknown'}`);
            return (response.estimatedSeconds);
        }
        catch (error) {
            /**
             * ETA failure should not stop ingestion,
             * so prediction is allowed to fall back.
             */
            logger_1.logger.warn('[MLClient] Processing-time prediction unavailable. Using fallback.', error);
            return Math.max(1, Math.ceil(rowCount /
                500));
        }
    }
    /* =======================================================
       AI FIX SUGGESTIONS
       ======================================================= */
    async suggestFix(fieldName, originalValue, context = {}) {
        const endpoint = '/suggestions/suggest-fix';
        try {
            const response = await this.post(endpoint, {
                fieldName,
                originalValue,
                context,
            });
            logger_1.logger.debug(`[MLClient] Suggestion success | ` +
                `field=${fieldName} | ` +
                `confidence=${response.confidence}`);
            return response;
        }
        catch (error) {
            /**
             * Suggestions are optional.
             * A failed suggestion must not crash
             * the ingestion pipeline.
             */
            logger_1.logger.warn(`[MLClient] Suggestion service unavailable | field=${fieldName}`, error);
            return {
                suggestedValue: null,
                confidence: 0,
                explanation: 'ML suggestion service unavailable',
            };
        }
    }
    /* =======================================================
       POST HELPER
       ======================================================= */
    async post(endpoint, body) {
        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, this.timeoutMs);
        const startedAt = Date.now();
        try {
            logger_1.logger.debug(`[MLClient] Request → ${url}`);
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            const elapsedMs = Date.now() -
                startedAt;
            /**
             * Read as text first.
             *
             * This lets us show Python/FastAPI
             * validation errors instead of hiding
             * the useful response body.
             */
            const responseText = await response.text();
            if (!response.ok) {
                logger_1.logger.error(`[MLClient] HTTP ERROR | ` +
                    `endpoint=${endpoint} | ` +
                    `status=${response.status} | ` +
                    `durationMs=${elapsedMs} | ` +
                    `body=${responseText}`);
                throw new MLServiceError(`ML service returned ` +
                    `${response.status} ${response.statusText}. ` +
                    `Response: ${responseText}`, endpoint, response.status, responseText);
            }
            logger_1.logger.debug(`[MLClient] Response ← ${endpoint} | ` +
                `status=${response.status} | ` +
                `durationMs=${elapsedMs}`);
            if (!responseText) {
                throw new MLServiceError(`ML service returned an empty response for ${endpoint}`, endpoint, response.status);
            }
            try {
                return JSON.parse(responseText);
            }
            catch (parseError) {
                throw new MLServiceError(`ML service returned invalid JSON for ${endpoint}. ` +
                    `Response: ${responseText}`, endpoint, response.status, responseText);
            }
        }
        catch (error) {
            if (error instanceof
                MLServiceError) {
                throw error;
            }
            if (error instanceof Error &&
                error.name ===
                    'AbortError') {
                throw new MLServiceError(`ML request timed out after ${this.timeoutMs}ms: ${endpoint}`, endpoint);
            }
            const message = error instanceof Error
                ? error.message
                : String(error);
            throw new MLServiceError(`Unable to reach ML service at ${url}: ${message}`, endpoint);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    /* =======================================================
       GET HELPER
       ======================================================= */
    async get(endpoint) {
        const url = `${this.baseUrl}${endpoint}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, this.timeoutMs);
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json',
                },
                signal: controller.signal,
            });
            const responseText = await response.text();
            if (!response.ok) {
                throw new MLServiceError(`ML service returned ${response.status} ${response.statusText}: ${responseText}`, endpoint, response.status, responseText);
            }
            if (!responseText) {
                throw new MLServiceError(`ML service returned an empty response for ${endpoint}`, endpoint, response.status);
            }
            return JSON.parse(responseText);
        }
        catch (error) {
            if (error instanceof
                MLServiceError) {
                throw error;
            }
            if (error instanceof Error &&
                error.name ===
                    'AbortError') {
                throw new MLServiceError(`ML request timed out after ${this.timeoutMs}ms: ${endpoint}`, endpoint);
            }
            const message = error instanceof Error
                ? error.message
                : String(error);
            throw new MLServiceError(`Unable to reach ML service at ${url}: ${message}`, endpoint);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.MLClient = MLClient;
exports.mlClient = new MLClient();
