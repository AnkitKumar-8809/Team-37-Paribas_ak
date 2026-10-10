const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export interface AnalyticsSummary {
  totalFiles: number;
  queuedFiles: number;
  activeProcessing: number;
  completedFiles: number;
  failedFiles: number;
  needsReviewFiles: number;

  totalRejections: number;
  pendingRejections: number;
  totalAnomalies: number;

  systemThroughput: number;
  averageProcessingTimeMs: number;

  fileTypeStats: Array<{
    type:
      | "PAYMENTS"
      | "BANK_TRANSACTIONS"
      | "ACCOUNTS"
      | "RATES";
    files: number;
  }>;

  processingTimeHistory: Array<{
    time: string;
    actual: number | null;
    predicted: number | null;
  }>;
}

export async function getAnalytics():
  Promise<AnalyticsSummary> {
  const response = await fetch(
    `${API_BASE}/dashboard/summary`
  );

  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
        "Failed to fetch analytics"
    );
  }

  return result.data;
}