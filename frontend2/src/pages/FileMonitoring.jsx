import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  PauseCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  X,
  XCircle,
  FileUp,
  Filter,
  ChevronDown,
  Download,
} from "lucide-react";

import {
  fetchProcessingFiles,
  uploadProcessingFile,
} from "../services/fileMonitoringApi";

const today = new Date();

const dateInputValue = (date) =>
  `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(date.getDate()).padStart(
    2,
    "0"
  )}`;

const statusClass = {
  Processing: "fm-processing",
  Success: "fm-completed",
  Failed: "fm-failed",
  Queued: "fm-queued",
  "Needs Review": "fm-anomalies",
};

function mapFileType(type) {
  switch (type) {
    case "PAYMENTS":
      return "Payments";

    case "BANK_TRANSACTIONS":
      return "Bank-Txns";

    case "ACCOUNTS":
      return "Accounts";

    case "RATES":
      return "Rates";

    default:
      return type || "Unknown";
  }
}

function mapStatus(status) {
  switch (status) {
    case "COMPLETED":
      return "Success";

    case "PROCESSING":
      return "Processing";

    case "FAILED":
      return "Failed";

    case "QUEUED":
      return "Queued";

    case "NEEDS_REVIEW":
      return "Needs Review";

    default:
      return status;
  }
}

function formatSize(bytes) {
  const value = Number(bytes || 0);

  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${value} B`;
}

function formatDuration(ms) {
  if (!ms) {
    return "—";
  }

  const totalSeconds = Math.round(ms / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}m ${seconds}s`;
}

function mapBackendFile(file) {
  const receivedDate = new Date(file.receivedAt);

  return {
    id: file.id,

    name:
      file.originalName ||
      file.fileName ||
      "Unknown file",

    type: mapFileType(file.fileType),

    status: mapStatus(file.status),

    progress: Math.round(Number(file.progress || 0)),

    records:
      file.recordCount ??
      file.totalRows ??
      0,

    processed:
      file.processedRows ?? 0,

    successful:
      file.successfulRows ?? 0,

    failed:
      file.failedRows ?? 0,

    date: dateInputValue(receivedDate),

    started: file.startedAt
      ? new Date(file.startedAt).toLocaleTimeString()
      : "—",

    sizeBytes: Number(file.sizeBytes || 0),

    predicted: formatDuration(
      file.predictedDurationMs
    ),

    actualDuration: formatDuration(
      file.actualDurationMs
    ),

    anomaly:
      file._count?.anomalies ?? 0,

    faults:
      file._count?.faultLogs ?? 0,

    errorMessage:
      file.errorMessage || null,
  };
}

export default function FileMonitoring() {
  const [files, setFiles] = useState([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("All");

  const [typeFilter, setTypeFilter] =
    useState("All Types");

  const [range, setRange] =
    useState("Today");

  const [customFrom, setCustomFrom] = useState(
    dateInputValue(today)
  );

  const [customTo, setCustomTo] = useState(
    dateInputValue(today)
  );

  const [notice, setNotice] = useState("");

  const [dragging, setDragging] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const inputRef = useRef(null);

  // ---------------------------------------------
  // Load real files from backend
  // ---------------------------------------------

  const loadFiles = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }

        const backendFiles =
          await fetchProcessingFiles();

        setFiles(
          backendFiles.map(mapBackendFile)
        );

        setError("");
      } catch (err) {
        console.error(
          "Failed to load files:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load files"
        );
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    []
  );

  // ---------------------------------------------
  // Initial load + automatic polling
  // ---------------------------------------------

  useEffect(() => {
    loadFiles();

    const interval =
      setInterval(() => {
        loadFiles(true);
      }, 2000);

    return () =>
      clearInterval(interval);
  }, [loadFiles]);

  // ---------------------------------------------
  // Filters
  // ---------------------------------------------

  const filteredFiles = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    const now = new Date();

    const start = new Date(now);

    start.setHours(0, 0, 0, 0);

    if (range === "This Week") {
      start.setDate(
        start.getDate() -
          ((start.getDay() + 6) % 7)
      );
    }

    if (range === "This Month") {
      start.setDate(1);
    }

    if (range === "Last 7 Days") {
      start.setDate(
        start.getDate() - 6
      );
    }

    if (range === "Last 30 Days") {
      start.setDate(
        start.getDate() - 29
      );
    }

    const from =
      range === "Custom Range"
        ? customFrom
        : dateInputValue(start);

    const to =
      range === "Custom Range"
        ? customTo
        : dateInputValue(now);

    return files.filter((file) => {
      const matchesSearch =
        file.name
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter ===
        "Anomalies Detected"
          ? file.anomaly > 0
          : file.status ===
            statusFilter);

      const matchesType =
        typeFilter === "All Types" ||
        file.type === typeFilter;

      const matchesDate =
        file.date >= from &&
        file.date <= to;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesDate
      );
    });
  }, [
    files,
    search,
    statusFilter,
    typeFilter,
    range,
    customFrom,
    customTo,
  ]);

  // ---------------------------------------------
  // Stats
  // ---------------------------------------------

  const stats = useMemo(
    () => ({
      total: filteredFiles.length,

      processing:
        filteredFiles.filter(
          (file) =>
            file.status === "Processing"
        ).length,

      completed:
        filteredFiles.filter(
          (file) =>
            file.status === "Success"
        ).length,

      failed:
        filteredFiles.filter(
          (file) =>
            file.status === "Failed"
        ).length,

      queued:
        filteredFiles.filter(
          (file) =>
            file.status === "Queued"
        ).length,
    }),
    [filteredFiles]
  );

  // ---------------------------------------------
  // Upload real CSV files
  // ---------------------------------------------

  async function handleFiles(fileList) {
    const incoming =
      Array.from(fileList || []);

    if (!incoming.length) {
      return;
    }

    const invalid =
      incoming.filter(
        (file) =>
          !file.name
            .toLowerCase()
            .endsWith(".csv")
      );

    const accepted =
      incoming.filter((file) =>
        file.name
          .toLowerCase()
          .endsWith(".csv")
      );

    if (!accepted.length) {
      setNotice(
        "Only CSV files are currently supported."
      );

      return;
    }

    setNotice(
      `Uploading ${accepted.length} file${
        accepted.length === 1
          ? ""
          : "s"
      }...`
    );

    const results =
      await Promise.allSettled(
        accepted.map((file) =>
          uploadProcessingFile(file)
        )
      );

    const successful =
      results.filter(
        (result) =>
          result.status === "fulfilled"
      ).length;

    const failed =
      results.length - successful;

    let message =
      `${successful} file${
        successful === 1 ? "" : "s"
      } submitted for processing`;

    if (failed > 0) {
      message += `; ${failed} failed`;
    }

    if (invalid.length > 0) {
      message += `; ${invalid.length} unsupported file${
        invalid.length === 1
          ? ""
          : "s"
      } skipped`;
    }

    setNotice(message);

    if (inputRef.current) {
      inputRef.current.value = "";
    }

    await loadFiles(true);
  }

  function clearFilters() {
    setSearch("");

    setStatusFilter("All");

    setTypeFilter("All Types");

    setRange("Today");

    setCustomFrom(
      dateInputValue(today)
    );

    setCustomTo(
      dateInputValue(today)
    );
  }

  function exportCsv() {
    const rows = [
      [
        "File Name",
        "Type",
        "Size",
        "Submitted Date",
        "Status",
        "Progress",
        "Predicted Time",
        "Anomaly Count",
      ],

      ...filteredFiles.map(
        (file) => [
          file.name,
          file.type,
          formatSize(
            file.sizeBytes
          ),
          file.date,
          file.status,
          `${file.progress}%`,
          file.predicted,
          file.anomaly,
        ]
      ),
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(
                value
              ).replaceAll(
                '"',
                '""'
              )}"`
          )
          .join(",")
      )
      .join("\n");

    const url =
      URL.createObjectURL(
        new Blob([csv], {
          type: "text/csv;charset=utf-8;",
        })
      );

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "file-monitoring-filtered.csv";

    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="fm-page">

      <div className="fm-heading">
        <div>
          <div className="fm-eyebrow">
            <Activity size={15} />
            OPERATIONS / INGESTION
          </div>

          <h1>File Monitoring</h1>

          <p>
            Track concurrent ingestion,
            validation outcomes, predicted
            duration, and anomalies.
          </p>
        </div>

        <div className="fm-heading-actions">

          <button
            className="fm-refresh"
            type="button"
            onClick={async () => {
              await loadFiles();

              setNotice(
                "File monitoring data refreshed."
              );
            }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            className="fm-upload-button"
            type="button"
            onClick={() =>
              inputRef.current?.click()
            }
          >
            <Upload size={16} />
            Upload CSV
          </button>

          <input
            ref={inputRef}
            className="fm-hidden-input"
            type="file"
            multiple
            accept=".csv"
            onChange={(event) =>
              handleFiles(
                event.target.files
              )
            }
          />
        </div>
      </div>

      <div className="fm-demo-note">
        <AlertCircle size={17} />

        <span>
          <strong>
            Live monitoring:
          </strong>{" "}
          Data is loaded from the
          processing backend and refreshes
          automatically.
        </span>
      </div>

      {error && (
        <div className="fm-demo-note">
          <AlertTriangle size={17} />

          <span>
            Backend connection error:{" "}
            {error}
          </span>
        </div>
      )}

      <section
        className={`fm-dropzone ${
          dragging
            ? "is-dragging"
            : ""
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() =>
          setDragging(false)
        }
        onDrop={(event) => {
          event.preventDefault();

          setDragging(false);

          handleFiles(
            event.dataTransfer.files
          );
        }}
      >
        <div className="fm-drop-icon">
          <FileUp size={23} />
        </div>

        <div className="fm-drop-copy">
          <strong>
            Drop CSV files here
          </strong>

          <span>
            Files will be sent to the
            backend processing queue
          </span>
        </div>

        <button
          type="button"
          className="fm-browse-button"
          onClick={() =>
            inputRef.current?.click()
          }
        >
          Browse files
        </button>
      </section>

      <div className="fm-stats">

        <div className="fm-stat-card">
          <span>Files in view</span>

          <div>
            <FileText />
            <strong>
              {stats.total}
            </strong>
          </div>

          <small>
            Matching current filters
          </small>
        </div>

        <div className="fm-stat-card">
          <span>Processing</span>

          <div>
            <Activity />
            <strong>
              {stats.processing}
            </strong>
          </div>

          <small>
            Currently running
          </small>
        </div>

        <div className="fm-stat-card">
          <span>Successful</span>

          <div>
            <CheckCircle2 />
            <strong>
              {stats.completed}
            </strong>
          </div>

          <small>
            Validated and loaded
          </small>
        </div>

        <div className="fm-stat-card">
          <span>Failed</span>

          <div>
            <XCircle />
            <strong>
              {stats.failed}
            </strong>
          </div>

          <small>
            Require attention
          </small>
        </div>

        <div className="fm-stat-card">
          <span>Queued</span>

          <div>
            <Clock3 />
            <strong>
              {stats.queued}
            </strong>
          </div>

          <small>
            Awaiting processing
          </small>
        </div>

      </div>

      <div className="fm-panel">

        <div className="fm-panel-heading">

          <div>
            <h2>
              File processing queue
            </h2>

            <p>
              Live files detected and
              processed by the backend.
            </p>
          </div>

          <div className="fm-panel-tools">

            <span className="fm-count">
              {filteredFiles.length} of{" "}
              {files.length} files
            </span>

            <button
              className="fm-export"
              type="button"
              onClick={exportCsv}
            >
              <Download size={14} />
              Export CSV
            </button>

          </div>
        </div>

        <div className="fm-filter-area">

          <div className="fm-filter-title">
            <span>
              <Filter size={15} />
              Filters
            </span>

            <button
              type="button"
              onClick={clearFilters}
            >
              Reset filters
              <X size={13} />
            </button>
          </div>

          <div className="fm-date-pills">
            {[
              "Today",
              "This Week",
              "This Month",
              "Last 7 Days",
              "Last 30 Days",
              "Custom Range",
            ].map((item) => (
              <button
                type="button"
                key={item}
                className={`fm-date-pill ${
                  range === item
                    ? "active"
                    : ""
                }`}
                onClick={() =>
                  setRange(item)
                }
              >
                {item ===
                  "Custom Range" && (
                  <CalendarDays
                    size={13}
                  />
                )}

                {item}
              </button>
            ))}
          </div>

          {range ===
            "Custom Range" && (
            <div className="fm-custom-dates">

              <label>
                From
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(event) =>
                    setCustomFrom(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                To
                <input
                  type="date"
                  value={customTo}
                  min={customFrom}
                  onChange={(event) =>
                    setCustomTo(
                      event.target.value
                    )
                  }
                />
              </label>

            </div>
          )}

          <div className="fm-filters">

            <div className="fm-search">
              <Search size={17} />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search by filename…"
                aria-label="Search by filename"
              />
            </div>

            <label className="fm-select-wrap">
              <span>File type</span>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value
                  )
                }
              >
                <option>
                  All Types
                </option>

                <option>
                  Payments
                </option>

                <option>
                  Bank-Txns
                </option>

                <option>
                  Accounts
                </option>

                <option>
                  Rates
                </option>
              </select>

              <ChevronDown size={14} />
            </label>

            <label className="fm-select-wrap">

              <span>Status</span>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >
                <option value="All">
                  All statuses
                </option>

                <option value="Success">
                  Success
                </option>

                <option value="Failed">
                  Failed
                </option>

                <option value="Processing">
                  In progress
                </option>

                <option value="Queued">
                  Queued
                </option>

                <option value="Needs Review">
                  Needs Review
                </option>

                <option value="Anomalies Detected">
                  Anomalies detected
                </option>

              </select>

              <ChevronDown size={14} />

            </label>

          </div>
        </div>

        <div className="fm-table-wrap">

          <table className="fm-table">

            <thead>
              <tr>
                <th>
                  File name / type
                </th>

                <th>Size</th>

                <th>Status</th>

                <th>Progress</th>

                <th>
                  Predicted time
                </th>

                <th>
                  Anomalies
                </th>

                <th>
                  Submitted
                </th>

                <th>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>

              {loading &&
                files.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="fm-empty"
                    >
                      <Activity
                        size={22}
                      />

                      <strong>
                        Loading files...
                      </strong>
                    </td>
                  </tr>
                )}

              {!loading &&
                filteredFiles.map(
                  (file) => (
                    <tr key={file.id}>

                      <td>
                        <div className="fm-file-name">

                          <span className="fm-file-icon">
                            <FileText
                              size={17}
                            />
                          </span>

                          <div>
                            <strong>
                              {file.name}
                            </strong>

                            <small>
                              {file.type}
                            </small>
                          </div>

                        </div>
                      </td>

                      <td>
                        {formatSize(
                          file.sizeBytes
                        )}
                      </td>

                      <td>
                        <span
                          className={`fm-status ${
                            statusClass[
                              file.status
                            ] ||
                            "fm-queued"
                          }`}
                        >

                          {file.status ===
                          "Processing" ? (
                            <Activity
                              size={13}
                            />
                          ) : file.status ===
                            "Success" ? (
                            <CheckCircle2
                              size={13}
                            />
                          ) : file.status ===
                            "Failed" ? (
                            <XCircle
                              size={13}
                            />
                          ) : file.status ===
                            "Needs Review" ? (
                            <AlertTriangle
                              size={13}
                            />
                          ) : (
                            <PauseCircle
                              size={13}
                            />
                          )}

                          {file.status}

                        </span>
                      </td>

                      <td>

                        <div className="fm-progress-label">
                          <span>
                            {file.progress}%
                          </span>
                        </div>

                        <div
                          className="fm-progress-track"
                          role="progressbar"
                          aria-valuenow={
                            file.progress
                          }
                          aria-valuemin={0}
                          aria-valuemax={100}
                        >

                          <div
                            className={`fm-progress-fill ${
                              statusClass[
                                file.status
                              ] ||
                              "fm-queued"
                            }`}
                            style={{
                              width: `${file.progress}%`,
                            }}
                          />

                        </div>

                        <small className="fm-record-detail">
                          {file.processed.toLocaleString()}
                          {" / "}
                          {file.records.toLocaleString()}
                          {" records"}
                        </small>

                      </td>

                      <td>
                        <span className="fm-predicted">
                          <Clock3
                            size={13}
                          />

                          {file.predicted}
                        </span>
                      </td>

                      <td>

                        {file.anomaly >
                        0 ? (
                          <span className="fm-anomaly-count">
                            <AlertTriangle
                              size={13}
                            />
                            {file.anomaly}
                          </span>
                        ) : (
                          <span className="fm-no-anomaly">
                            —
                          </span>
                        )}

                      </td>

                      <td>

                        <span className="fm-submitted-date">
                          {file.date}
                        </span>

                        <small className="fm-record-detail">
                          {file.started}
                        </small>

                      </td>

                      <td>

                        {file.status ===
                        "Processing" ? (
                          <span className="fm-waiting">
                            <Activity
                              size={14}
                            />
                            In progress
                          </span>
                        ) : file.status ===
                          "Queued" ? (
                          <span className="fm-waiting">
                            <Clock3
                              size={14}
                            />
                            Waiting
                          </span>
                        ) : file.status ===
                          "Needs Review" ? (
                          <span className="fm-anomaly-count">
                            <AlertTriangle
                              size={14}
                            />
                            Review required
                          </span>
                        ) : file.status ===
                          "Failed" ? (
                          <span className="fm-anomaly-count">
                            <XCircle
                              size={14}
                            />
                            Needs attention
                          </span>
                        ) : (
                          <span className="fm-success">
                            <ShieldCheck
                              size={15}
                            />
                            Verified
                          </span>
                        )}

                      </td>

                    </tr>
                  )
                )}

              {!loading &&
                filteredFiles.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="fm-empty"
                    >

                      <Search
                        size={22}
                      />

                      <strong>
                        No files match
                        these filters
                      </strong>

                      <span>
                        Try changing the
                        filters.
                      </span>

                      <button
                        type="button"
                        onClick={
                          clearFilters
                        }
                      >
                        Clear all filters
                      </button>

                    </td>
                  </tr>
                )}

            </tbody>
          </table>

        </div>
      </div>

      {notice && (
        <div
          className="fm-notice"
          role="status"
        >
          <span>{notice}</span>

          <button
            type="button"
            onClick={() =>
              setNotice("")
            }
          >
            ×
          </button>
        </div>
      )}

      <div className="fm-footer">
        <Activity size={16} />

        <span>
          File Monitoring
        </span>

        <span>•</span>

        <span>
          Live backend data · Auto-refresh
          every 2 seconds
        </span>
      </div>

    </div>
  );
}