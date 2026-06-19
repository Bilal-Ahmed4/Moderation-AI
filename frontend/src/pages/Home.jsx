import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const USER_NAV = [
  {
    to: "/submit",
    icon: "ti-upload",
    title: "Submit images",
    desc: "Upload images to screen against the active moderation policy.",
  },
  {
    to: "/history",
    icon: "ti-clock",
    title: "History",
    desc: "Browse all past submissions and their verdict results.",
  },
  {
    to: "/appeals",
    icon: "ti-gavel",
    title: "Appeals",
    desc: "Track appeals you have filed on flagged or blocked images.",
  },
];

const ADMIN_NAV = [
  {
    to: "/admin/analytics",
    icon: "ti-chart-bar",
    title: "Analytics",
    desc: "Platform-wide submission volume, verdict breakdown, and top users.",
  },
  {
    to: "/admin/appeals",
    icon: "ti-list-check",
    title: "Appeal queue",
    desc: "Review and resolve pending user appeals.",
  },
  {
    to: "/admin/policies",
    icon: "ti-adjustments-horizontal",
    title: "Policies",
    desc: "Configure category thresholds and enforcement actions.",
  },
];

function NavCard({ to, icon, title, desc }) {
  return (
    <Link
      to={to}
      className="card"
      style={{
        display: "block",
        padding: "20px",
        textDecoration: "none",
        transition: "background 120ms ease",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "#FFFFFF")}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          background: "#F3F4F6",
          borderRadius: 8,
          marginBottom: 14,
        }}
      >
        <i
          className={`ti ${icon}`}
          style={{ fontSize: 18, color: "#0F1117" }}
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
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
        {desc}
      </div>
    </Link>
  );
}

export default function Home() {
  const { user, isAdmin } = useAuth();
  const firstName =
    user?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  return (
    <div style={{ padding: "32px 32px", maxWidth: 960, margin: "0 auto" }}>
      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 20, fontWeight: 500, color: "#0F1117" }}>
          Good morning, {firstName}
        </div>
        <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
          Moderation AI categorizes images across six content categories and enforces your
          configured policy.
        </div>
      </div>

      {/* User section */}
      <div style={{ marginBottom: 32 }}>
        <div className="label" style={{ marginBottom: 12 }}>
          Workspace
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          {USER_NAV.map((item) => (
            <NavCard key={item.to} {...item} />
          ))}
        </div>
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div style={{ marginBottom: 32 }}>
          <div className="label" style={{ marginBottom: 12 }}>
            Admin
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {ADMIN_NAV.map((item) => (
              <NavCard key={item.to} {...item} />
            ))}
          </div>
        </div>
      )}

      {/* How it works strip */}
      <div className="card" style={{ marginTop: 8, padding: "20px 24px" }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#0F1117",
            marginBottom: 16,
          }}
        >
          How it works
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
          }}
        >
          {[
            {
              step: "01",
              title: "Upload",
              desc: "Submit one or more images for screening.",
            },
            {
              step: "02",
              title: "Screen",
              desc: "Moderation AI rates each image across 6 categories.",
            },
            {
              step: "03",
              title: "Review",
              desc: "Verdicts enforce the active policy. Appeal if needed.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "#9CA3AF",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                {step}
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#0F1117",
                  marginBottom: 4,
                }}
              >
                {title}
              </div>
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
                {desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
