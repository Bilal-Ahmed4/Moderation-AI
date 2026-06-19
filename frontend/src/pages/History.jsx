import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSubmissions } from "../api/submissions";
import OutcomeBadge from "../components/OutcomeBadge";
import LoadingSpinner from "../components/LoadingSpinner";

const OUTCOMES = ["", "Approved", "Flagged for Review", "Blocked"];
const CATEGORIES = [
  "",
  "Graphic Violence",
  "Hate Symbols",
  "Self-Harm",
  "Extremist Propaganda",
  "Weapons & Contraband",
  "Harassment & Humiliation",
];

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

export default function History() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [skip, setSkip] = useState(0);
  const LIMIT = 15;

  const [filters, setFilters] = useState({
    outcome: "",
    category: "",
    date_from: "",
    date_to: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { limit: LIMIT, skip };
      // Only send filter params that actually have a value — the backend
      // treats an empty string differently from an absent key on some endpoints.
      if (filters.outcome) params.outcome = filters.outcome;
      if (filters.category) params.category = filters.category;
      // The date inputs give us "YYYY-MM-DD" strings. The API expects ISO 8601
      // with time component, so we convert. new Date("YYYY-MM-DD") parses as
      // midnight UTC which is fine for range queries.
      if (filters.date_from)
        params.date_from = new Date(filters.date_from).toISOString();
      if (filters.date_to)
        params.date_to = new Date(filters.date_to).toISOString();
      const data = await listSubmissions(params);
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Failed to load submissions.");
    } finally {
      setLoading(false);
    }
  }, [filters, skip]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFilter(e) {
    // Reset to page 1 whenever a filter changes — otherwise you can end up
    // on page 5 of a filtered set that only has 2 pages and see nothing.
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
    setSkip(0);
  }

  function clearFilters() {
    setFilters({ outcome: "", category: "", date_from: "", date_to: "" });
    setSkip(0);
  }

  const totalPages = Math.ceil(total / LIMIT);
  const page = Math.floor(skip / LIMIT) + 1;
  const hasFilters = Object.values(filters).some(Boolean);

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
            History
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            <span style={{ fontFamily: "monospace" }}>{total}</span> submission
            {total !== 1 ? "s" : ""}
          </div>
        </div>
        <Link to="/submit" className="btn-primary">
          <i className="ti ti-upload" style={{ fontSize: 14 }} />
          New submission
        </Link>
      </div>

      {/* Filter bar */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div>
            <label className="label">Outcome</label>
            <select
              name="outcome"
              value={filters.outcome}
              onChange={handleFilter}
              className="input"
              style={{ width: 160 }}
            >
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>
                  {o || "All outcomes"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select
              name="category"
              value={filters.category}
              onChange={handleFilter}
              className="input"
              style={{ width: 210 }}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c || "All categories"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From</label>
            <input
              type="date"
              name="date_from"
              value={filters.date_from}
              onChange={handleFilter}
              className="input"
              style={{ width: 148 }}
            />
          </div>
          <div>
            <label className="label">To</label>
            <input
              type="date"
              name="date_to"
              value={filters.date_to}
              onChange={handleFilter}
              className="input"
              style={{ width: 148 }}
            />
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary"
              style={{ alignSelf: "flex-end" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
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
              className="ti ti-inbox"
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
            No submissions found
          </div>
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            {hasFilters
              ? "Try adjusting your filters."
              : "Submit images to get started."}
          </div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "0.5px solid #E5E7EB" }}>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Images</th>
                  <th style={thStyle}>Outcomes</th>
                  <th style={thStyle}>Detections</th>
                  <th style={{ ...thStyle, textAlign: "right" }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((s, idx) => {
                  const outcomes = [
                    ...new Set(s.image_verdicts.map((v) => v.overall_outcome)),
                  ];
                  const detected = [
                    ...new Set(
                      s.image_verdicts.flatMap((v) =>
                        v.category_breakdown
                          .filter((c) => c.result === "detected")
                          .map((c) => c.category),
                      ),
                    ),
                  ];
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom:
                          idx < items.length - 1
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
                          padding: "14px 16px",
                          fontSize: 13,
                          color: "#0F1117",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtDate(s.submitted_at)}
                      </td>
                      <td
                        style={{
                          padding: "14px 16px",
                          fontSize: 13,
                          color: "#6B7280",
                          fontFamily: "monospace",
                        }}
                      >
                        {s.images.length}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <div
                          style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
                        >
                          {outcomes.map((o) => (
                            <OutcomeBadge key={o} outcome={o} />
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        {detected.length === 0 ? (
                          <span style={{ fontSize: 12, color: "#D1D5DB" }}>
                            —
                          </span>
                        ) : (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 4,
                            }}
                          >
                            {detected.map((d) => (
                              <span
                                key={d}
                                className="badge-red"
                                style={{ fontSize: 11 }}
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <Link
                          to={`/submissions/${s.id}`}
                          style={{
                            fontSize: 13,
                            color: "#6B7280",
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
                          View
                          <i
                            className="ti ti-chevron-right"
                            style={{ fontSize: 13 }}
                          />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
