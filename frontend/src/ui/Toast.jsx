import React from "react";

export default function Toast({ message, type = "success", onClose }) {
  return (
    <div className={`toast toast-${type}`}>
      <span className="toastIcon">
        {type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}
      </span>
      <span className="toastMessage">{message}</span>
      <button className="toastClose" onClick={onClose}>×</button>
    </div>
  );
}
