import api from "./client";

export async function createSubmission(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const res = await api.post("/api/submissions/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function listSubmissions(params = {}) {
  const res = await api.get("/api/submissions/", { params });
  return res.data; // { items, total, limit, skip }
}

export async function getSubmission(id) {
  const res = await api.get(`/api/submissions/${id}`);
  return res.data;
}

/** Returns a URL string suitable for <img src=...> — the token is auto-attached by the interceptor only for axios calls.
 *  For direct image loads we embed the token as a query param. */
export function getImageUrl(submissionId, imageId) {
  const token = localStorage.getItem("token");
  const base = `/api/submissions/${submissionId}/images/${imageId}`;
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
