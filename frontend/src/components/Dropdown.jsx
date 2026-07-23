// src/components/Dropdown.jsx
import { CaretDown } from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Composant Dropdown réutilisable avec glassmorphism
 * @param {Object} props
 * @param {string} props.label - Texte par défaut affiché
 * @param {Array} props.items - Tableau d'objets { value, label }
 * @param {Function} props.onSelect - Callback quand un item est sélectionné
 * @param {string} props.className - Classes CSS additionnelles
 * @param {number|string} props.menuWidth - Largeur du menu (ex: 220 ou "220px")
 */
export default function Dropdown({ label, items = [], onSelect, className = "", menuWidth = 565 }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const wrapperRef = useRef(null);
  const headerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  // Fermer le dropdown quand on clique en dehors
  useEffect(() => {
    function handleClickOutside(event) {
      const clickedInWrapper = wrapperRef.current?.contains(event.target);
      const clickedInMenu = menuRef.current?.contains(event.target);
      if (!clickedInWrapper && !clickedInMenu) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function updateMenuPosition() {
      const rect = headerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const computed = window.getComputedStyle(headerRef.current);
      const accent = computed.getPropertyValue("--accent")?.trim();
      const accent2 = computed.getPropertyValue("--accent2")?.trim() || accent;
      const resolvedWidth = menuWidth || rect.width;
      setMenuStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: typeof resolvedWidth === "number" ? `${resolvedWidth}px` : resolvedWidth,
        minWidth: typeof resolvedWidth === "number" ? `${resolvedWidth}px` : resolvedWidth,
        maxWidth: typeof resolvedWidth === "number" ? `${resolvedWidth}px` : resolvedWidth,
        "--accent": accent || undefined,
        "--accent2": accent2 || undefined,
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, menuWidth]);

  const handleSelect = (item) => {
    setSelected(item);
    setIsOpen(false);
    if (onSelect) {
      onSelect(item);
    }
  };

  return (
    <div className={`dd-wrapper ${className}`} ref={wrapperRef}>
      {/* Header du dropdown */}
      <button
        className="dd-header"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        ref={headerRef}
      >
        <span className={`dd-label ${selected ? "" : "dd-label-placeholder"}`}>
          {selected ? selected.label : label}
        </span>
        <CaretDown
          size={16}
          className={`dd-icon ${isOpen ? "dd-icon-open" : ""}`}
          weight="bold"
        />
      </button>

      {/* Liste déroulante */}
      {isOpen &&
        createPortal(
          <div className="dd-menu" style={menuStyle || {}} ref={menuRef}>
            {items.length > 0 ? (
              items.map((item, idx) => (
                <button
                  key={idx}
                  className="dd-item"
                  onClick={() => handleSelect(item)}
                >
                  {item.label}
                </button>
              ))
            ) : (
              <div className="dd-empty">Aucune option</div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
