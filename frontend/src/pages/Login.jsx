import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { InlineSpinner } from "../components/LoadingSpinner";

export default function Login() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  // Show a notice when the session expired automatically
  const sessionExpired = location.state?.sessionExpired === true;

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Guard against the browser back/forward cache (bfcache) restoring the
   * previous page state — including whatever was typed in the form fields.
   * On every mount we reset the controlled values to empty strings.
   */
  useEffect(() => {
    setForm({ email: "", password: "" });
    setError("");
  }, []);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(form.email, form.password);
      setAuth(data.access_token, data.user);
      navigate(from, { replace: true });
    } catch (err) {
      if (!err.response) {
        setError("Cannot reach the server. Make sure the backend is running.");
      } else {
        setError(err.response?.data?.detail || "Invalid email or password.");
      }
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
            Welcome back
          </div>
          <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 24 }}>
            Sign in to your account
          </div>

          {/* Session-expired notice (shown when auto-logout fired) */}
          {sessionExpired && (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 14px",
                background: "#FFFBEB",
                border: "0.5px solid #FDE68A",
                borderRadius: 8,
                fontSize: 13,
                color: "#92400E",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <i
                className="ti ti-clock"
                style={{ fontSize: 14, flexShrink: 0 }}
              />
              Your session expired. Please sign in again.
            </div>
          )}

          {/* API / credential error */}
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

          {/*
            autoComplete="off" on the form discourages browser-level form-fill.
            The individual inputs use specific autocomplete tokens:
              - email:    "off"          – no saved-address autofill
              - password: "current-password" – allows the password manager to
                           offer the saved credential, but won't auto-inject it
                           into an empty field on navigation (unlike "on").
            The useEffect above resets both values on every mount, so any value
            that the browser injected into the DOM before React hydrated is
            immediately overwritten by the controlled component.
          */}
          <form onSubmit={handleSubmit} autoComplete="off">
            <div style={{ marginBottom: 16 }}>
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

            <div style={{ marginBottom: 20 }}>
              <label className="label">Password</label>
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
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
              {loading ? "Signing in…" : "Sign in"}
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
          No account?{" "}
          <Link to="/register" style={{ color: "#0F1117", fontWeight: 500 }}>
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
