const API_BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api";

export type FaultStatus =
  | "PENDING"
  | "APPROVED"
  | "EDITED"
  | "REJECTED"
  | "SAVED_TO_TARGET";

export interface ResolutionRecord {
  id: string;
  fileId: string;

  rowNumber: number;
  colNumber?: number | null;

  columnName: string;
  cellValue?: string | null;

  errorMessage: string;
  errorType?: string | null;

  rawRowData?: Record<
    string,
    unknown
  > | null;

  aiSuggestion?: string | null;
  aiConfidence?: number | null;
  aiExplanation?: string | null;

  status: FaultStatus;

  resolvedValue?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;

  createdAt: string;
  updatedAt: string;

  file: {
    id: string;
    fileName: string;
    originalName?: string | null;
    fileType: string;
    status: string;
  };
}

async function parseResponse(
  response: Response
) {
  const result =
    await response.json();

  if (!response.ok) {
    throw new Error(
      result.message ||
        "Backend request failed"
    );
  }

  return result.data;
}

export async function getResolutions():
  Promise<ResolutionRecord[]> {
  const response = await fetch(
    `${API_BASE}/resolutions`
  );

  return parseResponse(
    response
  );
}

export async function resolveRecord(
  id: string,
  action:
    | "APPROVE"
    | "EDIT"
    | "REJECT",
  correctedValue?: string
) {
  const response = await fetch(
    `${API_BASE}/resolutions/${id}/resolve`,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        action,

        correctedValue,

        reviewedBy:
          "admin",
      }),
    }
  );

  return parseResponse(
    response
  );
}