import EmptyState from "./EmptyState";
import ErrorState from "./ErrorState";
import SkeletonCard from "./SkeletonCard";

export default function ResultsGallery({
  loading,
  error,
  results = [],
  onRetry,
  onOpen,
  emptyIcon = "🔍",
  emptyTitle = "Aucun resultat",
  emptyTooltip,
  errorTitle = "Erreur de recherche",
  skeletonCount = 8,
  showScore = true,
}) {
  return (
    <div className="gallery">
      {loading ? (
        <SkeletonCard count={skeletonCount} />
      ) : error ? (
        <ErrorState title={errorTitle} message={error} onRetry={onRetry} />
      ) : results.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} tooltip={emptyTooltip} />
      ) : (
        results.map((photo) => (
          <button
            type="button"
            className="tile tileButton"
            key={photo.id}
            onClick={() => onOpen?.(photo)}
          >
            <div className="tileImg">
              <img src={photo.url} alt={photo.caption || photo.name || "Photo"} />
            </div>
            <div className="tileMeta">
              <div className="tileCap">{photo.caption || photo.name || photo.id}</div>
              {showScore && photo.score != null && (
                <div className="tileSub">score: {photo.score}</div>
              )}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
