import {
  Files,
  CheckCircle2,
  CircleX,
  Clock3,
  Hourglass,
} from "lucide-react";

import type {
  DashboardSummary,
} from "../services/dashboardApi";

interface DashboardCardsProps {
  summary: DashboardSummary | null;
}

function formatDuration(ms: number) {
  if (!ms) {
    return "—";
  }

  const seconds =
    Math.round(ms / 1000);

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    seconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

export default function DashboardCards({
  summary,
}: DashboardCardsProps) {
  const completed =
    summary?.completedFiles ?? 0;

  const failed =
    summary?.failedFiles ?? 0;

  const needsReview =
    summary?.needsReviewFiles ?? 0;

  const finishedFiles =
    completed +
    failed +
    needsReview;

  const successRate =
    finishedFiles > 0
      ? (
          (completed /
            finishedFiles) *
          100
        ).toFixed(1)
      : "0.0";

  const metrics = [
    {
      title: "Total Files",
      value:
        summary?.totalFiles ?? 0,
      subtitle: "All received files",
      change: `${
        summary?.activeProcessing ?? 0
      } processing`,
      icon: Files,
      color: "blue",
    },

    {
      title: "Success Rate",
      value: `${successRate}%`,
      subtitle: "Completed files",
      change: `${completed} completed`,
      icon: CheckCircle2,
      color: "green",
    },

    {
      title: "Failed Files",
      value:
        summary?.failedFiles ?? 0,
      subtitle: "Processing failures",
      change: `${needsReview} need review`,
      icon: CircleX,
      color: "red",
    },

    {
      title: "Avg. Processing Time",
      value: formatDuration(
        summary
          ?.averageProcessingTimeMs ??
          0
      ),
      subtitle: "Per completed file",
      change: `${
        summary?.systemThroughput ??
        0
      } rows/s`,
      icon: Clock3,
      color: "purple",
    },

    {
      title: "Pending / Queued",
      value:
        summary?.queuedFiles ?? 0,
      subtitle: "Waiting to process",
      change: `${
        summary?.worker
          ?.activeJobs ?? 0
      } active`,
      icon: Hourglass,
      color: "orange",
    },
  ];

  return (
    <section className="kpi-grid">

      {metrics.map(
        (metric) => {
          const Icon =
            metric.icon;

          return (
            <article
              className={`kpi-card ${metric.color}`}
              key={
                metric.title
              }
            >
              <div className="kpi-icon">
                <Icon
                  size={23}
                />
              </div>

              <div className="kpi-content">

                <p className="kpi-title">
                  {
                    metric.title
                  }
                </p>

                <h2>
                  {metric.value}
                </h2>

                <p className="kpi-subtitle">

                  {
                    metric.subtitle
                  }

                  <span className="kpi-change">
                    {
                      metric.change
                    }
                  </span>

                </p>

              </div>

            </article>
          );
        }
      )}

    </section>
  );
}