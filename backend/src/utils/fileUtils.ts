import fs from 'fs';
import path from 'path';

/**
 * Ensures required storage directories exist.
 */
export function ensureDirectories(): void {
  const dirs = [
    path.join(__dirname, '../../uploads'),
    path.join(__dirname, '../../quarantine'),
    path.join(__dirname, '../../processed')
  ];

  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Safely moves a file between stages (e.g., uploads -> processed or quarantine).
 */
export function moveFile(sourcePath: string, destinationPath: string): void {
  const targetDir = path.dirname(destinationPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.renameSync(sourcePath, destinationPath);
}
