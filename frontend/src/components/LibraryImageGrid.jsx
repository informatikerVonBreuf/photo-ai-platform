import { useMemo, useState } from "react";
import EmptyState from "../ui/EmptyState";
import SkeletonCard from "../ui/SkeletonCard";
import StatusBadge from "./StatusBadge";
import { Check } from "@phosphor-icons/react";

export default function LibraryImageGrid({
  images = [],
  pageSize = 36,
  loading = false,
  onOpen,
  onToggleSelection,
  selectedIds = [],
  resetKey,
}) {
  const [pagination, setPagination] = useState({ resetKey, page: 1 });
  const page = pagination.resetKey === resetKey ? pagination.page : 1;

  const visibleImages = useMemo(() => {
    const limit = Math.max(1, pageSize) * page;
    // Limite explicite par lot pour éviter de rendre un trop grand nombre de vignettes.
    return images.slice(0, limit);
  }, [images, page, pageSize]);

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
        title="Aucune image dans cet album pour le moment"
        tooltip="Importez des images pour les afficher ici."
      />
    );
  }

  return (
    <div>
      <div className="gallery libraryGallery">
        {visibleImages.map((img) => {
          const src = img.url;
          const alt = img.name || img.caption || "Image";
          const photoForModal = src ? { ...img, url: src } : img;
          const imageId = String(img.id || img.url);
          const isSelected = selectedIds.includes(imageId);

          return (
            <div
              className={`tile ${isSelected ? "tile--selected" : ""}`}
              key={imageId}
              role={onOpen ? "button" : undefined}
              tabIndex={onOpen ? 0 : undefined}
              onClick={() => onOpen?.(photoForModal)}
            >
              <div className="tileImg">
                {src ? <img src={src} alt={alt} /> : null}
                {onToggleSelection ? (
                  <button
                    type="button"
                    className={`tileSelect ${isSelected ? "tileSelect--active" : ""}`}
                    aria-label={
                      isSelected
                        ? `Retirer ${alt} de la selection`
                        : `Selectionner ${alt}`
                    }
                    aria-pressed={isSelected}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleSelection(imageId);
                    }}
                  >
                    {isSelected ? <Check size={16} weight="bold" /> : null}
                  </button>
                ) : null}
                {img.status && img.status !== "INDEXED" ? (
                  <div className="tileStatus">
                    <StatusBadge status={img.status} />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}>
        {hasMore ? (
          <button
            className="btn"
            onClick={() => setPagination({ resetKey, page: page + 1 })}
          >
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
