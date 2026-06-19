import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const USER_NAV = [
  { to: "/", label: "Home", icon: "ti-home-2" },
  { to: "/submit", label: "Submit", icon: "ti-upload" },
  { to: "/history", label: "History", icon: "ti-clock" },
  { to: "/appeals", label: "Appeals", icon: "ti-gavel" },
];

const ADMIN_NAV = [
  { to: "/admin/analytics", label: "Analytics", icon: "ti-chart-bar" },
  { to: "/admin/appeals", label: "Appeal queue", icon: "ti-list-check" },
  {
    to: "/admin/policies",
    label: "Policies",
    icon: "ti-adjustments-horizontal",
  },
];

// Grab first + last initial so "Jane Smith" → "JS", not "J".
// Fall back to the first char of the email if there's no full_name stored,
// and finally "U" if somehow we've got nothing at all (shouldn't happen, but
// defensive is better than a blank circle).
function getInitials(name, email) {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "U";
}

export default function Sidebar() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const initials = getInitials(user?.full_name, user?.email);
  const displayName = user?.full_name || user?.email?.split("@")[0] || "User";

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        background: "#FFFFFF",
        borderRight: "0.5px solid #E5E7EB",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "16px 16px 12px",
          borderBottom: "0.5px solid #E5E7EB",
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 52,
        }}
      >
        <i
          className="ti ti-shield-check"
          style={{ fontSize: 18, color: "#0F1117" }}
        />
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "#0F1117",
            letterSpacing: "-0.01em",
          }}
        >
          ModerationAI
        </span>
      </div>

      {/* Nav — overflowY: auto so it scrolls if an admin has a ton of items.
           In practice 7 items fit comfortably but let's not hardcode that assumption. */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "12px 8px" }}>
        {/* User section */}
        <div style={{ marginBottom: 16 }}>
          <div className="label" style={{ padding: "0 8px", marginBottom: 4 }}>
            Workspace
          </div>
          {USER_NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                "nav-item" + (isActive ? " active" : "")
              }
              style={{ marginBottom: 1 }}
            >
              <i className={`ti ${icon}`} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Admin section */}
        {isAdmin && (
          <div>
            <div
              className="label"
              style={{ padding: "0 8px", marginBottom: 4 }}
            >
              Admin
            </div>
            {ADMIN_NAV.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  "nav-item" + (isActive ? " active" : "")
                }
                style={{ marginBottom: 1 }}
              >
                <i className={`ti ${icon}`} />
                {label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div
        style={{
          borderTop: "0.5px solid #E5E7EB",
          padding: "12px 12px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "#F3F4F6",
              color: "#0F1117",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#0F1117",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#6B7280",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {user?.email}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="btn-secondary"
          style={{
            width: "100%",
            justifyContent: "flex-start",
            padding: "6px 10px",
          }}
        >
          <i className="ti ti-logout" style={{ fontSize: 14 }} />
          Sign out
        </button>
      </div>
    </div>
  );
}
