import React from "react";

export default function LoadingSpinner({ message = "Chargement..." }) {
  return (
    <div className="loadingBox">
      <div className="spinner" aria-hidden="true" />
      <div className="loadingText">{message}</div>
    </div>
  );
}
