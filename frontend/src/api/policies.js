import api from "./client";

export async function listPolicies(params = {}) {
  const res = await api.get("/api/policies/", { params });
  return res.data; // { items, total, active_version_id }
}

export async function getActivePolicy() {
  const res = await api.get("/api/policies/active");
  return res.data;
}

export async function getPolicyVersion(id) {
  const res = await api.get(`/api/policies/${id}`);
  return res.data;
}

export async function savePolicy(categories) {
  const res = await api.post("/api/policies/", { categories });
  return res.data;
}
