import Modal from "./Modal";

export default function PhotoModal({ isOpen, onClose, photo }) {
  if (!photo) return null;

  // Helper pour vérifier si une valeur existe
  const hasValue = (value) => value !== null && value !== undefined && value !== "";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Détails de la photo">
      <div className="photoModalContent">
        {/* Image principale */}
        <div className="photoModalImageWrapper">
          <img 
            src={photo.url} 
            alt={photo.name || "Photo"} 
            className="photoModalImage"
          />
        </div>

        {/* Informations - Afficher uniquement si données disponibles */}
        <div className="photoModalInfo">
          {hasValue(photo.name) && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Nom</span>
              <span className="photoModalValue">{photo.name}</span>
            </div>
          )}

          {hasValue(photo.date) && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Date</span>
              <span className="photoModalValue">{photo.date}</span>
            </div>
          )}

          {hasValue(photo.dimensions) && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Dimensions</span>
              <span className="photoModalValue">{photo.dimensions}</span>
            </div>
          )}

          {hasValue(photo.size) && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Taille</span>
              <span className="photoModalValue">{photo.size}</span>
            </div>
          )}

          {hasValue(photo.format) && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Format</span>
              <span className="photoModalValue">{photo.format}</span>
            </div>
          )}

          {hasValue(photo.library) && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Bibliothèque</span>
              <span className="photoModalValue">{photo.library}</span>
            </div>
          )}

          {hasValue(photo.shooting) && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Shooting</span>
              <span className="photoModalValue">{photo.shooting}</span>
            </div>
          )}

          {photo.tags && photo.tags.length > 0 && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Tags</span>
              <div className="photoModalTags">
                {photo.tags.map((tag, idx) => (
                  <span key={idx} className="photoModalTag">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {hasValue(photo.description) && (
            <div className="photoModalRow">
              <span className="photoModalLabel">Description</span>
              <span className="photoModalValue">{photo.description}</span>
            </div>
          )}

          {/* Message si aucune info disponible */}
          {!hasValue(photo.name) && 
           !hasValue(photo.date) && 
           !hasValue(photo.dimensions) && 
           !hasValue(photo.size) && 
           !hasValue(photo.format) && 
           !hasValue(photo.library) && 
           !hasValue(photo.shooting) && 
           (!photo.tags || photo.tags.length === 0) && 
           !hasValue(photo.description) && (
            <div style={{ 
              padding: "20px", 
              textAlign: "center", 
              color: "var(--muted)",
              fontSize: "13px"
            }}>
              <em>Informations détaillées disponibles après connexion au backend</em>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="modalActions">
          <button className="btn">Télécharger</button>
          <button className="btn">Modifier</button>
          <button 
            className="btn" 
            style={{ 
              background: "rgba(239, 68, 68, 0.15)",
              borderColor: "rgba(239, 68, 68, 0.4)",
              color: "#ef4444"
            }}
          >
            Supprimer
          </button>
        </div>
      </div>
    </Modal>
  );
}
