import api from "./client";

export async function fileAppeal(submission_id, image_id, justification) {
  const res = await api.post("/api/appeals/", { submission_id, image_id, justification });
  return res.data;
}

export async function listMyAppeals(params = {}) {
  const res = await api.get("/api/appeals/", { params });
  return res.data; // { items, total, limit, skip }
}

export async function getAppealsQueue(params = {}) {
  const res = await api.get("/api/appeals/queue", { params });
  return res.data;
}

export async function getAppeal(id) {
  const res = await api.get(`/api/appeals/${id}`);
  return res.data;
}

export async function resolveAppeal(id, action, admin_response = "") {
  const res = await api.post(`/api/appeals/${id}/resolve`, { action, admin_response });
  return res.data;
}
