// src/components/PhotoGrid.jsx
export default function PhotoGrid({ photos, onOpen }) {
  return (
    <div className="photo-grid">
      {(photos || []).map((p) => (
        <button
          key={p.id}
          className="photo-tile"
          type="button"
          onClick={() => onOpen?.(p)}
          title={p.id}
        >
          <img src={p.url} alt={p.id} loading="lazy" />
        </button>
      ))}
    </div>
  );
}
