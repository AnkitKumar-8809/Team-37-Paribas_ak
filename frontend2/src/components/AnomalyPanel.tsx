import {
  AlertTriangle,
  BrainCircuit,
} from "lucide-react";

export interface AnomalyRecord {
  id: string;

  rowNumber?:
    | number
    | null;

  anomalyType: string;

  description?:
    | string
    | null;

  score?:
    | number
    | null;

  details?: {
    rule_ref?: string;
    method?: string;
    level?: string;
  } | null;

  reviewed?: boolean;

  createdAt?: string;
}

interface AnomalyPanelProps {
  anomalies:
    AnomalyRecord[];
}

function formatType(
  value: string
) {
  return value
    .replaceAll(
      "_",
      " "
    )
    .toLowerCase()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatScore(
  score?:
    | number
    | null
) {
  if (
    score === null ||
    score === undefined
  ) {
    return "—";
  }

  /**
   * New ML scores are 0 → 1.
   * This also tolerates an old score
   * already stored as a percentage.
   */
  const percentage =
    score <= 1
      ? score * 100
      : score;

  return `${Math.round(
    percentage
  )}%`;
}

export default function AnomalyPanel({
  anomalies,
}: AnomalyPanelProps) {
  if (
    anomalies.length ===
    0
  ) {
    return null;
  }

  return (
    <section className="details-panel">

      <div className="details-section-heading">

        <div>
          <h2>
            ML Anomaly Detection
          </h2>

          <p>
            Valid records flagged
            by Layer 2 anomaly
            analysis.
          </p>
        </div>

        <BrainCircuit
          size={20}
        />

      </div>

      <div className="details-note">

        <AlertTriangle
          size={16}
        />

        <span>
          {anomalies.length}{" "}
          {anomalies.length ===
          1
            ? "anomaly"
            : "anomalies"}{" "}
          detected. Anomalies are
          flagged for review and
          are not automatically
          rejected.
        </span>

      </div>

      <div className="table-wrapper">

        <table className="file-table">

          <thead>
            <tr>

              <th>
                Row
              </th>

              <th>
                Anomaly
              </th>

              <th>
                Level
              </th>

              <th>
                Method
              </th>

              <th>
                Score
              </th>

              <th>
                Explanation
              </th>

              <th>
                Rule
              </th>

            </tr>
          </thead>

          <tbody>

            {anomalies.map(
              (
                anomaly
              ) => (
                <tr
                  key={
                    anomaly.id
                  }
                >

                  <td>
                    {anomaly.rowNumber ??
                      "File"}
                  </td>

                  <td>
                    <strong>
                      {formatType(
                        anomaly.anomalyType
                      )}
                    </strong>
                  </td>

                  <td>
                    {anomaly.details
                      ?.level ||
                      "RECORD"}
                  </td>

                  <td>
                    {anomaly.details
                      ?.method ||
                      "—"}
                  </td>

                  <td>
                    <strong>
                      {formatScore(
                        anomaly.score
                      )}
                    </strong>
                  </td>

                  <td>
                    {anomaly.description ||
                      "—"}
                  </td>

                  <td>
                    {anomaly.details
                      ?.rule_ref ||
                      "—"}
                  </td>

                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

    </section>
  );
}