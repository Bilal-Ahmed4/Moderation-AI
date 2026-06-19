import { useEffect, useState } from "react";
import { getDashboard } from "../../api/analytics";
import LoadingSpinner from "../../components/LoadingSpinner";

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="card" style={{ padding: "20px 20px 16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div className="label">{label}</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            background: "#F3F4F6",
            borderRadius: 8,
          }}
        >
          <i
            className={`ti ${icon}`}
            style={{ fontSize: 16, color: "#6B7280" }}
          />
        </div>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 500,
          color: "#0F1117",
          lineHeight: 1.2,
          fontFamily: "monospace",
        }}
      >
        {value ?? "—"}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// Relative bar chart — each bar is a percentage of the highest value,
// not of the total. That way a single dominant category doesn't make
// everything else look like zero. The min of 1 in the max calculation
// stops a divide-by-zero when the period has no data yet.
function HorizBar({ label, value, max }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
        style={{
          fontSize: 13,
          color: "#0F1117",
          width: 180,
          flexShrink: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 3,
          borderRadius: 9999,
          background: "#E5E7EB",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 9999,
            background: "#0F1117",
            width: `${pct}%`,
            transition: "width 300ms ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          color: "#6B7280",
          fontFamily: "monospace",
          width: 28,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

const thStyle = {
  padding: "9px 16px",
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B7280",
  background: "#F9FAFB",
  textAlign: "left",
  borderBottom: "0.5px solid #E5E7EB",
};

export default function Analytics() {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getDashboard(days)
      .then(setData)
      .catch(() => setError("Failed to load analytics."))
      .finally(() => setLoading(false));
  }, [days]);

  // Seed the spread with [1] so Math.max never gets called with zero args
  // (which returns -Infinity and breaks every bar width calculation).
  const verdictMax = data
    ? Math.max(...(data.verdict_by_outcome?.map((v) => v.count) ?? [1]), 1)
    : 1;
  const catMax = data
    ? Math.max(...(data.verdict_by_category?.map((c) => c.count) ?? [1]), 1)
    : 1;
  const volMax = data
    ? Math.max(...(data.submission_volume?.map((v) => v.count) ?? [1]), 1)
    : 1;

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "#0F1117" }}>
            Analytics
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            Platform-wide moderation metrics
          </div>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="input"
          style={{ width: "auto" }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner className="py-32" />
      ) : error ? (
        <div
          className="card"
          style={{
            padding: 24,
            textAlign: "center",
            color: "#991B1B",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <StatCard
              icon="ti-send"
              label="Total appeals"
              value={data.appeals?.total}
            />
            <StatCard
              icon="ti-clock"
              label="Pending"
              value={data.appeals?.pending}
            />
            <StatCard
              icon="ti-circle-check"
              label="Accepted"
              value={data.appeals?.accepted}
            />
            <StatCard
              icon="ti-chart-pie"
              label="Resolution rate"
              value={
                data.appeals?.resolution_rate != null
                  ? `${data.appeals.resolution_rate.toFixed(0)}%`
                  : "—"
              }
              sub={`${data.appeals?.resolved ?? 0} resolved`}
            />
          </div>

          {/* Charts row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {/* Verdicts by outcome */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#0F1117",
                  marginBottom: 16,
                }}
              >
                Verdicts by outcome
              </div>
              {data.verdict_by_outcome?.length ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {data.verdict_by_outcome.map((v) => (
                    <HorizBar
                      key={v.outcome}
                      label={v.outcome}
                      value={v.count}
                      max={verdictMax}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                  No verdict data.
                </div>
              )}
            </div>

            {/* Detections by category */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#0F1117",
                  marginBottom: 16,
                }}
              >
                Detections by category
              </div>
              {data.verdict_by_category?.length ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {data.verdict_by_category.map((c) => (
                    <HorizBar
                      key={c.category}
                      label={c.category}
                      value={c.count}
                      max={catMax}
                    />
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                  No detections in this period.
                </div>
              )}
            </div>
          </div>

          {/* Volume chart */}
          <div
            className="card"
            style={{ padding: "18px 20px", marginBottom: 16 }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#0F1117",
                marginBottom: 16,
              }}
            >
              Daily submission volume — last {days} days
            </div>
            {data.submission_volume?.length ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 2,
                  height: 80,
                }}
              >
                {data.submission_volume.map((v) => {
                  const h = volMax
                    ? Math.max((v.count / volMax) * 72, v.count ? 3 : 0)
                    : 0;
                  return (
                    <div
                      key={v.date}
                      title={`${v.date}: ${v.count}`}
                      style={{
                        flex: 1,
                        height: `${h}px`,
                        background: "#0F1117",
                        borderRadius: "2px 2px 0 0",
                        opacity: 0.85,
                        cursor: "default",
                        minWidth: 2,
                        transition: "opacity 120ms ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "0.85")
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>
                No submissions in this period.
              </div>
            )}
          </div>

          {/* Top users tables */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            {[
              {
                title: "Top users by submissions",
                key: "top_users_by_submissions",
                valueKey: "count",
                label: "Submissions",
              },
              {
                title: "Top users by violations",
                key: "top_users_by_violations",
                valueKey: "count",
                label: "Violations",
              },
            ].map(({ title, key, valueKey, label }) => (
              <div className="card" style={{ overflow: "hidden" }} key={key}>
                <div
                  style={{
                    padding: "14px 16px",
                    borderBottom: "0.5px solid #E5E7EB",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#0F1117",
                  }}
                >
                  {title}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>#</th>
                      <th style={thStyle}>Email</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>
                        {label}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data[key]?.length ? (
                      data[key].map((u, i) => (
                        <tr
                          key={u.user_id}
                          style={{
                            borderBottom:
                              i < data[key].length - 1
                                ? "0.5px solid #E5E7EB"
                                : "none",
                            transition: "background 120ms ease",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#F3F4F6")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "transparent")
                          }
                        >
                          <td
                            style={{
                              padding: "12px 16px",
                              fontSize: 12,
                              color: "#9CA3AF",
                              fontFamily: "monospace",
                            }}
                          >
                            {i + 1}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontSize: 13,
                              color: "#0F1117",
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {u.email}
                          </td>
                          <td
                            style={{
                              padding: "12px 16px",
                              fontSize: 13,
                              color: "#0F1117",
                              textAlign: "right",
                              fontFamily: "monospace",
                            }}
                          >
                            {u[valueKey]}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            padding: "16px",
                            fontSize: 13,
                            color: "#9CA3AF",
                            textAlign: "center",
                          }}
                        >
                          No data
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
