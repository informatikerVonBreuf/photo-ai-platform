// src/components/StatusBadge.jsx
export default function StatusBadge({ status }) {
  const s = (status || "").toUpperCase();

  const cls =
    s === "READY" || s === "INDEXED"
      ? "badge badge-ready"
      : s === "EMBEDDING" || s === "INDEXING" || s === "STORED"
      ? "badge badge-warn"
      : s === "RUNNING"
      ? "badge badge-warn"
      : s === "DONE"
      ? "badge badge-ready"
      : s === "FAILED"
      ? "badge badge-error"
      : "badge";

  return <span className={cls}>{s || "UNKNOWN"}</span>;
}
