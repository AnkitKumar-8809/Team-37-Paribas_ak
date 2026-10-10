import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger';

let io: SocketIOServer | null = null;

export function initSocket(server: HttpServer): SocketIOServer {
  const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  io = new SocketIOServer(server, {
    cors: {
      origin: [allowedOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`[Socket.IO] Client connected: ${socket.id}`);

    socket.on('subscribe_file', (fileId: string) => {
      socket.join(`file:${fileId}`);
      logger.info(`[Socket.IO] Client ${socket.id} subscribed to file:${fileId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocket(server) first.');
  }
  return io;
}

export function emitFileProgress(fileId: string, progress: number, status: string, extra: Record<string, unknown> = {}): void {
  if (io) {
    io.emit('file_progress', { fileId, progress, status, ...extra });
    io.to(`file:${fileId}`).emit('file_detail_update', { fileId, progress, status, ...extra });
  }
}

export function emitDashboardAlert(type: string, message: string, payload: Record<string, unknown> = {}): void {
  if (io) {
    io.emit('dashboard_alert', { type, message, payload, timestamp: new Date().toISOString() });
  }
}
