export default function HistoryPanel({ title = "Historique", items = [] }) {
  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardTitle">{title}</div>
          <div className="cardSub">Dernières actions (à brancher PostgreSQL ensuite).</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="muted">Aucun historique pour l’instant.</div>
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
