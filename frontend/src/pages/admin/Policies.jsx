import { useEffect, useState } from "react";
import { getActivePolicy, listPolicies, savePolicy } from "../../api/policies";
import LoadingSpinner from "../../components/LoadingSpinner";
import { InlineSpinner } from "../../components/LoadingSpinner";

const CATEGORIES = [
  "Graphic Violence",
  "Hate Symbols",
  "Self-Harm",
  "Extremist Propaganda",
  "Weapons & Contraband",
  "Harassment & Humiliation",
];

const ENFORCEMENTS = ["Flag for Review", "Auto-Block"];

// Merge the saved policy categories with our hardcoded list. We always
// iterate over the local CATEGORIES constant (not the saved ones) so that
// if a new category is added to the code it shows up in the form even if it
// isn't in the database yet. Defaults: enabled, 75% threshold, flag (not block)
// — conservative enough that nothing gets auto-blocked on a fresh install.
function defaultCategories(existing) {
  return CATEGORIES.map((cat) => {
    const e = existing?.find((c) => c.category === cat);
    return {
      category: cat,
      enabled: e?.enabled ?? true,
      threshold: e?.threshold ?? 75,
      enforcement: e?.enforcement ?? "Flag for Review",
    };
  });
}

// Custom toggle because the Tailwind peer hack for checkboxes doesn't play
// well with our no-shadow, no-indigo design system, and a <input type=checkbox>
// is basically unstyable cross-browser without hacks.
// This is a button with role="switch" so screen readers treat it correctly.
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 9999,
        background: checked ? "#0F1117" : "#E5E7EB",
        border: "none",
        cursor: "pointer",
        position: "relative",
        transition: "background 120ms ease",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: checked ? 19 : 3,
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#FFFFFF",
          transition: "left 120ms ease",
        }}
      />
    </button>
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

export default function Policies() {
  const [active, setActive] = useState(null);
  const [history, setHistory] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    Promise.all([getActivePolicy(), listPolicies()])
      .then(([act, list]) => {
        setActive(act);
        setHistory(list.items ?? []);
        setForm(defaultCategories(act?.categories));
      })
      .catch(() => setError("Failed to load policies."))
      .finally(() => setLoading(false));
  }, []);

  function updateCategory(idx, field, value) {
    setForm((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const saved = await savePolicy(form);
      setActive(saved);
      setHistory((h) => [saved, ...h]);
      setSuccess(`Version ${saved.version} saved and activated.`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to save policy.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner className="py-40" />;

  return (
    <div style={{ padding: 32, maxWidth: 840, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: "#0F1117" }}>
          Moderation policies
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
          Active: version{" "}
          <span style={{ fontFamily: "monospace", color: "#0F1117" }}>
            {active?.version ?? "—"}
          </span>
          {" · "}
          Each save creates a new immutable version.
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
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
      {success && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "#F0FDF4",
            border: "0.5px solid #BBF7D0",
            borderRadius: 8,
            fontSize: 13,
            color: "#166534",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <i className="ti ti-circle-check" style={{ fontSize: 14 }} />
          {success}
        </div>
      )}

      {/* Category form */}
      {form && (
        <form onSubmit={handleSave}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {form.map((cat, idx) => (
              <div
                key={cat.category}
                className="card"
                style={{
                  padding: "16px 20px",
                  opacity: cat.enabled ? 1 : 0.5,
                  transition: "opacity 120ms ease",
                }}
              >
                {/* Card header: name + toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: cat.enabled ? 16 : 0,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#0F1117",
                      }}
                    >
                      {cat.category}
                    </div>
                    <div
                      style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}
                    >
                      {cat.enabled
                        ? "Enabled"
                        : "Disabled — skipped during screening"}
                    </div>
                  </div>
                  <Toggle
                    checked={cat.enabled}
                    onChange={(val) => updateCategory(idx, "enabled", val)}
                  />
                </div>

                {/* Threshold + enforcement — only when enabled */}
                {cat.enabled && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 20,
                    }}
                  >
                    {/* Threshold slider */}
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <label className="label" style={{ marginBottom: 0 }}>
                          Confidence threshold
                        </label>
                        <span
                          style={{
                            fontSize: 13,
                            fontFamily: "monospace",
                            color: "#0F1117",
                          }}
                        >
                          {cat.threshold}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={cat.threshold}
                        onChange={(e) =>
                          updateCategory(
                            idx,
                            "threshold",
                            Number(e.target.value),
                          )
                        }
                        // The gradient trick fills the track to the left of
                        // the thumb with the primary colour without needing
                        // a pseudo-element or JS-driven clip-path. It's a
                        // bit hacky but it's the cleanest pure-CSS approach
                        // that works in all modern browsers.
                        style={{
                          width: "100%",
                          height: 3,
                          borderRadius: 9999,
                          appearance: "none",
                          background: `linear-gradient(to right, #0F1117 ${cat.threshold}%, #E5E7EB ${cat.threshold}%)`,
                          cursor: "pointer",
                          outline: "none",
                        }}
                      />
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 11,
                          color: "#9CA3AF",
                          marginTop: 4,
                        }}
                      >
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Enforcement selector */}
                    <div>
                      <label className="label" style={{ marginBottom: 8 }}>
                        Enforcement action
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {ENFORCEMENTS.map((ef) => {
                          const isSelected = cat.enforcement === ef;
                          const isBlock = ef === "Auto-Block";
                          return (
                            <label
                              key={ef}
                              style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                border: isSelected
                                  ? isBlock
                                    ? "0.5px solid #FECACA"
                                    : "0.5px solid #FDE68A"
                                  : "0.5px solid #E5E7EB",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontSize: 13,
                                color: isSelected
                                  ? isBlock
                                    ? "#991B1B"
                                    : "#92400E"
                                  : "#6B7280",
                                background: isSelected
                                  ? isBlock
                                    ? "#FEF2F2"
                                    : "#FFFBEB"
                                  : "transparent",
                                cursor: "pointer",
                                transition: "all 120ms ease",
                              }}
                            >
                              <input
                                type="radio"
                                name={`enforcement-${idx}`}
                                value={ef}
                                checked={isSelected}
                                onChange={() =>
                                  updateCategory(idx, "enforcement", ef)
                                }
                                style={{ display: "none" }}
                              />
                              <i
                                className={`ti ${isBlock ? "ti-ban" : "ti-flag"}`}
                                style={{ fontSize: 13 }}
                              />
                              {ef}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Save footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>
              Changes apply to new submissions only.
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <InlineSpinner />}
              <i className="ti ti-device-floppy" style={{ fontSize: 14 }} />
              {saving ? "Saving…" : "Save new version"}
            </button>
          </div>
        </form>
      )}

      {/* Version history */}
      {history.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#0F1117",
              marginBottom: 16,
            }}
          >
            Version history
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Version</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Active categories</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((v, idx) => (
                  <tr
                    key={v.id}
                    style={{
                      borderBottom:
                        idx < history.length - 1
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
                        fontSize: 13,
                        fontFamily: "monospace",
                        color: "#0F1117",
                      }}
                    >
                      v{v.version}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontSize: 12,
                        color: "#6B7280",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {new Date(v.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 4 }}
                      >
                        {v.categories
                          ?.filter((c) => c.enabled)
                          .map((c) => (
                            <span
                              key={c.category}
                              className="badge-neutral"
                              style={{ fontSize: 11 }}
                            >
                              {c.category}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {v.id === active?.id ? (
                        <span className="badge-green">Active</span>
                      ) : (
                        <span className="badge-neutral">Archived</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
