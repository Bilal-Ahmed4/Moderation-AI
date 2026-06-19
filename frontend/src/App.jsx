import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import AdminRoute from "./components/AdminRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Submit from "./pages/Submit";
import History from "./pages/History";
import SubmissionDetail from "./pages/SubmissionDetail";
import Appeals from "./pages/Appeals";
import Analytics from "./pages/admin/Analytics";
import AppealsQueue from "./pages/admin/AppealsQueue";
import Policies from "./pages/admin/Policies";

// AppShell is the authenticated layout. It owns the sidebar + topbar chrome
// and renders the current page via <Outlet />. Keeping auth-guard logic here
// (rather than on every individual route) means we only have one place to
// update if the redirect behaviour ever needs to change.
function AppShell() {
  const { isAuthenticated, sessionExpired } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Forward `from` so after login we can send the user back to where they
    // were trying to go. Also forward sessionExpired so the login page can
    // show the amber "your session expired" notice instead of just a blank form.
    return (
      <Navigate
        to="/login"
        state={{ from: location, sessionExpired }}
        replace
      />
    );
  }

  return (
    // overflow: hidden on the outer div is important — without it the sidebar
    // and main content can both grow past 100vh and you get double scrollbars.
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "#F9F9F8",
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0, // without this, a wide table can push past the flex boundary
        }}
      >
        <TopBar />
        <main style={{ flex: 1, overflowY: "auto", background: "#F9F9F8" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/submit" element={<Submit />} />
        <Route path="/history" element={<History />} />
        <Route path="/submissions/:id" element={<SubmissionDetail />} />
        <Route path="/appeals" element={<Appeals />} />

        <Route
          path="/admin/analytics"
          element={
            <AdminRoute>
              <Analytics />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/appeals"
          element={
            <AdminRoute>
              <AppealsQueue />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/policies"
          element={
            <AdminRoute>
              <Policies />
            </AdminRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
