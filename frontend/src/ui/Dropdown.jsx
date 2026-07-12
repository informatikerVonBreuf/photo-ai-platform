import { useState, useEffect, useRef } from "react";

export default function Dropdown({ trigger, children, align = "left" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="dropdown" ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      
      {isOpen && (
        <div className={`dropdownMenu dropdownMenu-${align}`}>
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ onClick, children, icon }) {
  return (
    <button className="dropdownItem" onClick={onClick}>
      {icon && <span className="dropdownIcon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export function DropdownDivider() {
  return <div className="dropdownDivider" />;
}
