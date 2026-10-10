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
     MAIN PROCESSING ENTRY
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
         Read file information from PostgreSQL
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

      /* ---------------------------------------------------
         Mark PROCESSING
         --------------------------------------------------- */

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

      /* ---------------------------------------------------
         Stream + validate + load + ML batch analysis
         --------------------------------------------------- */

      const stats =
        await this.streamAndProcessFile(
          fileId,
          fileType,
          filePath,
          fileSizeBytes
        );

      /* ===================================================
         FILE-WIDE ML CHECKS
         =================================================== */

      /**
       * Important:
       *
       * The Python service stores a session across
       * batches so it can detect patterns such as:
       *
       * rapid transactions across different batches
       * near duplicates
       * rate-series anomalies
       */
      const finishResult =
        await mlClient.finishAnomalyFile(
          fileId
        );

      await this.saveAnomalyFlags(
        fileId,
        finishResult.flags,
        stats
      );

      /* ---------------------------------------------------
         Calculate real processing time
         --------------------------------------------------- */

      const completedAt =
        new Date();

      const actualDurationMs =
        completedAt.getTime() -
        startedAt.getTime();

      /* ===================================================
         FILE LEVEL ML CHECKS
         =================================================== */

      /**
       * Give the model historical files of the
       * same type so it can identify unusual:
       *
       * file sizes
       * row counts
       * rejection rates
       * processing times
       */
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
          (previous) => ({
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

      const currentFileFeatures:
        FileAnomalyFeatures = {
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

      const fileLevelResult =
        await mlClient.detectFileAnomalies(
          currentFileFeatures,
          history
        );

      await this.saveAnomalyFlags(
        fileId,
        fileLevelResult.flags,
        stats
      );

      /* ===================================================
         FINAL STATUS
         =================================================== */

      /**
       * Anomalies do NOT reject files.
       *
       * Only Layer 1 validation failures move
       * the file to NEEDS_REVIEW.
       */
      const finalStatus =
        stats.rejectedRows >
        0
          ? 'NEEDS_REVIEW'
          : 'COMPLETED';

      /* ---------------------------------------------------
         Save final file result
         --------------------------------------------------- */

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
          `anomalies=${stats.anomalyCount}`
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
        `[ProcessorService] Failed | file=${fileId} | ${message}`
      );

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
     STREAM FILE
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
          ProcessingStats = {
          processedRows: 0,
          validRows: 0,
          rejectedRows: 0,
          anomalyCount: 0,
        };

        let batch:
          CsvRecord[] = [];

        /**
         * Ensures batches from one file
         * are processed sequentially.
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
                      error
                    ) => {
                      csvStream.destroy(
                        error
                      );
                    }
                  );
            } else {
              csvStream.resume();
            }
          }
        );

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
     * Real CSV row numbers for the
     * valid rows sent to ML.
     */
    const validRowNumbers:
      number[] = [];

    const faultLogs:
      Prisma.FaultLogCreateManyInput[] =
      [];

    for (
      const record of
      records
    ) {
      stats.processedRows++;

      /**
       * CSV line 1 is header.
       *
       * First data row:
       * processedRows=1
       * rowNumber=2
       */
      const rowNumber =
        stats.processedRows +
        1;

      /* ---------------------------------------------------
         Layer 1 validation
         --------------------------------------------------- */

      const validation =
        await validatorService.validateRecord(
          record
        );

      /* ---------------------------------------------------
         INVALID ROW
         --------------------------------------------------- */

      if (
        !validation.isValid
      ) {
        stats.rejectedRows++;

        logger.debug(
          `[ProcessorService] Rejected | ` +
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
         * Invalid rows are NOT sent
         * to Layer 2 anomaly detection.
         */
        continue;
      }

      /* ---------------------------------------------------
         VALID ROW
         --------------------------------------------------- */

      stats.validRows++;

      validRecords.push(
        record
      );

      validRowNumbers.push(
        rowNumber
      );
    }

    /* ===================================================
       SAVE VALIDATION FAILURES
       =================================================== */

    if (
      faultLogs.length >
      0
    ) {
      await prisma.faultLog.createMany({
        data:
          faultLogs,
      });

      logger.info(
        `[ProcessorService] Saved ${faultLogs.length} fault logs | file=${fileId}`
      );
    }

    /* ===================================================
       LOAD VALID RECORDS
       =================================================== */

    if (
      validRecords.length >
      0
    ) {
      await loaderService.loadValidRecords(
        fileId,
        validRecords
      );
    }

    /* ===================================================
       LAYER 2 ML ANOMALY DETECTION
       =================================================== */

    if (
      validRecords.length >
      0
    ) {
      const anomalyResult =
        await mlClient.detectAnomalyBatch(
          fileId,
          fileType,
          validRecords,
          validRowNumbers
        );

      await this.saveAnomalyFlags(
        fileId,
        anomalyResult.flags,
        stats
      );
    }
  }

  /* =======================================================
     SAVE ML ANOMALIES TO PRISMA
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
      `[ProcessorService] Saved ${flags.length} ML anomaly flags | file=${fileId}`
    );
  }

  /* =======================================================
     PROGRESS
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
      totalBytes > 0
    ) {
      progress =
        Math.floor(
          (bytesRead /
            totalBytes) *
            100
        );
    }

    /**
     * 100 is reserved for
     * final completion.
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