import api from "./client";

export async function login(email, password) {
  const res = await api.post("/api/auth/login", { email, password });
  return res.data; // { access_token, user }
}

export async function register(email, password, full_name) {
  const res = await api.post("/api/auth/register", { email, password, full_name });
  return res.data; // { access_token, user }
}

export async function getMe() {
  const res = await api.get("/api/auth/me");
  return res.data;
}
