// Page-level spinner. The className prop lets callers add vertical padding
// without wrapping it in yet another div — e.g. <LoadingSpinner className="py-20" />
export default function LoadingSpinner({ className = "" }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      className={className}
    >
      <div
        style={{
          width: 24,
          height: 24,
          border: "1.5px solid #E5E7EB",
          borderTopColor: "#0F1117",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
    </div>
  );
}

// Tiny white variant that sits inside a dark primary button while a request
// is in-flight. The low-opacity white border gives the "track" appearance
// without needing a second element, and flexShrink: 0 stops it squishing
// when the button text changes length between "Submit" and "Submitting…"
export function InlineSpinner() {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        border: "1.5px solid rgba(255,255,255,0.3)",
        borderTopColor: "#FFFFFF",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
