// src/components/PhotoModal.jsx
import { useEffect } from "react";

export default function PhotoModal({ photo, onClose }) {
  useEffect(() => {
    if (!photo) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <div>
            <div className="modal__title">{photo.id}</div>
            <div className="muted">
              {photo.w}×{photo.h} • {photo.date || "—"} • Tags: {(photo.tags || []).join(", ") || "—"}
            </div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} type="button">
            Fermer
          </button>
        </div>

        <div className="modal__body">
          <img className="modal__img" src={photo.url} alt={photo.id} />
        </div>
      </div>
    </div>
  );
}
