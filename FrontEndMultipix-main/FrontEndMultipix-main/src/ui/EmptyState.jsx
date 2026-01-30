import React from "react";
import Tooltip from "./Tooltip";

export default function EmptyState({ icon = "📭", title, message, tooltip, actionText, onAction }) {
  return (
    <div className="emptyState">
      <div className="emptyIcon">{icon}</div>
      {title && (
        tooltip ? (
          <Tooltip text={tooltip} position="top">
            <div className="emptyTitle">{title}</div>
          </Tooltip>
        ) : (
          <div className="emptyTitle">{title}</div>
        )
      )}
      {message && <div className="emptyMessage">{message}</div>}
      {actionText && onAction && (
        <button className="btn primary" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
}
