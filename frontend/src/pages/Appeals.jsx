import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listMyAppeals } from "../api/appeals";
import OutcomeBadge from "../components/OutcomeBadge";
import LoadingSpinner from "../components/LoadingSpinner";

function fmtDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const thStyle = {
  padding: "10px 16px",
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B7280",
  whiteSpace: "nowrap",
  background: "#F9FAFB",
  textAlign: "left",
};

export default function Appeals() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(0);
  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    listMyAppeals({ limit: LIMIT, skip })
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch(() => setError("Failed to load appeals."))
      .finally(() => setLoading(false));
  }, [skip]);

  const totalPages = Math.ceil(total / LIMIT);
  const page = Math.floor(skip / LIMIT) + 1;

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
            Appeals
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            Track appeals you have filed on flagged or blocked images.
          </div>
        </div>
        <Link to="/history" className="btn-secondary">
          View submissions
        </Link>
      </div>

      {loading ? (
        <LoadingSpinner className="py-20" />
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
      ) : items.length === 0 ? (
        /* Empty state */
        <div
          className="card"
          style={{ padding: "64px 24px", textAlign: "center" }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              background: "#F3F4F6",
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <i
              className="ti ti-gavel"
              style={{ fontSize: 20, color: "#9CA3AF" }}
            />
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#0F1117",
              marginBottom: 6,
            }}
          >
            No appeals yet
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#6B7280",
              marginBottom: 20,
              maxWidth: 320,
              margin: "0 auto 20px",
            }}
          >
            Appeals can be filed from a submission's detail page when images are
            flagged or blocked.
          </div>
          <Link to="/history" className="btn-primary">
            Go to history
          </Link>
        </div>
      ) : (
        /* Table */
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                  <th style={thStyle}>Filed</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Submission</th>
                  <th style={thStyle}>Justification</th>
                  <th style={thStyle}>Admin response</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a, idx) => (
                  <tr
                    key={a.id}
                    style={{
                      borderBottom:
                        idx < items.length - 1 ? "0.5px solid #E5E7EB" : "none",
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
                        padding: "14px 16px",
                        fontSize: 12,
                        color: "#6B7280",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {fmtDate(a.created_at)}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <OutcomeBadge outcome={a.status} />
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Link
                        to={`/submissions/${a.submission_id}`}
                        style={{
                          fontSize: 12,
                          color: "#6B7280",
                          fontFamily: "monospace",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#0F1117")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "#6B7280")
                        }
                      >
                        {a.submission_id.slice(-8)}
                        <i
                          className="ti ti-chevron-right"
                          style={{ fontSize: 12 }}
                        />
                      </Link>
                    </td>
                    <td style={{ padding: "14px 16px", maxWidth: 280 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "#0F1117",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={a.justification}
                      >
                        {a.justification}
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", maxWidth: 220 }}>
                      {a.admin_response ? (
                        <div
                          style={{
                            fontSize: 12,
                            color: "#6B7280",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={a.admin_response}
                        >
                          {a.admin_response}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: "#D1D5DB" }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "11px 16px",
                borderTop: "0.5px solid #E5E7EB",
                background: "#F9FAFB",
              }}
            >
              <span style={{ fontSize: 13, color: "#6B7280" }}>
                Page <span style={{ fontFamily: "monospace" }}>{page}</span> of{" "}
                <span style={{ fontFamily: "monospace" }}>{totalPages}</span>
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={skip === 0}
                  onClick={() => setSkip((s) => Math.max(0, s - LIMIT))}
                  className="btn-secondary"
                  style={{ padding: "5px 12px", fontSize: 13 }}
                >
                  <i className="ti ti-chevron-left" style={{ fontSize: 13 }} />{" "}
                  Prev
                </button>
                <button
                  disabled={skip + LIMIT >= total}
                  onClick={() => setSkip((s) => s + LIMIT)}
                  className="btn-secondary"
                  style={{ padding: "5px 12px", fontSize: 13 }}
                >
                  Next{" "}
                  <i className="ti ti-chevron-right" style={{ fontSize: 13 }} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
