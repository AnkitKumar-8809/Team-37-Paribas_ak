import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  WandSparkles,
  CheckCircle2,
  CircleX,
  Pencil,
  RefreshCw,
  AlertTriangle,
  Clock3,
} from "lucide-react";

import {
  getResolutions,
  resolveRecord,
  type ResolutionRecord,
} from "../services/resolutionApi";

interface ResolutionCentreProps {
  onBack: () => void;
}

function displayStatus(
  status: ResolutionRecord["status"]
) {
  switch (status) {
    case "PENDING":
      return "Pending";

    case "APPROVED":
      return "Accepted";

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

function statusClass(
  status: ResolutionRecord["status"]
) {
  switch (status) {
    case "PENDING":
      return "pending";

    case "REJECTED":
      return "rejected";

    default:
      return "reviewed";
  }
}

function formatConfidence(
  confidence?: number | null
) {
  if (
    confidence === undefined ||
    confidence === null
  ) {
    return null;
  }

  const percentage =
    confidence <= 1
      ? confidence * 100
      : confidence;

  return Math.round(
    percentage
  );
}

export default function ResolutionCentre({
  onBack,
}: ResolutionCentreProps) {
  const [
    records,
    setRecords,
  ] =
    useState<
      ResolutionRecord[]
    >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    editingId,
    setEditingId,
  ] =
    useState<string | null>(
      null
    );

  const [
    editValue,
    setEditValue,
  ] = useState("");

  const [
    actionId,
    setActionId,
  ] =
    useState<string | null>(
      null
    );

  /* =========================================
     Load backend records
     ========================================= */

  const loadRecords =
    useCallback(
      async (
        silent = false
      ) => {
        try {
          if (!silent) {
            setLoading(true);
          }

          const data =
            await getResolutions();

          setRecords(data);

          setError("");
        } catch (err) {
          console.error(
            "Failed to load resolutions:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load resolution records"
          );
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      []
    );

  /* =========================================
     Initial fetch + live refresh
     ========================================= */

  useEffect(() => {
    loadRecords();

    const interval =
      window.setInterval(
        () => {
          loadRecords(true);
        },
        2000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [loadRecords]);

  /* =========================================
     Counts
     ========================================= */

  const pendingCount =
    useMemo(
      () =>
        records.filter(
          (record) =>
            record.status ===
            "PENDING"
        ).length,
      [records]
    );

  const acceptedCount =
    useMemo(
      () =>
        records.filter(
          (record) =>
            record.status ===
              "APPROVED" ||
            record.status ===
              "EDITED" ||
            record.status ===
              "SAVED_TO_TARGET"
        ).length,
      [records]
    );

  const rejectedCount =
    useMemo(
      () =>
        records.filter(
          (record) =>
            record.status ===
            "REJECTED"
        ).length,
      [records]
    );

  /* =========================================
     Edit
     ========================================= */

  const startEditing = (
    record: ResolutionRecord
  ) => {
    setEditingId(
      record.id
    );

    setEditValue(
      record.aiSuggestion ||
        record.cellValue ||
        ""
    );

    setMessage("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue("");
  };

  /* =========================================
     Resolve helper
     ========================================= */

  const runResolution =
    async (
      record: ResolutionRecord,
      action:
        | "APPROVE"
        | "EDIT"
        | "REJECT",
      correctedValue?: string
    ) => {
      try {
        setActionId(
          record.id
        );

        setError("");
        setMessage("");

        await resolveRecord(
          record.id,
          action,
          correctedValue
        );

        setEditingId(null);
        setEditValue("");

        if (
          action ===
          "APPROVE"
        ) {
          setMessage(
            `${record.id} accepted successfully.`
          );
        } else if (
          action ===
          "EDIT"
        ) {
          setMessage(
            `${record.id} updated successfully.`
          );
        } else {
          setMessage(
            `${record.id} rejected successfully.`
          );
        }

        await loadRecords(
          true
        );
      } catch (err) {
        console.error(
          "Resolution failed:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Failed to resolve record"
        );
      } finally {
        setActionId(null);
      }
    };

  /* =========================================
     Manual edit save
     ========================================= */

  const saveEdit = async (
    record: ResolutionRecord
  ) => {
    const value =
      editValue.trim();

    if (!value) {
      setError(
        "Corrected value cannot be empty."
      );

      return;
    }

    await runResolution(
      record,
      "EDIT",
      value
    );
  };

  /* =========================================
     Accept AI suggestion
     ========================================= */

  const acceptSuggestion =
    async (
      record: ResolutionRecord
    ) => {
      if (
        !record.aiSuggestion
      ) {
        setError(
          "No AI suggestion is available for this record. Use Edit to enter a correction manually."
        );

        return;
      }

      await runResolution(
        record,
        "APPROVE",
        record.aiSuggestion
      );
    };

  /* =========================================
     Render
     ========================================= */

  return (
    <div className="resolution-page">

      <div className="page-heading">

        <button
          className="secondary-button"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft
            size={16}
          />
          Back to Dashboard
        </button>

        <h1>
          Resolution Centre
        </h1>

        <p>
          Review validation
          failures, AI suggested
          corrections and manual
          updates before resolving
          records.
        </p>

      </div>

      {/* =====================================
          AI banner
          ===================================== */}

      <div className="resolution-banner">

        <div className="resolution-banner-icon">
          <WandSparkles
            size={25}
          />
        </div>

        <div>

          <h2>
            Suggested Corrections
          </h2>

          <p>
            Suggestions shown here
            come from backend
            FaultLog records and
            their AI suggestion
            fields.
          </p>

        </div>

      </div>

      {/* =====================================
          Summary
          ===================================== */}

      <div className="resolution-summary">

        <div className="resolution-stat">

          <span>
            Awaiting review
          </span>

          <strong>
            {pendingCount}
          </strong>

        </div>

        <div className="resolution-stat">

          <span>
            Accepted / edited
          </span>

          <strong>
            {acceptedCount}
          </strong>

        </div>

        <div className="resolution-stat">

          <span>
            Rejected
          </span>

          <strong>
            {rejectedCount}
          </strong>

        </div>

      </div>

      {/* =====================================
          Message
          ===================================== */}

      {message && (
        <div
          className="resolution-message"
          role="status"
        >
          {message}
        </div>
      )}

      {/* =====================================
          Error
          ===================================== */}

      {error && (
        <div className="rejection-note">

          <AlertTriangle
            size={18}
          />

          <p>
            {error}
          </p>

        </div>
      )}

      {/* =====================================
          Refresh
          ===================================== */}

      <div className="resolution-bottom-actions">

        <p>
          <Clock3
            size={16}
          />
          Resolution data refreshes
          automatically every 2
          seconds.
        </p>

        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            loadRecords()
          }
        >
          <RefreshCw
            size={15}
          />
          Refresh
        </button>

      </div>

      {/* =====================================
          Loading
          ===================================== */}

      {loading &&
        records.length ===
          0 && (
          <div className="resolution-message">
            Loading resolution
            records...
          </div>
        )}

      {/* =====================================
          Empty
          ===================================== */}

      {!loading &&
        records.length ===
          0 && (
          <div className="resolution-message">
            No validation issues
            have been detected yet.
          </div>
        )}

      {/* =====================================
          Records
          ===================================== */}

      <div className="resolution-record-list">

        {records.map(
          (record) => {
            const fileName =
              record.file
                ?.originalName ||
              record.file
                ?.fileName ||
              "Unknown file";

            const confidence =
              formatConfidence(
                record.aiConfidence
              );

            const isPending =
              record.status ===
              "PENDING";

            const isBusy =
              actionId ===
              record.id;

            return (
              <article
                className="resolution-card"
                key={
                  record.id
                }
              >

                {/* Header */}

                <div className="resolution-card-header">

                  <div>

                    <span className="resolution-record-id">
                      {
                        record.id
                      }
                    </span>

                    <h3>
                      {
                        record.columnName
                      }
                    </h3>

                    <p>
                      {fileName}
                      {" · "}
                      Row{" "}
                      {
                        record.rowNumber
                      }
                    </p>

                  </div>

                  <span
                    className={`review-status ${statusClass(
                      record.status
                    )}`}
                  >
                    {displayStatus(
                      record.status
                    )}
                  </span>

                </div>

                {/* Values */}

                <div className="resolution-values">

                  <div className="resolution-value original">

                    <span>
                      Original value
                    </span>

                    <strong>
                      {record.cellValue ||
                        "Empty"}
                    </strong>

                  </div>

                  <div className="resolution-arrow">
                    →
                  </div>

                  <div className="resolution-value suggested">

                    <span>
                      {editingId ===
                      record.id
                        ? "Corrected value"
                        : "AI suggested value"}
                    </span>

                    {editingId ===
                    record.id ? (

                      <input
                        className="resolution-edit-input"
                        aria-label={`Edit corrected value for ${record.id}`}
                        value={
                          editValue
                        }
                        onChange={(
                          event
                        ) =>
                          setEditValue(
                            event
                              .target
                              .value
                          )
                        }
                        autoFocus
                      />

                    ) : (

                      <strong>
                        {record.aiSuggestion ||
                          "No suggestion available"}
                      </strong>

                    )}

                  </div>

                </div>

                {/* Validation reason */}

                <p className="resolution-reason">

                  <AlertTriangle
                    size={16}
                  />

                  {
                    record.errorMessage
                  }

                </p>

                {/* AI explanation */}

                {record.aiExplanation && (
                  <p className="resolution-reason">

                    <WandSparkles
                      size={16}
                    />

                    {
                      record.aiExplanation
                    }

                  </p>
                )}

                {/* Footer */}

                <div className="resolution-card-footer">

                  <span className="confidence-label">

                    {confidence !==
                    null ? (
                      <>
                        AI confidence:{" "}
                        <strong>
                          {
                            confidence
                          }
                          %
                        </strong>
                      </>
                    ) : (
                      <>
                        AI confidence:{" "}
                        <strong>
                          —
                        </strong>
                      </>
                    )}

                  </span>

                  <div className="resolution-actions">

                    {editingId ===
                    record.id ? (
                      <>

                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={
                            cancelEditing
                          }
                        >
                          Cancel
                        </button>

                        <button
                          className="resolution-button accept"
                          type="button"
                          disabled={
                            isBusy
                          }
                          onClick={() =>
                            saveEdit(
                              record
                            )
                          }
                        >
                          <CheckCircle2
                            size={15}
                          />

                          {isBusy
                            ? "Saving..."
                            : "Save edit"}
                        </button>

                      </>
                    ) : (
                      <>

                        <button
                          className="secondary-button"
                          type="button"
                          disabled={
                            !isPending ||
                            isBusy
                          }
                          onClick={() =>
                            startEditing(
                              record
                            )
                          }
                        >
                          <Pencil
                            size={15}
                          />
                          Edit
                        </button>

                        <button
                          className="resolution-button reject"
                          type="button"
                          disabled={
                            !isPending ||
                            isBusy
                          }
                          onClick={() =>
                            runResolution(
                              record,
                              "REJECT"
                            )
                          }
                        >
                          <CircleX
                            size={15}
                          />

                          {isBusy
                            ? "Updating..."
                            : "Reject"}
                        </button>

                        <button
                          className="resolution-button accept"
                          type="button"
                          disabled={
                            !isPending ||
                            isBusy ||
                            !record.aiSuggestion
                          }
                          onClick={() =>
                            acceptSuggestion(
                              record
                            )
                          }
                        >
                          <CheckCircle2
                            size={15}
                          />

                          {isBusy
                            ? "Updating..."
                            : "Accept"}
                        </button>

                      </>
                    )}

                  </div>

                </div>

                {/* Already resolved value */}

                {record.status !==
                  "PENDING" &&
                  record.resolvedValue && (
                    <div className="resolution-message">

                      Resolved value:{" "}
                      <strong>
                        {
                          record.resolvedValue
                        }
                      </strong>

                    </div>
                  )}

              </article>
            );
          }
        )}

      </div>

    </div>
  );
}