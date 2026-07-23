import { useState } from "react";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";

export default function PhotoModal({ isOpen, onClose, photo, onDelete }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!photo) return null;

  // Fonction helper pour afficher une valeur ou "Non renseigné"
  const displayValue = (value) => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return <span className="photoModalEmpty">Non renseigné</span>;
    }
    return value;
  };

  function handleDeleteClick() {
    setShowDeleteConfirm(true);
  }

  function handleConfirmDelete() {
    if (onDelete) {
      onDelete(photo);
    }
    setShowDeleteConfirm(false);
    onClose();
  }

  function handleCancelDelete() {
    setShowDeleteConfirm(false);
  }

  function handleDownload() {
    if (!photo?.url) return;
    const link = document.createElement("a");
    link.href = photo.url;
    link.download = photo.name || "photo";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Détails de la photo"
        overlayClassName="photoModalOverlay"
      >
      <div className="photoModalContent">
        {/* Image principale */}
        <div className="photoModalImageWrapper">
          <img 
            src={photo.url} 
            alt={photo.name || "Photo"} 
            className="photoModalImage"
          />
        </div>

        {/* Informations */}
        <div className="photoModalInfo">
          {/* Nom du fichier */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Nom</span>
            <span className="photoModalValue">{displayValue(photo.name)}</span>
          </div>

          {/* Date */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Date</span>
            <span className="photoModalValue">{displayValue(photo.date)}</span>
          </div>

          {/* Dimensions */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Dimensions</span>
            <span className="photoModalValue">{displayValue(photo.dimensions)}</span>
          </div>

          {/* Taille du fichier */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Taille</span>
            <span className="photoModalValue">{displayValue(photo.size)}</span>
          </div>

          {/* Format */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Format</span>
            <span className="photoModalValue">{displayValue(photo.format)}</span>
          </div>

          {/* Bibliothèque */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Bibliothèque</span>
            <span className="photoModalValue">{displayValue(photo.library)}</span>
          </div>

          {/* Shooting */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Shooting</span>
            <span className="photoModalValue">{displayValue(photo.shooting)}</span>
          </div>

          {/* Tags */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Tags</span>
            {photo.tags && photo.tags.length > 0 ? (
              <div className="photoModalTags">
                {photo.tags.map((tag, idx) => (
                  <span key={idx} className="photoModalTag">{tag}</span>
                ))}
              </div>
            ) : (
              <span className="photoModalValue">{displayValue(null)}</span>
            )}
          </div>

          {/* Description/Notes */}
          <div className="photoModalRow">
            <span className="photoModalLabel">Description</span>
            <span className="photoModalValue">{displayValue(photo.description)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="modalActions">
          <button className="btn" onClick={handleDownload}>
            Télécharger
          </button>
          <button 
            className="btn btnDanger"
            onClick={handleDeleteClick}
          >
            Supprimer
          </button>
        </div>
      </div>
    </Modal>

      {/* Dialog de confirmation de suppression */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="Supprimer la photo"
        message={`Êtes-vous sûr de vouloir supprimer "${photo.name || 'cette photo'}" ? Cette action est irréversible.`}
        confirmText="Supprimer"
        cancelText="Annuler"
        danger={true}
      />
    </>
  );
}
