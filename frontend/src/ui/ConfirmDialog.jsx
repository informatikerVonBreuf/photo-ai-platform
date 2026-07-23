import Modal from "./Modal";

export default function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirmer l'action", 
  message = "Êtes-vous sûr de vouloir continuer ?",
  confirmText = "Confirmer",
  cancelText = "Annuler",
  danger = false 
}) {
  
  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="confirmDialogContent">
        <p className="confirmDialogMessage">{message}</p>
        
        <div className="confirmDialogActions">
          <button 
            className="btn" 
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button 
            className={`btn ${danger ? "btnDanger" : "primary"}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
