const MAP = {
  Approved: "badge-green",
  "Flagged for Review": "badge-amber",
  Blocked: "badge-red",
  pending: "badge-amber",
  accepted: "badge-green",
  rejected: "badge-red",
  clear: "badge-neutral",
  detected: "badge-red",
};

export default function OutcomeBadge({ outcome }) {
  const cls = MAP[outcome] ?? "badge-neutral";
  return <span className={cls}>{outcome}</span>;
}
