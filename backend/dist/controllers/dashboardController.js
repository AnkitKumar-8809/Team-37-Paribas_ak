"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardSummary = void 0;
const prisma_1 = require("../db/prisma");
const logger_1 = require("../utils/logger");
const fileWorker_1 = require("../workers/fileWorker");
const client_1 = require("@prisma/client");
/**
 * GET /api/dashboard/summary
 *
 * Returns live dashboard statistics from PostgreSQL.
 */
const getDashboardSummary = async (_req, res) => {
    try {
        const [totalFiles, queuedFiles, activeProcessing, completedFiles, failedFiles, needsReviewFiles, totalRejections, pendingRejections, totalAnomalies, processingStats,] = await Promise.all([
            prisma_1.prisma.processingFile.count(),
            prisma_1.prisma.processingFile.count({
                where: {
                    status: 'QUEUED',
                },
            }),
            prisma_1.prisma.processingFile.count({
                where: {
                    status: 'PROCESSING',
                },
            }),
            prisma_1.prisma.processingFile.count({
                where: {
                    status: 'COMPLETED',
                },
            }),
            prisma_1.prisma.processingFile.count({
                where: {
                    status: 'FAILED',
                },
            }),
            prisma_1.prisma.processingFile.count({
                where: {
                    status: 'NEEDS_REVIEW',
                },
            }),
            prisma_1.prisma.faultLog.count(),
            prisma_1.prisma.faultLog.count({
                where: {
                    status: 'PENDING',
                },
            }),
            prisma_1.prisma.anomaly.count(),
            prisma_1.prisma.processingFile.aggregate({
                where: {
                    status: {
                        in: [
                            'COMPLETED',
                            'NEEDS_REVIEW',
                        ],
                    },
                },
                _sum: {
                    successfulRows: true,
                    actualDurationMs: true,
                },
                _avg: {
                    actualDurationMs: true,
                },
            }),
        ]);
        const [fileTypeGroups, recentFileRecords, processingTimeHistory,] = await Promise.all([
            prisma_1.prisma.processingFile.groupBy({
                by: ['fileType'],
                _count: {
                    _all: true,
                },
            }),
            prisma_1.prisma.processingFile.findMany({
                orderBy: {
                    receivedAt: 'desc',
                },
                take: 10,
                select: {
                    fileName: true,
                    originalName: true,
                    fileType: true,
                    status: true,
                    sizeBytes: true,
                    progress: true,
                    predictedDurationMs: true,
                    actualDurationMs: true,
                    receivedAt: true,
                    startedAt: true,
                    completedAt: true,
                    successfulRows: true,
                    failedRows: true,
                    _count: {
                        select: {
                            anomalies: true,
                            faultLogs: true,
                        },
                    },
                },
            }),
            prisma_1.prisma.$queryRaw(client_1.Prisma.sql `
        SELECT
          DATE_TRUNC('hour', "completedAt") AS time,
          AVG("actualDurationMs")::float8 AS actual,
          AVG("predictedDurationMs")::float8 AS predicted
        FROM "ProcessingFile"
        WHERE "completedAt" IS NOT NULL
          AND "completedAt" >= NOW() - INTERVAL '24 hours'
          AND (
            "actualDurationMs" IS NOT NULL
            OR "predictedDurationMs" IS NOT NULL
          )
        GROUP BY DATE_TRUNC('hour', "completedAt")
        ORDER BY time ASC
      `),
        ]);
        const fileTypeStats = fileTypeGroups.map((group) => ({
            type: group.fileType,
            files: group._count
                ._all,
        }));
        const recentFiles = recentFileRecords.map((file) => ({
            fileName: file.fileName,
            originalName: file.originalName ||
                file.fileName,
            fileType: file.fileType,
            status: file.status,
            sizeBytes: Number(file.sizeBytes),
            progress: file.progress,
            predictedDurationMs: file.predictedDurationMs,
            actualDurationMs: file.actualDurationMs,
            receivedAt: file.receivedAt
                ? file.receivedAt.toISOString()
                : null,
            startedAt: file.startedAt
                ? file.startedAt.toISOString()
                : null,
            completedAt: file.completedAt
                ? file.completedAt.toISOString()
                : null,
            successfulRows: file.successfulRows,
            failedRows: file.failedRows,
            anomaliesCount: file._count
                ?.anomalies ??
                0,
            faultLogsCount: file._count
                ?.faultLogs ??
                0,
        }));
        let formattedProcessingTimeHistory = processingTimeHistory.map((point) => ({
            time: point.time.toISOString(),
            actual: point.actual,
            predicted: point.predicted,
        }));
        if (formattedProcessingTimeHistory.length ===
            0) {
            const recentCompleted = await prisma_1.prisma.processingFile.findMany({
                where: {
                    status: 'COMPLETED',
                    completedAt: {
                        not: null,
                    },
                },
                orderBy: {
                    completedAt: 'asc',
                },
                take: 10,
                select: {
                    completedAt: true,
                    actualDurationMs: true,
                    predictedDurationMs: true,
                },
            });
            formattedProcessingTimeHistory =
                recentCompleted.map((file) => ({
                    time: file.completedAt.toISOString(),
                    actual: file.actualDurationMs,
                    predicted: file.predictedDurationMs,
                }));
        }
        const successfulRows = processingStats._sum
            .successfulRows ??
            0;
        const totalDurationMs = processingStats._sum
            .actualDurationMs ??
            0;
        let systemThroughput = 0;
        if (totalDurationMs > 0) {
            systemThroughput =
                Math.round(successfulRows /
                    (totalDurationMs /
                        1000));
        }
        const averageProcessingTimeMs = Math.round(processingStats._avg
            .actualDurationMs ??
            0);
        const workerStats = fileWorker_1.fileWorker.getStats();
        const summary = {
            totalFiles,
            queuedFiles,
            activeProcessing,
            completedFiles,
            failedFiles,
            needsReviewFiles,
            totalRejections,
            pendingRejections,
            totalAnomalies,
            systemThroughput,
            averageProcessingTimeMs,
            worker: {
                activeJobs: workerStats.activeJobs,
                queuedJobs: workerStats.queuedJobs,
                maxConcurrentJobs: workerStats.maxConcurrentJobs,
                isRunning: workerStats.isRunning,
            },
            fileTypeStats,
            recentFiles,
            processingTimeHistory: formattedProcessingTimeHistory,
        };
        res.status(200).json({
            success: true,
            data: summary,
        });
    }
    catch (error) {
        logger_1.logger.error('[DashboardController] getDashboardSummary error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard summary',
        });
    }
};
exports.getDashboardSummary = getDashboardSummary;
