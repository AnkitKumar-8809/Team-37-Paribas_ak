import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Search,
  ShieldAlert,
  AlertTriangle,
  CircleX,
  CheckCircle2,
  RefreshCw,
  Files,
} from "lucide-react";

import {
  getRejections,
} from "../services/rejectionsApi";

interface RejectionsProps {
  onBack: () => void;
}

interface BackendRejection {
  id: string;

  fileId: string;

  rowNumber: number;

  colNumber?: number | null;

  columnName: string;

  cellValue?: string | null;

  errorMessage: string;

  errorType?: string | null;

  status:
    | "PENDING"
    | "APPROVED"
    | "EDITED"
    | "REJECTED"
    | "SAVED_TO_TARGET";

  resolvedValue?: string | null;

  reviewedBy?: string | null;

  reviewedAt?: string | null;

  createdAt: string;

  file: {
    id: string;
    fileName: string;
    originalName?: string | null;
    fileType: string;
    status: string;
  };
}

function displayStatus(
  status: BackendRejection["status"]
) {
  switch (status) {
    case "PENDING":
      return "Pending";

    case "APPROVED":
      return "Approved";

    case "EDITED":
      return "Edited";

    case "REJECTED":
      return "Rejected";

    case "SAVED_TO_TARGET":
      return "Saved";

    default:
      return status;
  }
}

function reviewClass(
  status: BackendRejection["status"]
) {
  return status === "PENDING"
    ? "pending"
    : "reviewed";
}

export default function Rejections({
  onBack,
}: RejectionsProps) {
  const [
    records,
    setRecords,
  ] = useState<BackendRejection[]>(
    []
  );

  const [search, setSearch] =
    useState("");

  const [status, setStatus] =
    useState("All Statuses");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadRejections =
    useCallback(
      async (
        silent = false
      ) => {
        try {
          if (!silent) {
            setLoading(true);
          }

          const data =
            await getRejections();

          setRecords(data);

          setError("");
        } catch (err) {
          console.error(
            "Failed to load rejections:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load rejected records"
          );
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      []
    );

  useEffect(() => {
    loadRejections();

    const interval =
      setInterval(() => {
        loadRejections(true);
      }, 2000);

    return () =>
      clearInterval(interval);
  }, [loadRejections]);

  const filteredRecords =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return records.filter(
        (record) => {
          const fileName =
            record.file
              ?.originalName ||
            record.file
              ?.fileName ||
            "";

          const matchesSearch =
            record.id
              .toLowerCase()
              .includes(query) ||
            fileName
              .toLowerCase()
              .includes(query) ||
            record.columnName
              .toLowerCase()
              .includes(query) ||
            record.errorMessage
              .toLowerCase()
              .includes(query) ||
            (
              record.errorType ||
              ""
            )
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            status ===
              "All Statuses" ||
            displayStatus(
              record.status
            ) === status;

          return (
            matchesSearch &&
            matchesStatus
          );
        }
      );
    }, [
      records,
      search,
      status,
    ]);

  const pendingCount =
    records.filter(
      (record) =>
        record.status ===
        "PENDING"
    ).length;

  const reviewedCount =
    records.length -
    pendingCount;

  const affectedFiles =
    new Set(
      records.map(
        (record) =>
          record.fileId
      )
    ).size;

  return (
    <div className="rejections-page">

      <div className="page-heading">

        <button
          className="secondary-button"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <h1>
          Rejected Records
        </h1>

        <p>
          Review validation failures
          detected during file processing.
        </p>

      </div>

      <div className="rejection-summary">

        <article className="rejection-stat">

          <div className="rejection-stat-icon red">
            <CircleX size={21} />
          </div>

          <div>
            <span>
              Total validation issues
            </span>

            <strong>
              {records.length}
            </strong>
          </div>

        </article>

        <article className="rejection-stat">

          <div className="rejection-stat-icon orange">
            <AlertTriangle
              size={21}
            />
          </div>

          <div>
            <span>
              Pending review
            </span>

            <strong>
              {pendingCount}
            </strong>
          </div>

        </article>

        <article className="rejection-stat">

          <div className="rejection-stat-icon green">
            <CheckCircle2
              size={21}
            />
          </div>

          <div>
            <span>
              Reviewed
            </span>

            <strong>
              {reviewedCount}
            </strong>
          </div>

        </article>

        <article className="rejection-stat">

          <div className="rejection-stat-icon blue">
            <Files size={21} />
          </div>

          <div>
            <span>
              Affected files
            </span>

            <strong>
              {affectedFiles}
            </strong>
          </div>

        </article>

      </div>

      <section className="panel rejection-panel">

        <div className="panel-heading">

          <div>
            <h2>
              Validation Failures
            </h2>

            <p>
              Search by file,
              field, issue ID or
              validation reason.
            </p>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={() =>
              loadRejections()
            }
          >
            <RefreshCw size={15} />
            Refresh
          </button>

        </div>

        {error && (
          <div className="rejection-note">
            <AlertTriangle
              size={18}
            />

            <p>{error}</p>
          </div>
        )}

        <div className="file-filters">

          <label className="search-box">

            <Search size={17} />

            <input
              type="search"
              placeholder="Search rejected records..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
            />

          </label>

          <select
            value={status}
            onChange={(event) =>
              setStatus(
                event.target.value
              )
            }
          >
            <option>
              All Statuses
            </option>

            <option>
              Pending
            </option>

            <option>
              Approved
            </option>

            <option>
              Edited
            </option>

            <option>
              Rejected
            </option>

            <option>
              Saved
            </option>

          </select>

        </div>

        <p className="results-count">
          Showing{" "}
          {filteredRecords.length}{" "}
          of {records.length}{" "}
          records
        </p>

        <div className="table-wrapper">

          <table className="file-table rejection-table">

            <thead>
              <tr>

                <th>
                  Issue ID
                </th>

                <th>
                  Source File
                </th>

                <th>
                  Row
                </th>

                <th>
                  Field
                </th>

                <th>
                  Rejected Value
                </th>

                <th>
                  Reason
                </th>

                <th>
                  Error Type
                </th>

                <th>
                  Status
                </th>

              </tr>
            </thead>

            <tbody>

              {loading &&
                records.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="empty-state"
                    >
                      Loading rejected
                      records...
                    </td>
                  </tr>
                )}

              {!loading &&
                filteredRecords.map(
                  (record) => {
                    const fileName =
                      record.file
                        ?.originalName ||
                      record.file
                        ?.fileName ||
                      "Unknown file";

                    return (
                      <tr
                        key={
                          record.id
                        }
                      >

                        <td className="rejection-id">
                          {
                            record.id
                          }
                        </td>

                        <td>
                          {fileName}
                        </td>

                        <td>
                          {
                            record.rowNumber
                          }
                        </td>

                        <td>
                          {
                            record.columnName
                          }
                        </td>

                        <td>
                          {record.cellValue ||
                            "Empty"}
                        </td>

                        <td>
                          {
                            record.errorMessage
                          }
                        </td>

                        <td>
                          {record.errorType ||
                            "—"}
                        </td>

                        <td>

                          <span
                            className={`review-status ${reviewClass(
                              record.status
                            )}`}
                          >
                            {displayStatus(
                              record.status
                            )}
                          </span>

                        </td>

                      </tr>
                    );
                  }
                )}

              {!loading &&
                filteredRecords.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="empty-state"
                    >
                      No rejected
                      records match
                      your filters.
                    </td>
                  </tr>
                )}

            </tbody>

          </table>

        </div>

      </section>

      <div className="rejection-note">

        <ShieldAlert size={18} />

        <p>
          Validation issues shown here
          are loaded directly from the
          backend FaultLog records.
        </p>

      </div>

    </div>
  );
}