"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startFileWatcher = startFileWatcher;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chokidar_1 = __importDefault(require("chokidar"));
const ingestion_1 = require("../services/ingestion");
const fileWorker_1 = require("../workers/fileWorker");
const logger_1 = require("../utils/logger");
const incomingFolder = path_1.default.join(__dirname, '../../incoming');
function startFileWatcher() {
    // Make sure incoming folder exists
    fs_1.default.mkdirSync(incomingFolder, {
        recursive: true,
    });
    logger_1.logger.info(`[FileWatcher] Watching folder: ${incomingFolder}`);
    const watcher = chokidar_1.default.watch(incomingFolder, {
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 2000,
            pollInterval: 500,
        },
    });
    watcher.on('add', async (filePath) => {
        try {
            const fileName = path_1.default.basename(filePath);
            logger_1.logger.info(`[FileWatcher] New file detected: ${fileName}`);
            const result = await ingestion_1.ingestionService.ingestFile(filePath, fileName);
            const jobId = `folder_${Date.now()}`;
            fileWorker_1.fileWorker.enqueue({
                jobId,
                fileId: result.fileId,
                filePath,
            });
            logger_1.logger.info(`[FileWatcher] File queued: ${fileName}`);
        }
        catch (error) {
            logger_1.logger.error('[FileWatcher] Failed to ingest file:', error);
        }
    });
    watcher.on('error', (error) => {
        logger_1.logger.error('[FileWatcher] Watcher error:', error);
    });
}
