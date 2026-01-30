import EmptyState from "./EmptyState";
import Tooltip from "./Tooltip";

export default function HistoryPanel({ title = "Historique", items = [] }) {
  return (
    <div className="card">
      <div className="cardHeader">
        <Tooltip text="Vos recherches récentes apparaîtront ici" position="left">
          <div className="cardTitle">{title}</div>
        </Tooltip>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="📜"
          title="Aucun historique"
        />
      ) : (
        <div className="historyList">
          {items.map((it) => (
            <div key={it.id} className="historyItem">
              <div className="historyMain">{it.title}</div>
              <div className="historySub">{it.meta}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
