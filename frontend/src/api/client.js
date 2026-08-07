// src/api/client.js
import { MOCK_CLUSTER_RESULT, MOCK_SHOOTINGS } from "./mockData";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const USE_MOCK = (import.meta.env.VITE_USE_MOCK || "false") === "true";

function apiMediaUrl(value) {
  if (!value || /^(https?:|blob:|data:)/i.test(value)) return value;
  return `${API_BASE}${value.startsWith("/") ? value : `/${value}`}`;
}

function normalizePhotos(payload) {
  return {
    ...payload,
    results: (payload?.results || []).map((photo) => ({
      ...photo,
      url: apiMediaUrl(photo.url),
    })),
    images: (payload?.images || []).map((photo) => ({
      ...photo,
      url: apiMediaUrl(photo.url),
    })),
  };
}

function normalizePhoto(photo) {
  return {
    ...photo,
    url: apiMediaUrl(photo.url),
    name: photo.original_filename || photo.name || "Image",
    dimensions:
      photo.width && photo.height ? `${photo.width} × ${photo.height}` : undefined,
    size:
      Number.isFinite(photo.byte_size) && photo.byte_size >= 0
        ? `${(photo.byte_size / 1024 / 1024).toFixed(2)} MB`
        : undefined,
    format: photo.content_type,
    library: photo.library_name,
    shooting: photo.shooting_name,
    description: photo.caption,
  };
}

/** -----------------------------
 * Auth
 * ----------------------------- */
function authHeaders() {
  const token = localStorage.getItem("mpx_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** -----------------------------
 * Helpers (timeout + request)
 * - gère JSON / text / blob
 * - gère FormData (ne met pas Content-Type)
 * - gère erreurs proprement
 * ----------------------------- */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function readError(res) {
  // essaie json -> sinon text
  const ct = res.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const j = await res.json();
      return j?.detail || j?.message || JSON.stringify(j);
    }
    return await res.text();
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function request(
  path,
  {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 30000,
    responseType = "json", // "json" | "blob" | "text"
  } = {}
) {
  const url = `${API_BASE}${path}`;

  const isFormData = body instanceof FormData;
  const mergedHeaders = {
    ...authHeaders(),
    ...headers,
  };

  // Important: si FormData, ne PAS forcer Content-Type
  if (!isFormData && body && typeof body === "object" && !(body instanceof Blob)) {
    mergedHeaders["Content-Type"] = mergedHeaders["Content-Type"] || "application/json";
  }

  const payload =
    !body
      ? undefined
      : isFormData
      ? body
      : mergedHeaders["Content-Type"]?.includes("application/json")
      ? JSON.stringify(body)
      : body;

  const res = await fetchWithTimeout(
    url,
    {
      method,
      headers: mergedHeaders,
      body: payload,
    },
    timeoutMs
  );

  if (!res.ok) {
    const msg = await readError(res);
    throw new Error(msg);
  }

  if (responseType === "blob") return await res.blob();
  if (responseType === "text") return await res.text();

  // json par défaut
  // certains endpoints peuvent renvoyer 204 No Content
  if (res.status === 204) return null;
  return await res.json();
}

/** =========================================================
 * SEARCH
 * ========================================================= */
export async function searchImages({
  mode,
  query,
  imageFiles,
  libraryId,
  shootingId,
  referenceLogic = "rrf",
  limit,
  useVlm = false,
}) {
  const formData = new FormData();
  formData.append("mode", mode);
  formData.append("query", query || "");
  formData.append("reference_logic", referenceLogic);
  if (libraryId) formData.append("library_id", libraryId);
  if (shootingId) formData.append("shooting_id", shootingId);
  if (Number.isInteger(limit)) formData.append("limit", String(limit));
  formData.append("use_vlm", String(useVlm));

  if (imageFiles?.length) {
    imageFiles.forEach((file) => formData.append("images", file));
  }

  if (USE_MOCK) return { results: [] };

  const response = await request("/api/v1/search", {
    method: "POST",
    body: formData,
    timeoutMs: 240000,
  });
  return normalizePhotos(response);
}

export async function uploadImages(files, { libraryId } = {}) {
  const formData = new FormData();
  (files || []).forEach((f) => formData.append("files", f));
  if (libraryId) {
    formData.append("library_id", libraryId);
  }

  if (USE_MOCK) {
    console.log("uploadImages payload prêt :", files, { libraryId });
    return { images: [] };
  }

  const response = await request("/api/v1/photos/upload", {
    method: "POST",
    body: formData,
    timeoutMs: 600000, // upload peut être long
  });
  return normalizePhotos(response);
}

/** =========================================================
 * LIBRARIES / PHOTOS / INDEXING
 * ========================================================= */
export async function listLibraries() {
  if (USE_MOCK) return { libraries: [] };
  return await request("/api/v1/libraries", { method: "GET", timeoutMs: 30000 });
}

export async function createLibrary(payload) {
  if (USE_MOCK) {
    return { id: `mock_library_${Date.now()}`, ...payload, status: "READY" };
  }
  return await request("/api/v1/libraries", {
    method: "POST",
    body: payload,
    timeoutMs: 30000,
  });
}

export async function deleteLibrary(libraryId) {
  if (USE_MOCK) return { ok: true };
  return await request(`/api/v1/libraries/${encodeURIComponent(libraryId)}`, {
    method: "DELETE",
    timeoutMs: 30000,
  });
}

export async function assignPhotosToLibrary(photoIds, libraryId) {
  if (USE_MOCK) {
    return { photos: [], count: photoIds.length, job_ids: [] };
  }
  return await request("/api/v1/photos/assign", {
    method: "POST",
    body: {
      photo_ids: photoIds,
      library_id: libraryId || null,
    },
    timeoutMs: 60000,
  });
}

export async function deletePhoto(photoId) {
  if (USE_MOCK) return { deleted: 1, files_deleted: 0 };
  return await request(`/api/v1/photos/${encodeURIComponent(photoId)}`, {
    method: "DELETE",
    timeoutMs: 60000,
  });
}

export async function clearLibraryPhotos(libraryId) {
  if (USE_MOCK) return { deleted: 0, files_deleted: 0 };
  return await request(
    `/api/v1/libraries/${encodeURIComponent(libraryId)}/photos`,
    {
      method: "DELETE",
      timeoutMs: 60000,
    }
  );
}

export async function clearUnassignedPhotos() {
  if (USE_MOCK) return { deleted: 0, files_deleted: 0 };
  return await request("/api/v1/photos/unassigned", {
    method: "DELETE",
    timeoutMs: 60000,
  });
}

export async function listPhotos({
  libraryId,
  shootingId,
  status,
  limit = 500,
  offset = 0,
} = {}) {
  if (USE_MOCK) return { photos: [], count: 0, limit, offset };
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (libraryId) params.set("library_id", libraryId);
  if (shootingId) params.set("shooting_id", shootingId);
  if (status) params.set("status", status);
  const response = await request(`/api/v1/photos?${params.toString()}`, {
    method: "GET",
    timeoutMs: 30000,
  });
  return {
    ...response,
    photos: (response?.photos || []).map(normalizePhoto),
  };
}

export async function getIndexStatus() {
  if (USE_MOCK) {
    return {
      counts: { TOTAL: 0 },
      indexer_enabled: false,
      searchable: 0,
      pending: 0,
      failed: 0,
    };
  }
  return await request("/api/v1/index/status", {
    method: "GET",
    timeoutMs: 30000,
  });
}

export async function askAssistant(message) {
  const formData = new FormData();
  formData.append("message", message);

  if (USE_MOCK) {
    console.log("askAssistant payload prêt :", message);
    return { reply: "Réponse factice de l'assistant (stub)." };
  }

  return await request("/assistant", {
    method: "POST",
    body: formData,
    timeoutMs: 60000,
  });
}

/** =========================================================
 * RATING / FEEDBACK
 * ========================================================= */
export async function submitRatingComment({ featureName, rating, comment }) {
  const payload = {
    feature: featureName,
    rating,
    comment,
  };

  if (USE_MOCK) {
    console.log("submitRatingComment mock", payload);
    return { ok: true };
  }

  return await request("/ratings", {
    method: "POST",
    body: payload,
    timeoutMs: 30000,
  });
}

/** =========================================================
 * SHOOTINGS
 * ========================================================= */
export async function listShootings() {
  if (USE_MOCK) return { shootings: MOCK_SHOOTINGS };
  return await request("/api/v1/shootings", { method: "GET", timeoutMs: 30000 });
}

/** (Optionnel utile plus tard) */
export async function createShooting(payload) {
  if (USE_MOCK) {
    return { id: `mock_${Date.now()}`, ...payload, status: "UPLOADING" };
  }
  return await request("/api/v1/shootings", { method: "POST", body: payload, timeoutMs: 30000 });
}

export async function deleteShooting(shootingId) {
  if (USE_MOCK) return { ok: true };
  return await request(`/api/v1/shootings/${shootingId}`, { method: "DELETE", timeoutMs: 30000 });
}

/** =========================================================
 * CLUSTERING
 * ========================================================= */
export async function runClustering(shootingId, params = {}) {
  if (USE_MOCK) {
    return { job_id: `mock_job_${shootingId}_${Date.now()}` };
  }

  return await request(`/shootings/${shootingId}/cluster/run`, {
    method: "POST",
    body: params,
    timeoutMs: 60000,
  });
}

export async function getJob(jobId) {
  if (USE_MOCK) {
    return { status: "DONE", progress: 1.0, message: "Clustering terminé (mock)" };
  }

  return await request(`/api/v1/jobs/${jobId}`, { method: "GET", timeoutMs: 30000 });
}

export async function getClusterResult(shootingId) {
  if (USE_MOCK) {
    return { ...MOCK_CLUSTER_RESULT, shooting_id: shootingId };
  }

  return await request(`/shootings/${shootingId}/cluster/result`, {
    method: "GET",
    timeoutMs: 60000,
  });
}

export async function updateCluster(shootingId, clusterId, payload) {
  if (USE_MOCK) {
    console.log("updateCluster mock", { shootingId, clusterId, payload });
    return { ok: true };
  }

  return await request(`/shootings/${shootingId}/cluster/${clusterId}`, {
    method: "PATCH",
    body: payload,
    timeoutMs: 30000,
  });
}

/** Exports (JSON/CSV/ZIP etc.) */
export async function exportClusters(shootingId, format = "json", clusterId = null) {
  if (USE_MOCK) {
    const data = { ...MOCK_CLUSTER_RESULT, shooting_id: shootingId };
    return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  }

  const path =
    clusterId == null
      ? `/shootings/${shootingId}/cluster/export?format=${format}`
      : `/shootings/${shootingId}/cluster/${clusterId}/export?format=${format}`;

  return await request(path, {
    method: "GET",
    responseType: "blob",
    timeoutMs: 60000,
  });
}
