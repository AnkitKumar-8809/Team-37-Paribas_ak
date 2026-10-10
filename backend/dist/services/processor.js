"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processorService = exports.ProcessorService = void 0;
const fs_1 = __importDefault(require("fs"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const prisma_1 = require("../db/prisma");
const logger_1 = require("../utils/logger");
const socket_1 = require("../sockets/socket");
const validator_1 = require("./validator");
const loader_1 = require("./loader");
const mlClient_1 = require("./mlClient");
class ProcessorService {
    batchSize = 500;
    /* =======================================================
       MAIN FILE PROCESSOR
       ======================================================= */
    async processFile(fileId, filePath, _totalRows) {
        const startedAt = new Date();
        logger_1.logger.info(`[ProcessorService] Starting processing | file=${fileId}`);
        try {
            /* ---------------------------------------------------
               Check uploaded file
               --------------------------------------------------- */
            if (!fs_1.default.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            /* ---------------------------------------------------
               Get file metadata from DB
               --------------------------------------------------- */
            const fileRecord = await prisma_1.prisma.processingFile.findUnique({
                where: {
                    id: fileId,
                },
                select: {
                    fileType: true,
                    predictedDurationMs: true,
                },
            });
            if (!fileRecord) {
                throw new Error(`Processing file not found: ${fileId}`);
            }
            const fileType = fileRecord.fileType;
            const fileStats = await fs_1.default.promises.stat(filePath);
            const fileSizeBytes = fileStats.size;
            logger_1.logger.info(`[ProcessorService] File metadata | ` +
                `file=${fileId} | ` +
                `type=${fileType} | ` +
                `size=${fileSizeBytes}`);
            /* ===================================================
               MARK PROCESSING
               =================================================== */
            await prisma_1.prisma.processingFile.update({
                where: {
                    id: fileId,
                },
                data: {
                    status: 'PROCESSING',
                    startedAt,
                    progress: 0,
                    processedRows: 0,
                    successfulRows: 0,
                    failedRows: 0,
                    errorMessage: null,
                },
            });
            (0, socket_1.emitFileProgress)(fileId, 0, 'PROCESSING', {
                processedRows: 0,
                validRows: 0,
                rejectedRows: 0,
                anomalyCount: 0,
            });
            /* ===================================================
               STREAM FILE
               =================================================== */
            const stats = await this.streamAndProcessFile(fileId, fileType, filePath, fileSizeBytes);
            logger_1.logger.info(`[ProcessorService] CSV stream complete | ` +
                `file=${fileId} | ` +
                `processed=${stats.processedRows} | ` +
                `valid=${stats.validRows} | ` +
                `rejected=${stats.rejectedRows} | ` +
                `batchAnomalies=${stats.anomalyCount}`);
            /* ===================================================
               FINISH LAYER 2 FILE SESSION
               =================================================== */
            /**
             * The Python anomaly service stores rows across
             * different batches for this file.
             *
             * Calling /finish allows it to detect:
             *
             * TXN_VELOCITY
             * PAYMENT_BURST
             * NEAR_DUPLICATE
             * RATE_JUMP
             * STALE_RATE
             * INVERTED_SPREAD
             * etc.
             */
            logger_1.logger.info(`[ProcessorService] Calling ML /anomaly/finish | file=${fileId}`);
            const finishResult = await mlClient_1.mlClient.finishAnomalyFile(fileId);
            logger_1.logger.info(`[ProcessorService] ML /finish returned | ` +
                `file=${fileId} | ` +
                `anomalies=${finishResult.count}`);
            await this.saveAnomalyFlags(fileId, finishResult.flags, stats);
            /* ===================================================
               CALCULATE PROCESSING TIME
               =================================================== */
            const completedAt = new Date();
            const actualDurationMs = completedAt.getTime() -
                startedAt.getTime();
            /* ===================================================
               BUILD FILE HISTORY FOR FILE-LEVEL ML
               =================================================== */
            const previousFiles = await prisma_1.prisma.processingFile.findMany({
                where: {
                    id: {
                        not: fileId,
                    },
                    fileType,
                    completedAt: {
                        not: null,
                    },
                },
                orderBy: {
                    completedAt: 'desc',
                },
                take: 50,
                select: {
                    fileType: true,
                    sizeBytes: true,
                    totalRows: true,
                    failedRows: true,
                    actualDurationMs: true,
                    predictedDurationMs: true,
                },
            });
            const history = previousFiles.map((previous) => ({
                file_type: previous.fileType,
                size_bytes: Number(previous.sizeBytes),
                total_records: previous.totalRows,
                rejected_records: previous.failedRows,
                actual_seconds: previous.actualDurationMs !=
                    null
                    ? previous.actualDurationMs /
                        1000
                    : undefined,
                predicted_seconds: previous.predictedDurationMs !=
                    null
                    ? previous.predictedDurationMs /
                        1000
                    : undefined,
            }));
            /* ===================================================
               FILE LEVEL ANOMALY DETECTION
               =================================================== */
            const currentFileFeatures = {
                file_type: fileType,
                size_bytes: fileSizeBytes,
                total_records: stats.processedRows,
                rejected_records: stats.rejectedRows,
                actual_seconds: actualDurationMs /
                    1000,
                predicted_seconds: fileRecord.predictedDurationMs !=
                    null
                    ? fileRecord.predictedDurationMs /
                        1000
                    : undefined,
            };
            logger_1.logger.info(`[ProcessorService] Calling ML /anomaly/file-level | ` +
                `file=${fileId} | ` +
                `history=${history.length}`);
            const fileLevelResult = await mlClient_1.mlClient.detectFileAnomalies(currentFileFeatures, history);
            logger_1.logger.info(`[ProcessorService] ML /file-level returned | ` +
                `file=${fileId} | ` +
                `anomalies=${fileLevelResult.count}`);
            await this.saveAnomalyFlags(fileId, fileLevelResult.flags, stats);
            /* ===================================================
               FINAL FILE STATUS
               =================================================== */
            /**
             * Layer 2 anomalies DO NOT reject the file.
             *
             * Only deterministic Layer 1 validation failures
             * move it to NEEDS_REVIEW.
             */
            const finalStatus = stats.rejectedRows >
                0
                ? 'NEEDS_REVIEW'
                : 'COMPLETED';
            /* ===================================================
               SAVE FINAL RESULT
               =================================================== */
            await prisma_1.prisma.processingFile.update({
                where: {
                    id: fileId,
                },
                data: {
                    status: finalStatus,
                    progress: 100,
                    recordCount: stats.processedRows,
                    totalRows: stats.processedRows,
                    processedRows: stats.processedRows,
                    successfulRows: stats.validRows,
                    failedRows: stats.rejectedRows,
                    completedAt,
                    actualDurationMs,
                    errorMessage: null,
                },
            });
            (0, socket_1.emitFileProgress)(fileId, 100, finalStatus, {
                processedRows: stats.processedRows,
                validRows: stats.validRows,
                rejectedRows: stats.rejectedRows,
                anomalyCount: stats.anomalyCount,
                actualDurationMs,
            });
            logger_1.logger.info(`[ProcessorService] Completed | ` +
                `file=${fileId} | ` +
                `status=${finalStatus} | ` +
                `processed=${stats.processedRows} | ` +
                `valid=${stats.validRows} | ` +
                `rejected=${stats.rejectedRows} | ` +
                `anomalies=${stats.anomalyCount} | ` +
                `durationMs=${actualDurationMs}`);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Unknown processing error';
            const completedAt = new Date();
            const actualDurationMs = completedAt.getTime() -
                startedAt.getTime();
            logger_1.logger.error(`[ProcessorService] FAILED | ` +
                `file=${fileId} | ` +
                `error=${message}`, error);
            /* ---------------------------------------------------
               Best-effort ML session cleanup
               --------------------------------------------------- */
            try {
                await mlClient_1.mlClient.finishAnomalyFile(fileId);
            }
            catch (mlCleanupError) {
                logger_1.logger.warn(`[ProcessorService] ML cleanup failed | file=${fileId}`, mlCleanupError);
            }
            /* ---------------------------------------------------
               Mark file failed
               --------------------------------------------------- */
            try {
                await prisma_1.prisma.processingFile.update({
                    where: {
                        id: fileId,
                    },
                    data: {
                        status: 'FAILED',
                        completedAt,
                        actualDurationMs,
                        errorMessage: message,
                    },
                });
            }
            catch (databaseError) {
                logger_1.logger.error(`[ProcessorService] Failed updating FAILED status | file=${fileId}`, databaseError);
            }
            (0, socket_1.emitFileProgress)(fileId, 0, 'FAILED', {
                error: message,
            });
            throw error;
        }
    }
    /* =======================================================
       STREAM CSV
       ======================================================= */
    async streamAndProcessFile(fileId, fileType, filePath, fileSizeBytes) {
        return new Promise((resolve, reject) => {
            const stats = {
                processedRows: 0,
                validRows: 0,
                rejectedRows: 0,
                anomalyCount: 0,
            };
            let batch = [];
            /**
             * Batches for one file must run sequentially
             * because the Python anomaly service keeps
             * one stateful detector per file.
             */
            let processing = Promise.resolve();
            const fileStream = fs_1.default.createReadStream(filePath);
            const csvStream = fileStream.pipe((0, csv_parser_1.default)({
                mapHeaders: ({ header, }) => header
                    .trim()
                    .toLowerCase()
                    .replace(/\s+/g, '_'),
            }));
            /* ---------------------------------------------------
               CSV row
               --------------------------------------------------- */
            csvStream.on('data', (record) => {
                csvStream.pause();
                batch.push(record);
                if (batch.length >=
                    this.batchSize) {
                    const currentBatch = batch;
                    batch = [];
                    processing =
                        processing
                            .then(() => this.processBatch(fileId, fileType, currentBatch, stats))
                            .then(() => this.updateProgress(fileId, fileStream.bytesRead, fileSizeBytes, stats))
                            .then(() => {
                            csvStream.resume();
                        })
                            .catch((processingError) => {
                            csvStream.destroy(processingError);
                        });
                }
                else {
                    csvStream.resume();
                }
            });
            /* ---------------------------------------------------
               CSV complete
               --------------------------------------------------- */
            csvStream.on('end', () => {
                processing
                    .then(async () => {
                    if (batch.length >
                        0) {
                        await this.processBatch(fileId, fileType, batch, stats);
                        await this.updateProgress(fileId, fileSizeBytes, fileSizeBytes, stats);
                    }
                    resolve(stats);
                })
                    .catch(reject);
            });
            csvStream.on('error', reject);
            fileStream.on('error', reject);
        });
    }
    /* =======================================================
       PROCESS ONE BATCH
       ======================================================= */
    async processBatch(fileId, fileType, records, stats) {
        const validRecords = [];
        /**
         * These correspond exactly with validRecords.
         *
         * They allow Python's internal row indexes
         * to be mapped back to the original CSV rows.
         */
        const validRowNumbers = [];
        const faultLogs = [];
        logger_1.logger.info(`[ProcessorService] Processing batch | ` +
            `file=${fileId} | ` +
            `type=${fileType} | ` +
            `batchRows=${records.length}`);
        /* =====================================================
           LAYER 1 VALIDATION
           ===================================================== */
        for (const record of records) {
            stats.processedRows++;
            /**
             * Line 1 = CSV header.
             *
             * First actual record therefore lives on CSV row 2.
             */
            const rowNumber = stats.processedRows +
                1;
            const validation = await validator_1.validatorService.validateRecord(record);
            /* ---------------------------------------------------
               Invalid row
               --------------------------------------------------- */
            if (!validation.isValid) {
                stats.rejectedRows++;
                logger_1.logger.debug(`[ProcessorService] Validation rejected | ` +
                    `file=${fileId} | ` +
                    `row=${rowNumber} | ` +
                    `errors=${validation.errors.join(', ')}`);
                for (const issue of validation.issues) {
                    faultLogs.push({
                        fileId,
                        rowNumber,
                        columnName: issue.columnName,
                        cellValue: issue.cellValue ??
                            null,
                        errorMessage: issue.errorMessage,
                        errorType: issue.errorType,
                        rawRowData: record,
                        status: 'PENDING',
                    });
                }
                /**
                 * Invalid records must not be passed
                 * to Layer 2.
                 */
                continue;
            }
            /* ---------------------------------------------------
               Valid row
               --------------------------------------------------- */
            stats.validRows++;
            validRecords.push(record);
            validRowNumbers.push(rowNumber);
        }
        logger_1.logger.info(`[ProcessorService] Batch validated | ` +
            `file=${fileId} | ` +
            `valid=${validRecords.length} | ` +
            `invalid=${records.length - validRecords.length}`);
        /* =====================================================
           SAVE LAYER 1 VALIDATION FAILURES
           ===================================================== */
        if (faultLogs.length >
            0) {
            await prisma_1.prisma.faultLog.createMany({
                data: faultLogs,
            });
            logger_1.logger.info(`[ProcessorService] Saved ${faultLogs.length} validation faults | file=${fileId}`);
        }
        if (validRecords.length ===
            0) {
            logger_1.logger.info(`[ProcessorService] No valid rows for Layer 2 | file=${fileId}`);
            return;
        }
        /* =====================================================
           LAYER 2 ML ANOMALY DETECTION
    
           IMPORTANT:
           This happens BEFORE loaderService.
    
           That means a DB FK/load failure cannot prevent
           the uploaded records from reaching the ML service.
           ===================================================== */
        logger_1.logger.info(`[ProcessorService] Sending rows to ML /anomaly/detect-batch | ` +
            `file=${fileId} | ` +
            `type=${fileType} | ` +
            `rows=${validRecords.length} | ` +
            `firstRow=${validRowNumbers[0]} | ` +
            `lastRow=${validRowNumbers[validRowNumbers.length - 1]}`);
        const anomalyResult = await mlClient_1.mlClient.detectAnomalyBatch(fileId, fileType, validRecords, validRowNumbers);
        logger_1.logger.info(`[ProcessorService] ML batch response | ` +
            `file=${fileId} | ` +
            `count=${anomalyResult.count} | ` +
            `flags=${anomalyResult.flags.length}`);
        await this.saveAnomalyFlags(fileId, anomalyResult.flags, stats);
        /* =====================================================
           LOAD VALID ROWS
    
           Only after Layer 2 has inspected them.
           ===================================================== */
        logger_1.logger.info(`[ProcessorService] Loading ${validRecords.length} valid rows | file=${fileId}`);
        await loader_1.loaderService.loadValidRecords(fileId, validRecords);
        logger_1.logger.info(`[ProcessorService] Batch load complete | file=${fileId}`);
    }
    /* =======================================================
       STORE ANOMALY FLAGS
       ======================================================= */
    async saveAnomalyFlags(fileId, flags, stats) {
        if (flags.length ===
            0) {
            logger_1.logger.debug(`[ProcessorService] No anomaly flags to save | file=${fileId}`);
            return;
        }
        await prisma_1.prisma.anomaly.createMany({
            data: flags.map((flag) => ({
                fileId,
                rowNumber: flag.row_number ??
                    null,
                anomalyType: flag.anomaly_type,
                description: flag.explanation,
                score: flag.score,
                details: {
                    rule_ref: flag.rule_ref,
                    method: flag.method,
                    level: flag.level,
                },
            })),
        });
        stats.anomalyCount +=
            flags.length;
        logger_1.logger.info(`[ProcessorService] Saved ML anomalies | ` +
            `file=${fileId} | ` +
            `count=${flags.length} | ` +
            `total=${stats.anomalyCount}`);
        for (const flag of flags) {
            logger_1.logger.info(`[ProcessorService] ML anomaly | ` +
                `file=${fileId} | ` +
                `row=${flag.row_number ?? 'FILE'} | ` +
                `type=${flag.anomaly_type} | ` +
                `score=${flag.score} | ` +
                `method=${flag.method}`);
        }
    }
    /* =======================================================
       UPDATE FILE PROGRESS
       ======================================================= */
    async updateProgress(fileId, bytesRead, totalBytes, stats) {
        let progress = 0;
        if (totalBytes >
            0) {
            progress =
                Math.floor((bytesRead /
                    totalBytes) *
                    100);
        }
        /**
         * Final 100% is reserved for final success.
         */
        progress =
            Math.min(progress, 99);
        await prisma_1.prisma.processingFile.update({
            where: {
                id: fileId,
            },
            data: {
                progress,
                processedRows: stats.processedRows,
                successfulRows: stats.validRows,
                failedRows: stats.rejectedRows,
            },
        });
        (0, socket_1.emitFileProgress)(fileId, progress, 'PROCESSING', {
            processedRows: stats.processedRows,
            validRows: stats.validRows,
            rejectedRows: stats.rejectedRows,
            anomalyCount: stats.anomalyCount,
        });
    }
}
exports.ProcessorService = ProcessorService;
exports.processorService = new ProcessorService();
