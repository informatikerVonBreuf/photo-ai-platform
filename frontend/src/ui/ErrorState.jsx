import React from "react";

export default function ErrorState({ 
  title = "Une erreur est survenue", 
  message = "Impossible de charger les données.", 
  onRetry, 
  retryText = "Réessayer" 
}) {
  return (
    <div className="errorState">
      <div className="errorIcon">⚠️</div>
      <div className="errorTitle">{title}</div>
      <div className="errorMessage">{message}</div>
      {onRetry && (
        <button className="btn" onClick={onRetry}>
          {retryText}
        </button>
      )}
    </div>
  );
}
