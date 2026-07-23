// src/components/ClusterCards.jsx
import StatusBadge from "./StatusBadge";

export default function ClusterCards({ clusters, photosById, selectedId, onSelect }) {
  return (
    <div className="cluster-cards">
      {(clusters || []).map((c) => {
        const isActive = selectedId === c.cluster_id;
        const covers = (c.cover_photo_ids || [])
          .slice(0, 3)
          .map((pid) => photosById?.[pid])
          .filter(Boolean);

        return (
          <button
            key={c.cluster_id}
            className={`cluster-card ${isActive ? "active" : ""}`}
            onClick={() => onSelect?.(c.cluster_id)}
            type="button"
          >
            <div className="cluster-card__top">
              <div className="cluster-card__title">{c.theme || `Cluster ${c.cluster_id}`}</div>
              <span className="badge badge-soft">{c.count} photos</span>
            </div>

            <div className="cluster-card__covers">
              {covers.length === 0 ? (
                <div className="cluster-card__covers--empty">Aperçus indisponibles</div>
              ) : (
                covers.map((p) => (
                  <img
                    key={p.id}
                    className="cluster-card__cover"
                    src={p.url}
                    alt={p.id}
                    loading="lazy"
                  />
                ))
              )}
            </div>

            <div className="cluster-card__bottom">
              <div className="muted">
                Confiance: {typeof c.confidence === "number" ? c.confidence.toFixed(2) : "—"}
              </div>
              <StatusBadge status={c.validated ? "READY" : "RUNNING"} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
