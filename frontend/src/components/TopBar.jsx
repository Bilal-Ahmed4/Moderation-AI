import { useLocation, Link } from "react-router-dom";

const ROUTE_LABELS = {
  "/":                "Home",
  "/submit":          "Submit",
  "/history":         "History",
  "/appeals":         "Appeals",
  "/admin/analytics": "Analytics",
  "/admin/appeals":   "Appeal queue",
  "/admin/policies":  "Policies",
};

function getLabel(pathname) {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith("/submissions/")) return "Submission detail";
  return "";
}

function getParent(pathname) {
  if (pathname.startsWith("/submissions/")) return { label: "History", to: "/history" };
  return null;
}

export default function TopBar() {
  const { pathname } = useLocation();
  const label  = getLabel(pathname);
  const parent = getParent(pathname);

  return (
    <div style={{
      height: 52,
      background: "#FFFFFF",
      borderBottom: "0.5px solid #E5E7EB",
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      flexShrink: 0,
      gap: 8,
    }}>
      {parent && (
        <>
          <Link
            to={parent.to}
            style={{ fontSize: 14, color: "#6B7280", textDecoration: "none" }}
          >
            {parent.label}
          </Link>
          <i className="ti ti-chevron-right" style={{ fontSize: 12, color: "#9CA3AF" }} />
        </>
      )}
      <span style={{ fontSize: 14, fontWeight: 500, color: "#0F1117" }}>
        {label}
      </span>
    </div>
  );
}
