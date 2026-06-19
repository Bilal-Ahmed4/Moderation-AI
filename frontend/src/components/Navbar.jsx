import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const [adminOpen, setAdminOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const linkCls = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-50 text-indigo-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 gap-6">
          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-900 font-bold text-lg shrink-0 hover:opacity-80 transition-opacity no-underline"
          >
            <span className="text-2xl">🛡️</span>
            <span className="hidden sm:block">ModerationAI</span>
          </Link>

          {/* Nav links */}
          {isAuthenticated && (
            <div className="flex items-center gap-1 flex-1">
              <NavLink to="/submit"  className={linkCls}>Submit</NavLink>
              <NavLink to="/history" className={linkCls}>History</NavLink>
              <NavLink to="/appeals" className={linkCls}>Appeals</NavLink>

              {/* Admin dropdown */}
              {isAdmin && (
                <div className="relative">
                  <button
                    onClick={() => setAdminOpen((o) => !o)}
                    onBlur={() => setTimeout(() => setAdminOpen(false), 150)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  >
                    Admin
                    <svg className={`w-4 h-4 transition-transform ${adminOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {adminOpen && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                      <Link to="/admin/analytics"   className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">📊 Analytics</Link>
                      <Link to="/admin/appeals"     className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">📋 Appeals Queue</Link>
                      <Link to="/admin/policies"    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">⚙️ Policies</Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3 ml-auto">
            {isAuthenticated ? (
              <>
                <span className="hidden md:block text-sm text-slate-500 max-w-[180px] truncate">
                  {user?.email}
                </span>
                {isAdmin && (
                  <span className="badge-indigo text-xs">Admin</span>
                )}
                <button onClick={handleLogout} className="btn-ghost text-sm px-3 py-1.5">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link to="/login"    className="btn-ghost text-sm">Log in</Link>
                <Link to="/register" className="btn-primary text-sm">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
