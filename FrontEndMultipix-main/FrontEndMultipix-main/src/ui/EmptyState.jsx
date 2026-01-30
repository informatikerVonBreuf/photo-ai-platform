import React from "react";

export default function EmptyState({ icon = "📭", title, message, actionText, onAction }) {
  return (
    <div className="emptyState">
      <div className="emptyIcon">{icon}</div>
      <div className="emptyTitle">{title}</div>
      <div className="emptyMessage">{message}</div>
      {actionText && onAction && (
        <button className="btn primary" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}
