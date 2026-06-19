import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { InlineSpinner } from "../components/LoadingSpinner";

export default function Register() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset form on every mount to defend against bfcache restoring stale values
  useEffect(() => {
    setForm({ full_name: "", email: "", password: "", confirmPassword: "" });
    setError("");
  }, []);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  function getErrorMessage(err, fallback) {
    if (!err.response)
      return "Cannot reach the server. Make sure the backend is running.";
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
    return fallback;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const data = await register(form.email, form.password, form.full_name);
      setAuth(data.access_token, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Registration failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F9F9F8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              background: "#0F1117",
              borderRadius: 10,
              marginBottom: 12,
            }}
          >
            <i
              className="ti ti-shield-check"
              style={{ fontSize: 20, color: "#FFFFFF" }}
            />
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "#0F1117" }}>
            ModerationAI
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            AI-powered content moderation
          </div>
        </div>

        <div className="card" style={{ padding: "28px 24px" }}>
          <div
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: "#0F1117",
              marginBottom: 4,
            }}
          >
            Create an account
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>
            Get started for free
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

          <form onSubmit={handleSubmit} autoComplete="off">
            <div style={{ marginBottom: 14 }}>
              <label className="label">Full name</label>
              <input
                name="full_name"
                type="text"
                required
                autoComplete="off"
                value={form.full_name}
                onChange={handleChange}
                className="input"
                placeholder="Jane Doe"
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">Email address</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={handleChange}
                className="input"
                placeholder="you@example.com"
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="label">
                Password{" "}
                <span
                  style={{
                    textTransform: "none",
                    fontSize: 11,
                    color: "#9CA3AF",
                  }}
                >
                  (min. 8 characters)
                </span>
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className="input"
                placeholder="••••••••"
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label className="label">Confirm password</label>
              <input
                name="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={handleChange}
                className="input"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ width: "100%" }}
            >
              {loading && <InlineSpinner />}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 13,
            color: "#6B7280",
          }}
        >
          Already have an account?{" "}
          <Link to="/login" style={{ color: "#0F1117", fontWeight: 500 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
