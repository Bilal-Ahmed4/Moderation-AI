import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAppealsQueue, resolveAppeal } from "../../api/appeals";
import LoadingSpinner from "../../components/LoadingSpinner";
import { InlineSpinner } from "../../components/LoadingSpinner";

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
  borderBottom: "0.5px solid #E5E7EB",
};

// Inline expand/collapse per row instead of a modal. Modals are annoying
// when you're reviewing a queue of 20+ appeals — you'd be opening and closing
// the same modal over and over. This way the admin can scan through without
// losing their place in the table.
function ReviewRow({ appeal, onResolved }) {
  const [open, setOpen] = useState(false);
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function resolve(action) {
    setLoading(true);
    setError("");
    try {
      await resolveAppeal(appeal.id, action, response);
      // Remove the row from the list immediately rather than waiting for a
      // refetch. Feels snappier and the parent's state is the source of truth.
      onResolved(appeal.id);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resolve appeal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <tr
        style={{
          borderBottom: "0.5px solid #E5E7EB",
          transition: "background 120ms ease",
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = "#F3F4F6";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <td
          style={{
            padding: "14px 16px",
            fontSize: 12,
            color: "#6B7280",
            whiteSpace: "nowrap",
          }}
        >
          {fmtDate(appeal.created_at)}
        </td>
        <td style={{ padding: "14px 16px" }}>
          <Link
            to={`/submissions/${appeal.submission_id}`}
            style={{
              fontSize: 12,
              color: "#6B7280",
              fontFamily: "monospace",
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#0F1117")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6B7280")}
          >
            {appeal.submission_id.slice(-8)}
            <i className="ti ti-arrow-up-right" style={{ fontSize: 11 }} />
          </Link>
        </td>
        <td style={{ padding: "14px 16px", maxWidth: 340 }}>
          <div
            style={{
              fontSize: 13,
              color: "#0F1117",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={appeal.justification}
          >
            {appeal.justification}
          </div>
        </td>
        <td style={{ padding: "14px 16px", textAlign: "right" }}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="btn-secondary"
            style={{ padding: "5px 12px", fontSize: 12 }}
          >
            {open ? "Close" : "Review"}
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td
            colSpan={4}
            style={{
              background: "#F9FAFB",
              borderBottom: "0.5px solid #E5E7EB",
              padding: 0,
            }}
          >
            <div style={{ padding: "16px 20px" }}>
              <div className="card" style={{ padding: "20px" }}>
                {/* Full justification */}
                <div style={{ marginBottom: 16 }}>
                  <div className="label" style={{ marginBottom: 6 }}>
                    Justification
                  </div>
                  <div
                    style={{ fontSize: 13, color: "#0F1117", lineHeight: 1.6 }}
                  >
                    {appeal.justification}
                  </div>
                </div>

                {error && (
                  <div
                    style={{
                      marginBottom: 14,
                      padding: "10px 14px",
                      background: "#FEF2F2",
                      border: "0.5px solid #FECACA",
                      borderRadius: 8,
                      fontSize: 13,
                      color: "#991B1B",
                    }}
                  >
                    {error}
                  </div>
                )}

                {/* Admin response */}
                <div style={{ marginBottom: 16 }}>
                  <label className="label">
                    Admin response{" "}
                    <span
                      style={{
                        textTransform: "none",
                        fontSize: 11,
                        color: "#9CA3AF",
                      }}
                    >
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={2}
                    className="input"
                    placeholder="Provide feedback to the user…"
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    disabled={loading}
                    onClick={() => resolve("accepted")}
                    className="btn-primary"
                    style={{ fontSize: 13 }}
                  >
                    {loading && <InlineSpinner />}
                    <i
                      className="ti ti-circle-check"
                      style={{ fontSize: 14 }}
                    />
                    Accept
                  </button>
                  <button
                    disabled={loading}
                    onClick={() => resolve("rejected")}
                    className="btn-secondary"
                    style={{ fontSize: 13 }}
                  >
                    {loading && <InlineSpinner />}
                    <i className="ti ti-x" style={{ fontSize: 14 }} />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AppealsQueue() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(0);
  const LIMIT = 20;

  function load() {
    setLoading(true);
    getAppealsQueue({ limit: LIMIT, skip })
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch(() => setError("Failed to load queue."))
      .finally(() => setLoading(false));
  }

  useEffect(load, [skip]);

  function onResolved(id) {
    setItems((prev) => prev.filter((a) => a.id !== id));
    setTotal((t) => t - 1);
  }

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
            Appeal queue
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            <span style={{ fontFamily: "monospace" }}>{total}</span> pending
            appeal{total !== 1 ? "s" : ""} awaiting review
          </div>
        </div>
        <button onClick={load} className="btn-secondary">
          <i className="ti ti-refresh" style={{ fontSize: 14 }} />
          Refresh
        </button>
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
        <div
          className="card"
          style={{ padding: "56px 24px", textAlign: "center" }}
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
              marginBottom: 14,
            }}
          >
            <i
              className="ti ti-list-check"
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
            Queue is empty
          </div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            All appeals have been reviewed.
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Filed</th>
                  <th style={thStyle}>Submission</th>
                  <th style={thStyle}>Justification</th>
                  <th style={{ ...thStyle, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <ReviewRow key={a.id} appeal={a} onResolved={onResolved} />
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
                  <i className="ti ti-chevron-left" style={{ fontSize: 13 }} />
                  Prev
                </button>
                <button
                  disabled={skip + LIMIT >= total}
                  onClick={() => setSkip((s) => s + LIMIT)}
                  className="btn-secondary"
                  style={{ padding: "5px 12px", fontSize: 13 }}
                >
                  Next
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
