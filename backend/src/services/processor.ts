import fs from 'fs';
import csv from 'csv-parser';

import {
  Prisma,
  FileType,
} from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

import {
  emitFileProgress,
} from '../sockets/socket';

import {
  validatorService,
} from './validator';

import {
  loaderService,
} from './loader';

import {
  mlClient,
  type AnomalyFlag,
  type FileAnomalyFeatures,
} from './mlClient';

type CsvRecord =
  Record<string, string>;

interface ProcessingStats {
  processedRows: number;
  validRows: number;
  rejectedRows: number;
  anomalyCount: number;
}

export class ProcessorService {
  private readonly batchSize =
    500;

  /* =======================================================
     MAIN FILE PROCESSOR
     ======================================================= */

  async processFile(
    fileId: string,
    filePath: string,
    _totalRows?: number
  ): Promise<void> {
    const startedAt =
      new Date();

    logger.info(
      `[ProcessorService] Starting processing | file=${fileId}`
    );

    try {
      /* ---------------------------------------------------
         Check uploaded file
         --------------------------------------------------- */

      if (
        !fs.existsSync(
          filePath
        )
      ) {
        throw new Error(
          `File not found: ${filePath}`
        );
      }

      /* ---------------------------------------------------
         Get file metadata from DB
         --------------------------------------------------- */

      const fileRecord =
        await prisma.processingFile.findUnique({
          where: {
            id: fileId,
          },

          select: {
            fileType: true,
            predictedDurationMs:
              true,
          },
        });

      if (!fileRecord) {
        throw new Error(
          `Processing file not found: ${fileId}`
        );
      }

      const fileType =
        fileRecord.fileType;

      const fileStats =
        await fs.promises.stat(
          filePath
        );

      const fileSizeBytes =
        fileStats.size;

      logger.info(
        `[ProcessorService] File metadata | ` +
          `file=${fileId} | ` +
          `type=${fileType} | ` +
          `size=${fileSizeBytes}`
      );

      /* ===================================================
         MARK PROCESSING
         =================================================== */

      await prisma.processingFile.update({
        where: {
          id: fileId,
        },

        data: {
          status:
            'PROCESSING',

          startedAt,

          progress: 0,

          processedRows: 0,

          successfulRows: 0,

          failedRows: 0,

          errorMessage:
            null,
        },
      });

      emitFileProgress(
        fileId,
        0,
        'PROCESSING',
        {
          processedRows: 0,
          validRows: 0,
          rejectedRows: 0,
          anomalyCount: 0,
        }
      );

      /* ===================================================
         STREAM FILE
         =================================================== */

      const stats =
        await this.streamAndProcessFile(
          fileId,
          fileType,
          filePath,
          fileSizeBytes
        );

      logger.info(
        `[ProcessorService] CSV stream complete | ` +
          `file=${fileId} | ` +
          `processed=${stats.processedRows} | ` +
          `valid=${stats.validRows} | ` +
          `rejected=${stats.rejectedRows} | ` +
          `batchAnomalies=${stats.anomalyCount}`
      );

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

      logger.info(
        `[ProcessorService] Calling ML /anomaly/finish | file=${fileId}`
      );

      const finishResult =
        await mlClient.finishAnomalyFile(
          fileId
        );

      logger.info(
        `[ProcessorService] ML /finish returned | ` +
          `file=${fileId} | ` +
          `anomalies=${finishResult.count}`
      );

      await this.saveAnomalyFlags(
        fileId,
        finishResult.flags,
        stats
      );

      /* ===================================================
         CALCULATE PROCESSING TIME
         =================================================== */

      const completedAt =
        new Date();

      const actualDurationMs =
        completedAt.getTime() -
        startedAt.getTime();

      /* ===================================================
         BUILD FILE HISTORY FOR FILE-LEVEL ML
         =================================================== */

      const previousFiles =
        await prisma.processingFile.findMany({
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
            completedAt:
              'desc',
          },

          take: 50,

          select: {
            fileType: true,

            sizeBytes: true,

            totalRows: true,

            failedRows: true,

            actualDurationMs:
              true,

            predictedDurationMs:
              true,
          },
        });

      const history:
        FileAnomalyFeatures[] =
        previousFiles.map(
          (
            previous
          ) => ({
            file_type:
              previous.fileType,

            size_bytes:
              Number(
                previous.sizeBytes
              ),

            total_records:
              previous.totalRows,

            rejected_records:
              previous.failedRows,

            actual_seconds:
              previous.actualDurationMs !=
              null
                ? previous.actualDurationMs /
                  1000
                : undefined,

            predicted_seconds:
              previous.predictedDurationMs !=
              null
                ? previous.predictedDurationMs /
                  1000
                : undefined,
          })
        );

      /* ===================================================
         FILE LEVEL ANOMALY DETECTION
         =================================================== */

      const currentFileFeatures:
        FileAnomalyFeatures =
        {
          file_type:
            fileType,

          size_bytes:
            fileSizeBytes,

          total_records:
            stats.processedRows,

          rejected_records:
            stats.rejectedRows,

          actual_seconds:
            actualDurationMs /
            1000,

          predicted_seconds:
            fileRecord.predictedDurationMs !=
            null
              ? fileRecord.predictedDurationMs /
                1000
              : undefined,
        };

      logger.info(
        `[ProcessorService] Calling ML /anomaly/file-level | ` +
          `file=${fileId} | ` +
          `history=${history.length}`
      );

      const fileLevelResult =
        await mlClient.detectFileAnomalies(
          currentFileFeatures,
          history
        );

      logger.info(
        `[ProcessorService] ML /file-level returned | ` +
          `file=${fileId} | ` +
          `anomalies=${fileLevelResult.count}`
      );

      await this.saveAnomalyFlags(
        fileId,
        fileLevelResult.flags,
        stats
      );

      /* ===================================================
         FINAL FILE STATUS
         =================================================== */

      /**
       * Layer 2 anomalies DO NOT reject the file.
       *
       * Only deterministic Layer 1 validation failures
       * move it to NEEDS_REVIEW.
       */

      const finalStatus =
        stats.rejectedRows >
        0
          ? 'NEEDS_REVIEW'
          : 'COMPLETED';

      /* ===================================================
         SAVE FINAL RESULT
         =================================================== */

      await prisma.processingFile.update({
        where: {
          id: fileId,
        },

        data: {
          status:
            finalStatus,

          progress:
            100,

          recordCount:
            stats.processedRows,

          totalRows:
            stats.processedRows,

          processedRows:
            stats.processedRows,

          successfulRows:
            stats.validRows,

          failedRows:
            stats.rejectedRows,

          completedAt,

          actualDurationMs,

          errorMessage:
            null,
        },
      });

      emitFileProgress(
        fileId,
        100,
        finalStatus,
        {
          processedRows:
            stats.processedRows,

          validRows:
            stats.validRows,

          rejectedRows:
            stats.rejectedRows,

          anomalyCount:
            stats.anomalyCount,

          actualDurationMs,
        }
      );

      logger.info(
        `[ProcessorService] Completed | ` +
          `file=${fileId} | ` +
          `status=${finalStatus} | ` +
          `processed=${stats.processedRows} | ` +
          `valid=${stats.validRows} | ` +
          `rejected=${stats.rejectedRows} | ` +
          `anomalies=${stats.anomalyCount} | ` +
          `durationMs=${actualDurationMs}`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown processing error';

      const completedAt =
        new Date();

      const actualDurationMs =
        completedAt.getTime() -
        startedAt.getTime();

      logger.error(
        `[ProcessorService] FAILED | ` +
          `file=${fileId} | ` +
          `error=${message}`,
        error
      );

      /* ---------------------------------------------------
         Best-effort ML session cleanup
         --------------------------------------------------- */

      try {
        await mlClient.finishAnomalyFile(
          fileId
        );
      } catch (
        mlCleanupError
      ) {
        logger.warn(
          `[ProcessorService] ML cleanup failed | file=${fileId}`,
          mlCleanupError
        );
      }

      /* ---------------------------------------------------
         Mark file failed
         --------------------------------------------------- */

      try {
        await prisma.processingFile.update({
          where: {
            id: fileId,
          },

          data: {
            status:
              'FAILED',

            completedAt,

            actualDurationMs,

            errorMessage:
              message,
          },
        });
      } catch (
        databaseError
      ) {
        logger.error(
          `[ProcessorService] Failed updating FAILED status | file=${fileId}`,
          databaseError
        );
      }

      emitFileProgress(
        fileId,
        0,
        'FAILED',
        {
          error:
            message,
        }
      );

      throw error;
    }
  }

  /* =======================================================
     STREAM CSV
     ======================================================= */

  private async streamAndProcessFile(
    fileId: string,
    fileType: FileType,
    filePath: string,
    fileSizeBytes: number
  ): Promise<ProcessingStats> {
    return new Promise(
      (
        resolve,
        reject
      ) => {
        const stats:
          ProcessingStats =
        {
          processedRows: 0,
          validRows: 0,
          rejectedRows: 0,
          anomalyCount: 0,
        };

        let batch:
          CsvRecord[] =
          [];

        /**
         * Batches for one file must run sequentially
         * because the Python anomaly service keeps
         * one stateful detector per file.
         */
        let processing =
          Promise.resolve();

        const fileStream =
          fs.createReadStream(
            filePath
          );

        const csvStream =
          fileStream.pipe(
            csv({
              mapHeaders: ({
                header,
              }) =>
                header
                  .trim()
                  .toLowerCase()
                  .replace(
                    /\s+/g,
                    '_'
                  ),
            })
          );

        /* ---------------------------------------------------
           CSV row
           --------------------------------------------------- */

        csvStream.on(
          'data',
          (
            record:
              CsvRecord
          ) => {
            csvStream.pause();

            batch.push(
              record
            );

            if (
              batch.length >=
              this.batchSize
            ) {
              const currentBatch =
                batch;

              batch = [];

              processing =
                processing
                  .then(
                    () =>
                      this.processBatch(
                        fileId,
                        fileType,
                        currentBatch,
                        stats
                      )
                  )
                  .then(
                    () =>
                      this.updateProgress(
                        fileId,
                        fileStream.bytesRead,
                        fileSizeBytes,
                        stats
                      )
                  )
                  .then(
                    () => {
                      csvStream.resume();
                    }
                  )
                  .catch(
                    (
                      processingError
                    ) => {
                      csvStream.destroy(
                        processingError
                      );
                    }
                  );
            } else {
              csvStream.resume();
            }
          }
        );

        /* ---------------------------------------------------
           CSV complete
           --------------------------------------------------- */

        csvStream.on(
          'end',
          () => {
            processing
              .then(
                async () => {
                  if (
                    batch.length >
                    0
                  ) {
                    await this.processBatch(
                      fileId,
                      fileType,
                      batch,
                      stats
                    );

                    await this.updateProgress(
                      fileId,
                      fileSizeBytes,
                      fileSizeBytes,
                      stats
                    );
                  }

                  resolve(
                    stats
                  );
                }
              )
              .catch(
                reject
              );
          }
        );

        csvStream.on(
          'error',
          reject
        );

        fileStream.on(
          'error',
          reject
        );
      }
    );
  }

  /* =======================================================
     PROCESS ONE BATCH
     ======================================================= */

  private async processBatch(
    fileId: string,
    fileType: FileType,
    records:
      CsvRecord[],
    stats:
      ProcessingStats
  ): Promise<void> {
    const validRecords:
      Array<
        Record<
          string,
          unknown
        >
      > = [];

    /**
     * These correspond exactly with validRecords.
     *
     * They allow Python's internal row indexes
     * to be mapped back to the original CSV rows.
     */
    const validRowNumbers:
      number[] =
      [];

    const faultLogs:
      Prisma.FaultLogCreateManyInput[] =
      [];

    logger.info(
      `[ProcessorService] Processing batch | ` +
        `file=${fileId} | ` +
        `type=${fileType} | ` +
        `batchRows=${records.length}`
    );

    /* =====================================================
       LAYER 1 VALIDATION
       ===================================================== */

    for (
      const record of
      records
    ) {
      stats.processedRows++;

      /**
       * Line 1 = CSV header.
       *
       * First actual record therefore lives on CSV row 2.
       */
      const rowNumber =
        stats.processedRows +
        1;

      const validation =
        await validatorService.validateRecord(
          record
        );

      /* ---------------------------------------------------
         Invalid row
         --------------------------------------------------- */

      if (
        !validation.isValid
      ) {
        stats.rejectedRows++;

        logger.debug(
          `[ProcessorService] Validation rejected | ` +
            `file=${fileId} | ` +
            `row=${rowNumber} | ` +
            `errors=${validation.errors.join(
              ', '
            )}`
        );

        for (
          const issue of
          validation.issues
        ) {
          faultLogs.push({
            fileId,

            rowNumber,

            columnName:
              issue.columnName,

            cellValue:
              issue.cellValue ??
              null,

            errorMessage:
              issue.errorMessage,

            errorType:
              issue.errorType,

            rawRowData:
              record as
                Prisma.InputJsonValue,

            status:
              'PENDING',
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

      validRecords.push(
        record
      );

      validRowNumbers.push(
        rowNumber
      );
    }

    logger.info(
      `[ProcessorService] Batch validated | ` +
        `file=${fileId} | ` +
        `valid=${validRecords.length} | ` +
        `invalid=${records.length - validRecords.length}`
    );

    /* =====================================================
       SAVE LAYER 1 VALIDATION FAILURES
       ===================================================== */

    if (
      faultLogs.length >
      0
    ) {
      await prisma.faultLog.createMany({
        data:
          faultLogs,
      });

      logger.info(
        `[ProcessorService] Saved ${faultLogs.length} validation faults | file=${fileId}`
      );
    }

    if (
      validRecords.length ===
      0
    ) {
      logger.info(
        `[ProcessorService] No valid rows for Layer 2 | file=${fileId}`
      );

      return;
    }

    /* =====================================================
       LAYER 2 ML ANOMALY DETECTION

       IMPORTANT:
       This happens BEFORE loaderService.

       That means a DB FK/load failure cannot prevent
       the uploaded records from reaching the ML service.
       ===================================================== */

    logger.info(
      `[ProcessorService] Sending rows to ML /anomaly/detect-batch | ` +
        `file=${fileId} | ` +
        `type=${fileType} | ` +
        `rows=${validRecords.length} | ` +
        `firstRow=${validRowNumbers[0]} | ` +
        `lastRow=${validRowNumbers[validRowNumbers.length - 1]}`
    );

    const anomalyResult =
      await mlClient.detectAnomalyBatch(
        fileId,
        fileType,
        validRecords,
        validRowNumbers
      );

    logger.info(
      `[ProcessorService] ML batch response | ` +
        `file=${fileId} | ` +
        `count=${anomalyResult.count} | ` +
        `flags=${anomalyResult.flags.length}`
    );

    await this.saveAnomalyFlags(
      fileId,
      anomalyResult.flags,
      stats
    );

    /* =====================================================
       LOAD VALID ROWS

       Only after Layer 2 has inspected them.
       ===================================================== */

    logger.info(
      `[ProcessorService] Loading ${validRecords.length} valid rows | file=${fileId}`
    );

    await loaderService.loadValidRecords(
      fileId,
      validRecords
    );

    logger.info(
      `[ProcessorService] Batch load complete | file=${fileId}`
    );
  }

  /* =======================================================
     STORE ANOMALY FLAGS
     ======================================================= */

  private async saveAnomalyFlags(
    fileId: string,
    flags:
      AnomalyFlag[],
    stats:
      ProcessingStats
  ): Promise<void> {
    if (
      flags.length ===
      0
    ) {
      logger.debug(
        `[ProcessorService] No anomaly flags to save | file=${fileId}`
      );

      return;
    }

    await prisma.anomaly.createMany({
      data:
        flags.map(
          (
            flag
          ) => ({
            fileId,

            rowNumber:
              flag.row_number ??
              null,

            anomalyType:
              flag.anomaly_type,

            description:
              flag.explanation,

            score:
              flag.score,

            details: {
              rule_ref:
                flag.rule_ref,

              method:
                flag.method,

              level:
                flag.level,
            } as
              Prisma.InputJsonValue,
          })
        ),
    });

    stats.anomalyCount +=
      flags.length;

    logger.info(
      `[ProcessorService] Saved ML anomalies | ` +
        `file=${fileId} | ` +
        `count=${flags.length} | ` +
        `total=${stats.anomalyCount}`
    );

    for (
      const flag of
      flags
    ) {
      logger.info(
        `[ProcessorService] ML anomaly | ` +
          `file=${fileId} | ` +
          `row=${flag.row_number ?? 'FILE'} | ` +
          `type=${flag.anomaly_type} | ` +
          `score=${flag.score} | ` +
          `method=${flag.method}`
      );
    }
  }

  /* =======================================================
     UPDATE FILE PROGRESS
     ======================================================= */

  private async updateProgress(
    fileId: string,
    bytesRead: number,
    totalBytes: number,
    stats:
      ProcessingStats
  ): Promise<void> {
    let progress =
      0;

    if (
      totalBytes >
      0
    ) {
      progress =
        Math.floor(
          (
            bytesRead /
            totalBytes
          ) *
            100
        );
    }

    /**
     * Final 100% is reserved for final success.
     */
    progress =
      Math.min(
        progress,
        99
      );

    await prisma.processingFile.update({
      where: {
        id: fileId,
      },

      data: {
        progress,

        processedRows:
          stats.processedRows,

        successfulRows:
          stats.validRows,

        failedRows:
          stats.rejectedRows,
      },
    });

    emitFileProgress(
      fileId,
      progress,
      'PROCESSING',
      {
        processedRows:
          stats.processedRows,

        validRows:
          stats.validRows,

        rejectedRows:
          stats.rejectedRows,

        anomalyCount:
          stats.anomalyCount,
      }
    );
  }
}

export const processorService =
  new ProcessorService();