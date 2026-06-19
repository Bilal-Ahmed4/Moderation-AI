import axios from "axios";

// One axios instance for the whole app. Don't create separate ones in
// individual files — you'll forget to attach the auth header somewhere
// and spend 45 minutes debugging a 401 that has nothing to do with your token.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  headers: { "Content-Type": "application/json" },
});

// Attach the JWT on the way out. We read from localStorage here instead of
// closing over the value at startup because the token can change mid-session
// (e.g. after a re-login) and we always want the latest one.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// This interceptor is doing two separate jobs and that's intentional.
//
// Job 1 (storage): clear localStorage so that if the user hard-refreshes,
// they land on /login instead of hitting every endpoint with a dead token.
//
// Job 2 (React state): dispatch a custom event so AuthContext can flush its
// in-memory state too. Without this second step the app *looks* authenticated
// (isAuthenticated is still true) even though every request is failing.
// localStorage.removeItem on its own does absolutely nothing to React state —
// learned that the hard way after a user reported "I can see the dashboard
// but nothing loads" after their session expired.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.dispatchEvent(new CustomEvent("auth:expired"));
    }
    return Promise.reject(err);
  },
);

export default api;
