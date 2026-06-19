import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const AuthContext = createContext(undefined);

function loadStored(key, parse = false) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return parse ? JSON.parse(raw) : raw;
  } catch {
    // JSON.parse can throw if someone (or some browser extension) has corrupted
    // the stored value. Just treat it as absent rather than crashing on startup.
    return null;
  }
}

// JWTs are just base64-encoded JSON — no crypto needed to read the payload.
// We only care about `exp` (Unix timestamp, seconds). If the token is
// malformed for any reason we return null and skip the timer logic rather
// than blowing up the whole auth flow.
function parseJwtExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(() => loadStored("token"));
  const [user, setUser] = useState(() => loadStored("user", true));
  const [sessionExpired, setSessionExpired] = useState(false);

  // useRef so we can cancel the timer without it causing a re-render or
  // ending up in a stale closure. A plain variable would get wiped on re-render.
  const expiryTimerRef = useRef(null);

  const setAuth = useCallback((newToken, newUser) => {
    // Cancel whatever timer was running for the previous session. Otherwise
    // logging out and back in quickly could fire a ghost logout from the old token.
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    if (newToken && newUser) {
      localStorage.setItem("token", newToken);
      localStorage.setItem("user", JSON.stringify(newUser));
      setTokenState(newToken);
      setUser(newUser);
      setSessionExpired(false); // clear the "your session expired" banner on fresh login
    } else {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setTokenState(null);
      setUser(null);
    }
  }, []);

  const logout = useCallback(() => setAuth(null, null), [setAuth]);

  // Separate from logout() because we want to show a "session expired" notice
  // on the login page. Regular logout (user clicked the button) shouldn't show that.
  const logoutExpired = useCallback(() => {
    setSessionExpired(true);
    setAuth(null, null);
  }, [setAuth]);

  // Two things happening here:
  //
  // 1. If the token is already past its `exp` when this runs (browser restoring
  //    a tab from bfcache after the user left for an hour), we kick them out
  //    immediately rather than letting them poke around until the first API call.
  //
  // 2. If the token is still valid, we schedule an auto-logout at the exact
  //    second it expires. Users won't lose work mid-form — they'll just be
  //    redirected to login and can sign back in. Not perfect UX but way better
  //    than silently failing every API call.
  useEffect(() => {
    if (!token) return;

    const exp = parseJwtExpiry(token);
    if (!exp) return; // token doesn't have an exp claim — nothing to schedule

    const msUntilExpiry = exp * 1000 - Date.now();

    if (msUntilExpiry <= 0) {
      logoutExpired();
      return;
    }

    expiryTimerRef.current = setTimeout(() => {
      logoutExpired();
    }, msUntilExpiry);

    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [token, logoutExpired]);

  // React to the custom event that the axios 401 interceptor fires.
  // This bridges the gap between "module-level axios code" and "React state" —
  // you can't call a hook from an axios interceptor, so the event is the
  // cleanest way to communicate across that boundary without a global singleton.
  useEffect(() => {
    function onExpired() {
      logoutExpired();
    }
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [logoutExpired]);

  const value = useMemo(
    () => ({
      token,
      user,
      setAuth,
      logout,
      sessionExpired,
      isAuthenticated: Boolean(token),
      isAdmin: user?.role === "admin",
    }),
    [token, user, setAuth, logout, sessionExpired],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
