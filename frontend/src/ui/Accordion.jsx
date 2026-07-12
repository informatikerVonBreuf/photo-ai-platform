import { useState } from "react";

export default function Accordion({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="accordion">
      <button 
        className={`accordionTrigger ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="accordionTitle">{title}</span>
        <span className="accordionIcon">{isOpen ? "−" : "+"}</span>
      </button>
      
      <div className={`accordionContent ${isOpen ? "open" : ""}`}>
        <div className="accordionBody">
          {children}
        </div>
      </div>
    </div>
  );
}
