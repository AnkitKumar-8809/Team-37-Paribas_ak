import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Database,
  Activity,
  CircleX,
  RefreshCw,
} from "lucide-react";

import {
  getFiles,
  getFileDetails,
} from "../services/fileDetailsApi";

import AnomalyPanel, {
  type AnomalyRecord,
} from "../components/AnomalyPanel";

interface FileDetailsProps {
  onBack: () => void;
}

interface ProcessingFile {
  id: string;

  fileName: string;

  originalName?:
    | string
    | null;

  fileType: string;

  status: string;

  sizeBytes: string;

  progress: number;

  recordCount?:
    | number
    | null;

  totalRows: number;

  processedRows: number;

  successfulRows: number;

  failedRows: number;

  predictedDurationMs?:
    | number
    | null;

  actualDurationMs?:
    | number
    | null;

  errorMessage?:
    | string
    | null;

  receivedAt: string;

  startedAt?:
    | string
    | null;

  completedAt?:
    | string
    | null;

  faultLogs?: Array<{
    id: string;

    rowNumber: number;

    columnName: string;

    cellValue?:
      | string
      | null;

    errorMessage: string;

    errorType?:
      | string
      | null;

    status: string;
  }>;

  anomalies?:
    AnomalyRecord[];

  _count?: {
    accounts: number;
    bankTransactions: number;
    payments: number;
    rates: number;
  };
}

/* =========================================================
   Format helpers
   ========================================================= */

function formatSize(
  bytes:
    | string
    | number
) {
  const value =
    Number(
      bytes || 0
    );

  if (
    value >=
    1024 *
      1024 *
      1024
  ) {
    return `${(
      value /
      (1024 *
        1024 *
        1024)
    ).toFixed(2)} GB`;
  }

  if (
    value >=
    1024 * 1024
  ) {
    return `${(
      value /
      (1024 * 1024)
    ).toFixed(2)} MB`;
  }

  if (
    value >=
    1024
  ) {
    return `${(
      value / 1024
    ).toFixed(2)} KB`;
  }

  return `${value} B`;
}

function formatDate(
  value?:
    | string
    | null
) {
  if (!value) {
    return "—";
  }

  return new Date(
    value
  ).toLocaleString();
}

function formatDuration(
  ms?:
    | number
    | null
) {
  if (
    !ms ||
    ms <= 0
  ) {
    return "—";
  }

  const seconds =
    Math.round(
      ms / 1000
    );

  if (
    seconds < 60
  ) {
    return `${seconds} sec`;
  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  const remainingSeconds =
    seconds % 60;

  return `${minutes} min ${remainingSeconds} sec`;
}

function displayStatus(
  status: string
) {
  switch (status) {
    case "COMPLETED":
      return "Completed";

    case "PROCESSING":
      return "Processing";

    case "QUEUED":
      return "Queued";

    case "FAILED":
      return "Failed";

    case "NEEDS_REVIEW":
      return "Needs Review";

    default:
      return status;
  }
}

function statusClass(
  status: string
) {
  switch (status) {
    case "COMPLETED":
      return "completed";

    case "PROCESSING":
      return "processing";

    case "FAILED":
      return "failed";

    case "QUEUED":
      return "queued";

    case "NEEDS_REVIEW":
      return "queued";

    default:
      return "queued";
  }
}

/* =========================================================
   Component
   ========================================================= */

function FileDetails({
  onBack,
}: FileDetailsProps) {
  const [
    files,
    setFiles,
  ] =
    useState<
      ProcessingFile[]
    >([]);

  const [
    selectedFileId,
    setSelectedFileId,
  ] = useState("");

  const [
    file,
    setFile,
  ] =
    useState<
      ProcessingFile | null
    >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /* =======================================================
     Load files
     ======================================================= */

  async function loadFiles() {
    try {
      const data =
        await getFiles();

      setFiles(
        data
      );

      if (
        !selectedFileId &&
        data.length >
          0
      ) {
        setSelectedFileId(
          data[0].id
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load files"
      );
    }
  }

  /* =======================================================
     Load selected file
     ======================================================= */

  async function loadSelectedFile(
    silent = false
  ) {
    if (
      !selectedFileId
    ) {
      return;
    }

    try {
      if (!silent) {
        setLoading(
          true
        );
      }

      const data =
        await getFileDetails(
          selectedFileId
        );

      setFile(
        data
      );

      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load file details"
      );
    } finally {
      if (!silent) {
        setLoading(
          false
        );
      }
    }
  }

  /* =======================================================
     Effects
     ======================================================= */

  useEffect(() => {
    loadFiles();
  }, []);

  useEffect(() => {
    if (
      !selectedFileId
    ) {
      return;
    }

    loadSelectedFile();

    const interval =
      window.setInterval(
        () => {
          loadSelectedFile(
            true
          );
        },
        2000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [
    selectedFileId,
  ]);

  /* =======================================================
     No files
     ======================================================= */

  if (
    !loading &&
    files.length ===
      0
  ) {
    return (
      <div className="file-details-page">

        <div className="page-heading">

          <button
            className="secondary-button"
            type="button"
            onClick={
              onBack
            }
          >
            <ArrowLeft
              size={16}
            />
            Back to Dashboard
          </button>

          <h1>
            File Details
          </h1>

          <p>
            No files have been
            processed yet.
          </p>

        </div>

      </div>
    );
  }

  return (
    <div className="file-details-page">

      {/* ===============================================
          Heading
          =============================================== */}

      <div className="page-heading">

        <button
          className="secondary-button"
          type="button"
          onClick={
            onBack
          }
        >
          <ArrowLeft
            size={16}
          />
          Back to Dashboard
        </button>

        <h1>
          File Details
        </h1>

        <p>
          View live processing
          information, validation
          failures and Layer 2 ML
          anomalies.
        </p>

      </div>

      {/* ===============================================
          Selector
          =============================================== */}

      <div className="file-filters">

        <select
          value={
            selectedFileId
          }
          onChange={(
            event
          ) =>
            setSelectedFileId(
              event.target
                .value
            )
          }
        >
          {files.map(
            (
              item
            ) => (
              <option
                key={
                  item.id
                }
                value={
                  item.id
                }
              >
                {item.originalName ||
                  item.fileName}
              </option>
            )
          )}
        </select>

        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            loadSelectedFile()
          }
        >
          <RefreshCw
            size={15}
          />
          Refresh
        </button>

      </div>

      {/* ===============================================
          Errors
          =============================================== */}

      {error && (
        <section className="details-panel">

          <p>
            <AlertTriangle
              size={16}
            />{" "}
            {error}
          </p>

        </section>
      )}

      {/* ===============================================
          Loading
          =============================================== */}

      {loading &&
        !file && (
          <section className="details-panel">

            <p>
              <Activity
                size={16}
              />{" "}
              Loading file
              details...
            </p>

          </section>
        )}

      {/* ===============================================
          File
          =============================================== */}

      {file && (
        <>

          {/* Main file card */}

          <section className="details-file-card">

            <div className="details-file-icon">

              <FileText
                size={26}
              />

            </div>

            <div className="details-file-name">

              <h2>
                {file.originalName ||
                  file.fileName}
              </h2>

              <p>
                {file.id}
              </p>

            </div>

            <span
              className={`status-badge ${statusClass(
                file.status
              )}`}
            >

              {file.status ===
              "COMPLETED" ? (
                <CheckCircle2
                  size={
                    14
                  }
                />
              ) : file.status ===
                "FAILED" ? (
                <CircleX
                  size={
                    14
                  }
                />
              ) : file.status ===
                "PROCESSING" ? (
                <Activity
                  size={
                    14
                  }
                />
              ) : (
                <Clock
                  size={
                    14
                  }
                />
              )}

              {displayStatus(
                file.status
              )}

            </span>

          </section>

          {/* =============================================
              Metrics
              ============================================= */}

          <section className="details-grid">

            <div className="details-card">

              <span>
                File Size
              </span>

              <strong>
                {formatSize(
                  file.sizeBytes
                )}
              </strong>

            </div>

            <div className="details-card">

              <span>
                Total Records
              </span>

              <strong>
                {(
                  file.recordCount ??
                  file.totalRows ??
                  0
                ).toLocaleString()}
              </strong>

            </div>

            <div className="details-card">

              <span>
                Processed Records
              </span>

              <strong>
                {file.processedRows.toLocaleString()}
              </strong>

            </div>

            <div className="details-card">

              <span>
                Failed Records
              </span>

              <strong>
                {file.failedRows.toLocaleString()}
              </strong>

            </div>

          </section>

          {/* =============================================
              Progress
              ============================================= */}

          <section className="details-panel">

            <h2>
              Processing Progress
            </h2>

            <div className="details-progress-label">

              <span>
                {Math.round(
                  file.progress
                )}
                % complete
              </span>

              <span>
                {formatDuration(
                  file.actualDurationMs
                )}
              </span>

            </div>

            <div className="details-progress-track">

              <div
                className="details-progress-fill"
                style={{
                  width: `${Math.min(
                    file.progress,
                    100
                  )}%`,
                }}
              />

            </div>

          </section>

          {/* =============================================
              File info
              ============================================= */}

          <section className="details-panel">

            <h2>
              File Information
            </h2>

            <div className="details-info-grid">

              <div>

                <span>
                  File Type
                </span>

                <strong>
                  {
                    file.fileType
                  }
                </strong>

              </div>

              <div>

                <span>
                  <Clock
                    size={
                      14
                    }
                  />
                  Uploaded At
                </span>

                <strong>
                  {formatDate(
                    file.receivedAt
                  )}
                </strong>

              </div>

              <div>

                <span>
                  <Database
                    size={
                      14
                    }
                  />
                  Processing Started
                </span>

                <strong>
                  {formatDate(
                    file.startedAt
                  )}
                </strong>

              </div>

              <div>

                <span>
                  <CheckCircle2
                    size={
                      14
                    }
                  />
                  Processing Completed
                </span>

                <strong>
                  {formatDate(
                    file.completedAt
                  )}
                </strong>

              </div>

            </div>

          </section>

          {/* =============================================
              Summary
              ============================================= */}

          <section className="details-panel">

            <div className="details-section-heading">

              <h2>
                Processing Summary
              </h2>

              <AlertTriangle
                size={20}
              />

            </div>

            <p>
              <strong>
                {
                  file.successfulRows
                }
              </strong>{" "}
              records passed Layer
              1 validation and{" "}
              <strong>
                {
                  file.failedRows
                }
              </strong>{" "}
              records failed
              validation.
            </p>

            <div className="details-note">

              Status:{" "}

              <strong>
                {displayStatus(
                  file.status
                )}
              </strong>

              {" · "}

              ML anomalies:{" "}

              <strong>
                {file.anomalies
                  ?.length ??
                  0}
              </strong>

              {" · "}

              Validation issues:{" "}

              <strong>
                {file.faultLogs
                  ?.length ??
                  0}
              </strong>

            </div>

            {file.errorMessage && (
              <div className="details-note">

                Error:{" "}

                {
                  file.errorMessage
                }

              </div>
            )}

          </section>

          {/* =============================================
              Layer 1 validation failures
              ============================================= */}

          {(file.faultLogs
            ?.length ??
            0) >
            0 && (
            <section className="details-panel">

              <h2>
                Validation Issues
              </h2>

              <p>
                Records rejected
                during deterministic
                Layer 1 validation.
              </p>

              <div className="table-wrapper">

                <table className="file-table">

                  <thead>
                    <tr>

                      <th>
                        Row
                      </th>

                      <th>
                        Column
                      </th>

                      <th>
                        Value
                      </th>

                      <th>
                        Error
                      </th>

                      <th>
                        Status
                      </th>

                    </tr>
                  </thead>

                  <tbody>

                    {file.faultLogs?.map(
                      (
                        fault
                      ) => (
                        <tr
                          key={
                            fault.id
                          }
                        >

                          <td>
                            {
                              fault.rowNumber
                            }
                          </td>

                          <td>
                            {
                              fault.columnName
                            }
                          </td>

                          <td>
                            {fault.cellValue ||
                              "—"}
                          </td>

                          <td>
                            {
                              fault.errorMessage
                            }
                          </td>

                          <td>
                            {
                              fault.status
                            }
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </section>
          )}

          {/* =============================================
              Layer 2 ML anomalies
              ============================================= */}

          <AnomalyPanel
            anomalies={
              file.anomalies ??
              []
            }
          />

        </>
      )}

    </div>
  );
}

export default FileDetails;