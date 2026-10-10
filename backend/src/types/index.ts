export type FileStatusType = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'QUARANTINED';

export interface FileMetadata {
  id: string;
  filename: string;
  originalName: string;
  status: FileStatusType;
  progress: number;
  totalRows: number;
  processedRows: number;
  errorCount: number;
  checksum?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface RejectionItem {
  id: string;
  fileId: string;
  rowNumber: number;
  rawData: string;
  reason: string;
  status: 'PENDING' | 'RESOLVED' | 'DISCARDED';
}

export interface AnomalyItem {
  id: string;
  fileId: string;
  anomalyType: string;
  score: number;
  details: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}

export interface DashboardSummary {
  totalFiles: number;
  activeProcessing: number;
  totalRejections: number;
  totalAnomalies: number;
  systemThroughput: number;
}
