import { useEffect } from "react";

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  contentClassName = "",
  bodyClassName = "",
  overlayClassName = "",
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`modalOverlay ${overlayClassName}`.trim()} onClick={onClose}>
      <div className={`modalContent ${contentClassName}`.trim()} onClick={(e) => e.stopPropagation()}>
        <div className="modalHeader">
          <h3 className="modalTitle">{title}</h3>
          <button className="modalClose" onClick={onClose}>×</button>
        </div>
        <div className={`modalBody ${bodyClassName}`.trim()}>
          {children}
        </div>
      </div>
    </div>
  );
}
