import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Files,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";

import {
  getAnalytics,
  type AnalyticsSummary,
} from "../services/analyticsApi";

interface AnalyticsProps {
  onBack: () => void;
}

function formatDuration(
  ms: number
) {
  if (!ms || ms <= 0) {
    return "—";
  }

  const seconds =
    Math.round(ms / 1000);

  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes =
    Math.floor(seconds / 60);

  const remaining =
    seconds % 60;

  return `${minutes}m ${remaining}s`;
}

function displayFileType(
  type: string
) {
  switch (type) {
    case "PAYMENTS":
      return "Payments";

    case "BANK_TRANSACTIONS":
      return "Transactions";

    case "ACCOUNTS":
      return "Accounts";

    case "RATES":
      return "Rates";

    default:
      return type;
  }
}

function formatChartTime(
  value: string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleTimeString(
    [],
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

export default function Analytics({
  onBack,
}: AnalyticsProps) {
  const [
    analytics,
    setAnalytics,
  ] =
    useState<AnalyticsSummary | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const loadAnalytics =
    useCallback(
      async (
        silent = false
      ) => {
        try {
          if (!silent) {
            setLoading(true);
          }

          const data =
            await getAnalytics();

          setAnalytics(data);
          setError("");
        } catch (err) {
          console.error(
            "Analytics load failed:",
            err
          );

          setError(
            err instanceof Error
              ? err.message
              : "Failed to load analytics"
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
    loadAnalytics();

    const interval =
      window.setInterval(
        () => {
          loadAnalytics(true);
        },
        2000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, [loadAnalytics]);

  const statusData =
    useMemo(
      () => [
        {
          name: "Completed",
          value:
            analytics
              ?.completedFiles ??
            0,
          color: "#16a36a",
        },

        {
          name: "Failed",
          value:
            analytics
              ?.failedFiles ??
            0,
          color: "#e05252",
        },

        {
          name: "Processing",
          value:
            analytics
              ?.activeProcessing ??
            0,
          color: "#3478f6",
        },

        {
          name: "Queued",
          value:
            analytics
              ?.queuedFiles ??
            0,
          color: "#e6a23c",
        },

        {
          name: "Needs Review",
          value:
            analytics
              ?.needsReviewFiles ??
            0,
          color: "#d97706",
        },
      ],
      [analytics]
    );

  const typeData =
    useMemo(() => {
      return (
        analytics
          ?.fileTypeStats ??
        []
      ).map(
        (item) => ({
          type:
            displayFileType(
              item.type
            ),

          files:
            item.files,
        })
      );
    }, [analytics]);

  const processingData =
    useMemo(() => {
      return (
        analytics
          ?.processingTimeHistory ??
        []
      ).map(
        (item) => ({
          time:
            formatChartTime(
              item.time
            ),

          actual:
            item.actual != null
              ? Number(
                  (
                    item.actual /
                    60000
                  ).toFixed(2)
                )
              : null,

          predicted:
            item.predicted !=
            null
              ? Number(
                  (
                    item.predicted /
                    60000
                  ).toFixed(2)
                )
              : null,
        })
      );
    }, [analytics]);

  const metricCards =
    useMemo(
      () => [
        {
          label:
            "Files processed",

          value:
            analytics
              ?.totalFiles ??
            0,

          detail:
            `${analytics?.activeProcessing ?? 0} currently processing`,

          icon: Files,

          className:
            "analytics-blue",
        },

        {
          label:
            "Successful files",

          value:
            analytics
              ?.completedFiles ??
            0,

          detail:
            `${analytics?.failedFiles ?? 0} failed`,

          icon:
            CheckCircle2,

          className:
            "analytics-green",
        },

        {
          label:
            "Average processing",

          value:
            formatDuration(
              analytics
                ?.averageProcessingTimeMs ??
                0
            ),

          detail:
            `${analytics?.systemThroughput ?? 0} rows/sec`,

          icon: Clock,

          className:
            "analytics-purple",
        },

        {
          label:
            "Anomalies detected",

          value:
            analytics
              ?.totalAnomalies ??
            0,

          detail:
            `${analytics?.pendingRejections ?? 0} pending validation issues`,

          icon:
            ShieldAlert,

          className:
            "analytics-orange",
        },
      ],
      [analytics]
    );

  const hasStatusData =
    statusData.some(
      (item) =>
        item.value > 0
    );

  return (
    <div className="analytics-page">

      <div className="page-heading">

        <button
          className="secondary-button"
          type="button"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>

        <h1>
          Processing Analytics
        </h1>

        <p>
          Review live file
          throughput, processing
          times and validation
          outcomes.
        </p>

      </div>

      <div className="analytics-demo-note">

        <Activity
          size={17}
        />

        <span>
          Live analytics from the
          processing backend.
        </span>

        <button
          className="secondary-button"
          type="button"
          onClick={() =>
            loadAnalytics()
          }
        >
          <RefreshCw
            size={15}
          />
          Refresh
        </button>

      </div>

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

      {loading &&
        !analytics && (
          <div className="analytics-demo-note">

            <Activity
              size={17}
            />

            <span>
              Loading analytics...
            </span>

          </div>
        )}

      <div className="analytics-metrics">

        {metricCards.map(
          (metric) => {
            const Icon =
              metric.icon;

            return (
              <article
                className="analytics-metric"
                key={
                  metric.label
                }
              >

                <div
                  className={`analytics-metric-icon ${metric.className}`}
                >
                  <Icon
                    size={21}
                  />
                </div>

                <div>

                  <span>
                    {
                      metric.label
                    }
                  </span>

                  <strong>
                    {
                      metric.value
                    }
                  </strong>

                  <small>
                    {
                      metric.detail
                    }
                  </small>

                </div>

              </article>
            );
          }
        )}

      </div>

      <div className="analytics-chart-grid">

        {/* Processing Status */}

        <section className="panel analytics-chart-panel">

          <div className="panel-heading">

            <div>

              <h2>
                Processing Status
              </h2>

              <p>
                Live distribution
                by file status
              </p>

            </div>

          </div>

          <div className="analytics-chart">

            {hasStatusData ? (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <PieChart>

                  <Pie
                    data={
                      statusData
                    }
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={
                      58
                    }
                    outerRadius={
                      88
                    }
                    paddingAngle={
                      3
                    }
                  >

                    {statusData.map(
                      (entry) => (
                        <Cell
                          key={
                            entry.name
                          }
                          fill={
                            entry.color
                          }
                        />
                      )
                    )}

                  </Pie>

                  <Tooltip />

                  <Legend
                    verticalAlign="bottom"
                  />

                </PieChart>

              </ResponsiveContainer>

            ) : (

              <div className="empty-state">
                No file status data
                available yet.
              </div>

            )}

          </div>

        </section>

        {/* Files by Type */}

        <section className="panel analytics-chart-panel">

          <div className="panel-heading">

            <div>

              <h2>
                Files by Type
              </h2>

              <p>
                Processing volume
                across file
                categories
              </p>

            </div>

          </div>

          <div className="analytics-chart">

            {typeData.length >
            0 ? (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart
                  data={
                    typeData
                  }
                  margin={{
                    top: 10,
                    right: 12,
                    left: -15,
                    bottom: 5,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={
                      false
                    }
                  />

                  <XAxis
                    dataKey="type"
                    tick={{
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    allowDecimals={
                      false
                    }
                  />

                  <Tooltip />

                  <Bar
                    dataKey="files"
                    name="Files"
                    fill="#064E3B"
                    radius={[
                      5,
                      5,
                      0,
                      0,
                    ]}
                  />

                </BarChart>

              </ResponsiveContainer>

            ) : (

              <div className="empty-state">
                No file type data
                available yet.
              </div>

            )}

          </div>

        </section>

        {/* Processing Time */}

        <section className="panel analytics-chart-panel wide">

          <div className="panel-heading">

            <div>

              <h2>
                Actual vs Predicted
                Processing Time
              </h2>

              <p>
                Processing-time
                comparison in minutes
              </p>

            </div>

          </div>

          <div className="analytics-chart analytics-line-chart">

            {processingData.length >
            0 ? (

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <LineChart
                  data={
                    processingData
                  }
                  margin={{
                    top: 10,
                    right: 20,
                    left: 0,
                    bottom: 5,
                  }}
                >

                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={
                      false
                    }
                  />

                  <XAxis
                    dataKey="time"
                  />

                  <YAxis
                    unit=" min"
                  />

                  <Tooltip />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Actual"
                    stroke="#3478f6"
                    strokeWidth={
                      3
                    }
                    dot={{
                      r: 4,
                    }}
                    connectNulls
                  />

                  <Line
                    type="monotone"
                    dataKey="predicted"
                    name="Predicted"
                    stroke="#16a36a"
                    strokeWidth={
                      3
                    }
                    strokeDasharray="5 5"
                    dot={{
                      r: 4,
                    }}
                    connectNulls
                  />

                </LineChart>

              </ResponsiveContainer>

            ) : (

              <div className="empty-state">
                Processing-time data
                will appear after
                files are completed.
              </div>

            )}

          </div>

        </section>

      </div>

    </div>
  );
}