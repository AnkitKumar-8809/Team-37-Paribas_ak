"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRejection = exports.getPendingRejections = exports.getRejections = void 0;
const prisma_1 = require("../db/prisma");
const logger_1 = require("../utils/logger");
/**
 * GET /api/resolutions/pending
 *
 * Returns all validation issues waiting for manual review.
 */
const getRejections = async (_req, res) => {
    try {
        const rejections = await prisma_1.prisma.faultLog.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                file: {
                    select: {
                        id: true,
                        fileName: true,
                        originalName: true,
                        fileType: true,
                        status: true,
                    },
                },
            },
        });
        res.status(200).json({
            success: true,
            data: rejections,
        });
    }
    catch (error) {
        logger_1.logger.error('[ResolutionController] getRejections error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch rejected records',
        });
    }
};
exports.getRejections = getRejections;
const getPendingRejections = async (_req, res) => {
    try {
        const rejections = await prisma_1.prisma.faultLog.findMany({
            where: {
                status: 'PENDING',
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                file: {
                    select: {
                        id: true,
                        fileName: true,
                        originalName: true,
                        fileType: true,
                        status: true,
                    },
                },
            },
        });
        res.status(200).json({
            success: true,
            data: rejections,
        });
    }
    catch (error) {
        logger_1.logger.error('[ResolutionController] getPendingRejections error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch pending rejections',
        });
    }
};
exports.getPendingRejections = getPendingRejections;
/**
 * POST /api/resolutions/:id/resolve
 *
 * Supported actions:
 *
 * APPROVE
 * EDIT
 * REJECT
 *
 * Example EDIT body:
 *
 * {
 *   "action": "EDIT",
 *   "correctedValue": "HDFC0001234",
 *   "reviewedBy": "admin"
 * }
 */
const resolveRejection = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, correctedValue, reviewedBy, } = req.body;
        if (!action) {
            res.status(400).json({
                success: false,
                message: 'action is required',
            });
            return;
        }
        // Find rejection
        const rejection = await prisma_1.prisma.faultLog.findUnique({
            where: {
                id,
            },
        });
        if (!rejection) {
            res.status(404).json({
                success: false,
                message: 'Rejection not found',
            });
            return;
        }
        if (rejection.status !== 'PENDING') {
            res.status(400).json({
                success: false,
                message: 'This rejection has already been resolved',
            });
            return;
        }
        const normalizedAction = String(action)
            .trim()
            .toUpperCase();
        let newStatus;
        let resolvedValue = null;
        // ---------------------------------------------
        // APPROVE AI suggestion / original correction
        // ---------------------------------------------
        if (normalizedAction === 'APPROVE') {
            newStatus = 'APPROVED';
            resolvedValue =
                correctedValue ??
                    rejection.aiSuggestion ??
                    rejection.cellValue ??
                    null;
        }
        // ---------------------------------------------
        // Manual edit
        // ---------------------------------------------
        else if (normalizedAction === 'EDIT') {
            if (correctedValue === undefined ||
                correctedValue === null ||
                String(correctedValue).trim() === '') {
                res.status(400).json({
                    success: false,
                    message: 'correctedValue is required for EDIT',
                });
                return;
            }
            newStatus = 'EDITED';
            resolvedValue =
                String(correctedValue).trim();
        }
        // ---------------------------------------------
        // Reject correction
        // ---------------------------------------------
        else if (normalizedAction === 'REJECT') {
            newStatus = 'REJECTED';
            resolvedValue = null;
        }
        // ---------------------------------------------
        // Unknown action
        // ---------------------------------------------
        else {
            res.status(400).json({
                success: false,
                message: 'Invalid action. Use APPROVE, EDIT or REJECT',
            });
            return;
        }
        // Save resolution
        const updated = await prisma_1.prisma.faultLog.update({
            where: {
                id,
            },
            data: {
                status: newStatus,
                resolvedValue,
                reviewedBy: reviewedBy
                    ? String(reviewedBy)
                    : 'manual-review',
                reviewedAt: new Date(),
            },
        });
        logger_1.logger.info(`[ResolutionController] Resolved fault=${id} | action=${normalizedAction}`);
        // ---------------------------------------------
        // Check if file still has pending issues
        // ---------------------------------------------
        const remainingPending = await prisma_1.prisma.faultLog.count({
            where: {
                fileId: rejection.fileId,
                status: 'PENDING',
            },
        });
        /**
         * If every rejection has been reviewed,
         * move the file out of NEEDS_REVIEW.
         */
        if (remainingPending === 0) {
            await prisma_1.prisma.processingFile.update({
                where: {
                    id: rejection.fileId,
                },
                data: {
                    status: 'COMPLETED',
                },
            });
        }
        res.status(200).json({
            success: true,
            message: 'Rejection resolved successfully',
            data: {
                ...updated,
                remainingPending,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('[ResolutionController] resolveRejection error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resolve rejection',
        });
    }
};
exports.resolveRejection = resolveRejection;
