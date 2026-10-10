import { logger } from '../utils/logger';

export class FileWorker {
  private isRunning: boolean = false;

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('[FileWorker] Background file worker started.');
  }

  stop(): void {
    this.isRunning = false;
    logger.info('[FileWorker] Background file worker stopped.');
  }

  async processJob(jobId: string): Promise<void> {
    logger.info(`[FileWorker] Executing job: ${jobId}`);
    // Starter placeholder logic
  }
}

export const fileWorker = new FileWorker();
