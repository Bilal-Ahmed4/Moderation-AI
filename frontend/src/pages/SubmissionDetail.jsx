import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSubmission, getImageUrl } from "../api/submissions";
import { fileAppeal } from "../api/appeals";
import OutcomeBadge from "../components/OutcomeBadge";
import LoadingSpinner from "../components/LoadingSpinner";
import { InlineSpinner } from "../components/LoadingSpinner";

function fmtDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

// Same thresholds as Submit.jsx. If you change one, change both.
// TODO: pull these out into a shared constants file so they can't drift apart.
function scoreClass(c) {
  if (c >= 70) return "progress-red";
  if (c >= 40) return "progress-amber";
  return "progress-green";
}

function AppealModal({ submissionId, imageId, onClose, onSuccess }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (text.length < 10) {
      setError("Justification must be at least 10 characters.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await fileAppeal(submissionId, imageId, text);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to file appeal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(15,17,23,0.45)",
      }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 440, padding: 24 }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: "#0F1117",
            marginBottom: 6,
          }}
        >
          File an appeal
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>
          Explain why this verdict is incorrect. Appeals are reviewed by an
          admin.
        </div>
        {error && (
          <div
            style={{
              marginBottom: 12,
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
        <form onSubmit={submit}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="input"
            placeholder="Describe why this verdict is incorrect (min. 10 characters)…"
            style={{ marginBottom: 16 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading && <InlineSpinner />}
              {loading ? "Submitting…" : "Submit appeal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImageVerdict({ verdict, image, submissionId }) {
  const [appealing, setAppealing] = useState(false);
  const [appealed, setAppealed] = useState(!!verdict.appeal_override);

  // Only Flagged and Blocked verdicts are appealable — Approved ones obviously
  // don't need it. Also hide the button once an appeal is already filed so
  // the user can't spam duplicate appeals on the same image.
  const canAppeal =
    !appealed &&
    !verdict.appeal_override &&
    (verdict.overall_outcome === "Flagged for Review" ||
      verdict.overall_outcome === "Blocked");

  return (
    <div className="card" style={{ overflow: "hidden", marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr" }}>
        {/* Left panel — image + metadata */}
        <div
          style={{
            borderRight: "0.5px solid #E5E7EB",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Thumbnail */}
          <div
            style={{
              background: "#F9FAFB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 180,
              borderBottom: "0.5px solid #E5E7EB",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <img
              // Prefer the Cloudinary URL stored directly on the image object.
              // That's a plain HTTPS URL — no auth needed, loads instantly.
              // Fall back to the API proxy only for legacy disk-stored images
              // that predate Cloudinary (the proxy handles the ?token= auth).
              src={
                image?.image_url || getImageUrl(submissionId, verdict.image_id)
              }
              alt={image?.original_filename}
              style={{
                maxHeight: "100%",
                maxWidth: "100%",
                objectFit: "contain",
              }}
              // If the image fails to load (deleted file, expired signed URL, etc.)
              // we hide the broken img tag and show the placeholder icon instead.
              // nextSibling is the fallback div rendered right below — fragile but
              // it avoids a separate state variable just for this.
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <div
              style={{
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: "100%",
              }}
            >
              <i
                className="ti ti-photo"
                style={{ fontSize: 32, color: "#D1D5DB" }}
              />
            </div>
          </div>

          {/* Metadata */}
          <div
            style={{
              padding: "14px 16px",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#0F1117",
                  wordBreak: "break-all",
                  marginBottom: 3,
                }}
              >
                {image?.original_filename || verdict.image_id}
              </div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                {fmtDate(verdict.evaluated_at)}
              </div>
            </div>

            <OutcomeBadge outcome={verdict.overall_outcome} />

            {verdict.appeal_override && (
              <div
                style={{
                  padding: "8px 10px",
                  background: "#F0FDF4",
                  border: "0.5px solid #BBF7D0",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#166534",
                }}
              >
                Appeal accepted — verdict overridden
              </div>
            )}

            {canAppeal && (
              <button
                onClick={() => setAppealing(true)}
                className="btn-secondary"
                style={{ fontSize: 12, padding: "6px 10px" }}
              >
                <i className="ti ti-gavel" style={{ fontSize: 13 }} />
                File an appeal
              </button>
            )}
            {appealed && !verdict.appeal_override && (
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                Appeal pending review
              </div>
            )}
          </div>
        </div>

        {/* Right panel — category breakdown */}
        <div style={{ padding: "16px 20px" }}>
          <div className="label" style={{ marginBottom: 14 }}>
            Category breakdown
          </div>
          {verdict.category_breakdown.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {verdict.category_breakdown.map((c) => (
                <div key={c.category}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#0F1117" }}>
                      {c.category}
                    </span>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 10 }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: "#6B7280",
                          fontFamily: "monospace",
                        }}
                      >
                        {c.confidence.toFixed(0)}%
                      </span>
                      <OutcomeBadge outcome={c.result} />
                    </div>
                  </div>
                  <div className="progress-bar">
                    <div
                      className={`progress-bar-fill ${scoreClass(c.confidence)}`}
                      style={{ width: `${c.confidence}%` }}
                    />
                  </div>
                  {c.reasoning && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        marginTop: 6,
                        lineHeight: 1.55,
                      }}
                    >
                      {c.reasoning}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>
              No category data available.
            </div>
          )}
        </div>
      </div>

      {appealing && (
        <AppealModal
          submissionId={submissionId}
          imageId={verdict.image_id}
          onClose={() => setAppealing(false)}
          onSuccess={() => {
            setAppealing(false);
            setAppealed(true);
          }}
        />
      )}
    </div>
  );
}

export default function SubmissionDetail() {
  const { id } = useParams();
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getSubmission(id)
      .then(setSub)
      .catch(() => setError("Submission not found."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner className="py-40" />;

  if (error)
    return (
      <div style={{ padding: 32 }}>
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <i
            className="ti ti-alert-triangle"
            style={{
              fontSize: 32,
              color: "#9CA3AF",
              display: "block",
              marginBottom: 12,
            }}
          />
          <div style={{ fontSize: 14, color: "#0F1117" }}>{error}</div>
        </div>
      </div>
    );

  return (
    <div style={{ padding: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: "#0F1117" }}>
          Submission detail
        </div>
        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
          {fmtDate(sub.submitted_at)} ·{" "}
          <span style={{ fontFamily: "monospace" }}>{sub.images.length}</span>{" "}
          image{sub.images.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Verdict cards */}
      {sub.image_verdicts.map((v) => (
        <ImageVerdict
          key={v.image_id}
          verdict={v}
          image={sub.images.find((i) => i.image_id === v.image_id)}
          submissionId={sub.id}
        />
      ))}
    </div>
  );
}
