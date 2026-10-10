import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";

import type {
  DashboardFile,
} from "../services/dashboardApi";

interface DashboardChartsProps {
  files: DashboardFile[];
}

function displayFileType(
  type: DashboardFile["fileType"]
) {
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
      return type;
  }
}

export default function DashboardCharts({
  files,
}: DashboardChartsProps) {
  const statusData = [
    {
      name: "Completed",
      value: files.filter(
        (file) =>
          file.status === "COMPLETED"
      ).length,
      color: "#18a878",
    },
    {
      name: "Failed",
      value: files.filter(
        (file) =>
          file.status === "FAILED"
      ).length,
      color: "#e65362",
    },
    {
      name: "Processing",
      value: files.filter(
        (file) =>
          file.status === "PROCESSING"
      ).length,
      color: "#3978e8",
    },
    {
      name: "Queued",
      value: files.filter(
        (file) =>
          file.status === "QUEUED"
      ).length,
      color: "#e6a23c",
    },
    {
      name: "Needs Review",
      value: files.filter(
        (file) =>
          file.status === "NEEDS_REVIEW"
      ).length,
      color: "#d97706",
    },
  ];

  const fileTypeData = [
    "PAYMENTS",
    "BANK_TRANSACTIONS",
    "ACCOUNTS",
    "RATES",
  ].map((type) => ({
    type: displayFileType(
      type as DashboardFile["fileType"]
    ),

    files: files.filter(
      (file) =>
        file.fileType === type
    ).length,
  }));

  const processingTimeData =
    files
      .filter(
        (file) =>
          file.actualDurationMs ||
          file.predictedDurationMs
      )
      .slice(0, 10)
      .reverse()
      .map((file) => ({
        time: new Date(
          file.receivedAt
        ).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),

        actual:
          file.actualDurationMs != null
            ? Number(
                (
                  file.actualDurationMs /
                  60000
                ).toFixed(2)
              )
            : null,

        predicted:
          file.predictedDurationMs != null
            ? Number(
                (
                  file.predictedDurationMs /
                  60000
                ).toFixed(2)
              )
            : null,
      }));

  const hasStatusData =
    statusData.some(
      (item) => item.value > 0
    );

  return (
    <section className="charts-grid">
      {/* Processing Status */}
      <article className="panel chart-panel">
        <div className="chart-heading">
          <h3>Processing Status</h3>
          <p>
            Distribution of incoming files
          </p>
        </div>

        <div className="chart-container">
          {hasStatusData ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={57}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {statusData.map(
                    (item) => (
                      <Cell
                        key={item.name}
                        fill={item.color}
                      />
                    )
                  )}
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              No file status data yet.
            </div>
          )}
        </div>

        <div className="chart-legend">
          {statusData.map((item) => (
            <div
              key={item.name}
              className="legend-item"
            >
              <span
                className="legend-dot"
                style={{
                  backgroundColor:
                    item.color,
                }}
              />

              <span>{item.name}</span>

              <strong>
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      </article>

      {/* Files by Type */}
      <article className="panel chart-panel">
        <div className="chart-heading">
          <h3>Files by Type</h3>
          <p>
            Processing volume by category
          </p>
        </div>

        <div className="chart-container">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart
              data={fileTypeData}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e9edf4"
              />

              <XAxis
                dataKey="type"
                tick={{
                  fontSize: 10,
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                allowDecimals={false}
                tick={{
                  fontSize: 10,
                }}
                axisLine={false}
                tickLine={false}
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
        </div>
      </article>

      {/* Actual vs Predicted Time */}
      <article className="panel chart-panel time-chart-panel">
        <div className="chart-heading">
          <h3>
            Actual vs Predicted Processing Time
          </h3>

          <p>
            Recent file processing time
            in minutes
          </p>
        </div>

        <div className="chart-container">
          {processingTimeData.length >
          0 ? (
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <LineChart
                data={
                  processingTimeData
                }
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e9edf4"
                />

                <XAxis
                  dataKey="time"
                  tick={{
                    fontSize: 10,
                  }}
                  axisLine={false}
                  tickLine={false}
                />

                <YAxis
                  tick={{
                    fontSize: 10,
                  }}
                  axisLine={false}
                  tickLine={false}
                  unit="m"
                />

                <Tooltip />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Actual"
                  stroke="#3978e8"
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                  }}
                  connectNulls
                />

                <Line
                  type="monotone"
                  dataKey="predicted"
                  name="Predicted"
                  stroke="#8c62df"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{
                    r: 3,
                  }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              Processing time data will
              appear after files are
              processed.
            </div>
          )}
        </div>
      </article>
    </section>
  );
}