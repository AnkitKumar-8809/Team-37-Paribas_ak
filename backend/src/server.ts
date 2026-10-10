import http from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { initSocket } from './sockets/socket';
import { ensureDirectories } from './utils/fileUtils';
import { logger } from './utils/logger';
import { fileWorker } from './workers/fileWorker';

// Route imports
import fileRoutes from './routes/files';
import dashboardRoutes from './routes/dashboard';
import resolutionRoutes from './routes/resolutions';
import analyticsRoutes from './routes/analytics';

const app = express();
const server = http.createServer(app);

// Initialize folders
ensureDirectories();

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for hackathon local dev
    },
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Attach Socket.IO
initSocket(server);

// Routes
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'concurrent-file-monitoring-backend', timestamp: new Date().toISOString() });
});

app.use('/api/files', fileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/resolutions', resolutionRoutes);
app.use('/api/analytics', analyticsRoutes);

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('[Server] Unhandled error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

// Start File Processing Worker
fileWorker.start();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  logger.info(`🚀 Backend server running on http://localhost:${PORT}`);
  logger.info(`🔌 Socket.IO initialized on port ${PORT}`);
});

export { app, server };
