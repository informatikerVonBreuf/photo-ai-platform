import { useEffect, useMemo, useState } from "react";
import EmptyState from "../ui/EmptyState";
import SkeletonCard from "../ui/SkeletonCard";

export default function LibraryImageGrid({
  images = [],
  pageSize = 36,
  loading = false,
  resetKey,
}) {
  const [page, setPage] = useState(1);
  const [objectUrlMap, setObjectUrlMap] = useState({});

  useEffect(() => {
    if (resetKey !== undefined) {
      setPage(1);
    }
  }, [resetKey]);

  const visibleImages = useMemo(() => {
    const limit = Math.max(1, pageSize) * page;
    // Limite explicite par lot pour éviter de rendre un trop grand nombre de vignettes.
    return images.slice(0, limit);
  }, [images, page, pageSize]);

  useEffect(() => {
    const nextMap = {};

    visibleImages.forEach((img) => {
      if (!img?.url && img?.file instanceof File) {
        nextMap[img.id] = URL.createObjectURL(img.file);
      }
    });

    setObjectUrlMap(nextMap);

    return () => {
      // Nettoyage des URLs temporaires pour limiter l'usage mémoire.
      Object.values(nextMap).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [visibleImages]);

  const hasMore = images.length > visibleImages.length;

  if (loading && images.length === 0) {
    return (
      <div className="gallery libraryGallery">
        <SkeletonCard count={8} />
      </div>
    );
  }

  if (!loading && images.length === 0) {
    return (
      <EmptyState
        icon="🖼️"
        title="Aucune image dans cette bibliothèque pour le moment"
        tooltip="Importez des images pour les afficher ici."
      />
    );
  }

  return (
    <div>
      <div className="gallery libraryGallery">
        {visibleImages.map((img) => {
          const src = img.url || objectUrlMap[img.id];
          const alt = img.name || img.caption || "Image";

          return (
            <div className="tile" key={img.id || img.url}>
              <div className="tileImg">
                {src ? <img src={src} alt={alt} /> : null}
              </div>
              <div className="tileMeta">
                <div className="tileCap">{alt}</div>
                {img.meta ? <div className="tileSub">{img.meta}</div> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
        {hasMore ? (
          <button className="btn" onClick={() => setPage((p) => p + 1)}>
            Afficher plus
          </button>
        ) : (
          <div className="mutedSmall">Toutes les images sont affichées.</div>
        )}
      </div>

      {loading && images.length > 0 && (
        <div className="mutedSmall" style={{ marginTop: "8px", textAlign: "center" }}>
          Chargement…
        </div>
      )}
    </div>
  );
}
