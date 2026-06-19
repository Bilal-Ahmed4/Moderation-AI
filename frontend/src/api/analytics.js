import api from "./client";

export async function getDashboard(days = 30, top_n = 10) {
  const res = await api.get("/api/analytics/dashboard", { params: { days, top_n } });
  return res.data;
}
