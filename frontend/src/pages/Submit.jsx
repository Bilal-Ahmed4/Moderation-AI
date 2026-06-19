import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createSubmission } from "../api/submissions";
import OutcomeBadge from "../components/OutcomeBadge";
import { InlineSpinner } from "../components/LoadingSpinner";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

// Nothing fancy — just makes file sizes readable in the queued files list.
function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Maps a confidence score to a progress bar colour class.
// The thresholds (70 / 40) are intentionally generous — a 68% confidence in
// "Graphic Violence" is still alarming and should look red-ish, not green.
// If the policy team changes the default threshold these might need revisiting.
function scoreClass(c) {
  if (c >= 70) return "progress-red";
  if (c >= 40) return "progress-amber";
  return "progress-green";
}

export default function Submit() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function addFiles(incoming) {
    const imgs = Array.from(incoming).filter((f) =>
      f.type.startsWith("image/"),
    );
    // Dedupe by filename so dragging the same file twice doesn't double it.
    // Not foolproof (two different files named "photo.jpg" would collide) but
    // good enough for this use case — we're not a file manager.
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...imgs.filter((f) => !names.has(f.name))];
    });
  }

  function removeFile(name) {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    addFiles(e.dataTransfer.files);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!files.length) return;
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const data = await createSubmission(files);
      setResult(data);
      setFiles([]);
    } catch (err) {
      setError(
        err.response?.data?.detail || "Submission failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "32px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: "#0F1117" }}>
          Submit images
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
          Upload images to screen against the active moderation policy.
        </div>
      </div>

      {/* Upload card */}
      <div className="card" style={{ padding: 20, marginBottom: 24 }}>
        <form onSubmit={handleSubmit}>
          {/* Drop zone */}
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            style={{
              border: `0.5px dashed ${drag ? "#0F1117" : "#D1D5DB"}`,
              borderRadius: 8,
              padding: "40px 24px",
              textAlign: "center",
              cursor: "pointer",
              background: drag ? "#F9FAFB" : "transparent",
              transition: "border-color 120ms ease, background 120ms ease",
            }}
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
                marginBottom: 12,
              }}
            >
              <i
                className="ti ti-upload"
                style={{ fontSize: 20, color: "#6B7280" }}
              />
            </div>
            <div style={{ fontSize: 14, color: "#0F1117", marginBottom: 4 }}>
              Drop images here or{" "}
              <span
                style={{
                  fontWeight: 500,
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                browse
              </span>
            </div>
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>
              JPEG · PNG · WebP · GIF
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              style={{ display: "none" }}
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div
              style={{
                marginTop: 12,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {files.map((f) => (
                <div
                  key={f.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    border: "0.5px solid #E5E7EB",
                    borderRadius: 8,
                    background: "#F9FAFB",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <i
                      className="ti ti-photo"
                      style={{ fontSize: 15, color: "#9CA3AF", flexShrink: 0 }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: "#0F1117",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {f.name}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#9CA3AF",
                        flexShrink: 0,
                        fontFamily: "monospace",
                      }}
                    >
                      {fmt(f.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(f.name)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "2px 4px",
                      cursor: "pointer",
                      color: "#9CA3AF",
                      display: "flex",
                      alignItems: "center",
                      marginLeft: 8,
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "#0F1117")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "#9CA3AF")
                    }
                  >
                    <i className="ti ti-x" style={{ fontSize: 14 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: 12,
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

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button
              type="submit"
              disabled={!files.length || loading}
              className="btn-primary"
            >
              {loading && <InlineSpinner />}
              {loading
                ? "Analysing…"
                : `Screen ${files.length || ""} image${files.length !== 1 ? "s" : ""}`}
            </button>
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => setFiles([])}
                className="btn-secondary"
              >
                Clear all
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Results */}
      {result && (
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, color: "#0F1117" }}>
              Screening results
            </div>
            <button
              onClick={() => navigate(`/submissions/${result.id}`)}
              className="btn-secondary"
              style={{ fontSize: 13 }}
            >
              View full detail
              <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {result.image_verdicts.map((v) => {
              const img = result.images.find((i) => i.image_id === v.image_id);
              return (
                <div
                  key={v.image_id}
                  className="card"
                  style={{ padding: "16px 20px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#0F1117",
                        }}
                      >
                        {img?.original_filename || v.image_id}
                      </div>
                      <div
                        style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}
                      >
                        Evaluated {new Date(v.evaluated_at).toLocaleString()}
                      </div>
                    </div>
                    <OutcomeBadge outcome={v.overall_outcome} />
                  </div>

                  {v.category_breakdown.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                      }}
                    >
                      {v.category_breakdown.map((c) => (
                        <div key={c.category}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 5,
                            }}
                          >
                            <span style={{ fontSize: 13, color: "#0F1117" }}>
                              {c.category}
                            </span>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
