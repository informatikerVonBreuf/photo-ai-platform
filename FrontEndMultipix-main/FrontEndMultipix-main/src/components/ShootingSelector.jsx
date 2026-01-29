// src/components/ShootingSelector.jsx
import StatusBadge from "./StatusBadge";

export default function ShootingSelector({ shootings, value, onChange }) {
  return (
    <div className="shooting-selector">
      <div className="shooting-selector__label">Shooting actif</div>

      <select
        className="input"
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="" disabled>
          Sélectionner un shooting…
        </option>
        {(shootings || []).map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {value ? (
        <div className="shooting-selector__meta">
          {(() => {
            const s = (shootings || []).find((x) => x.id === value);
            if (!s) return null;
            return (
              <>
                <span className="muted">{s.created_at}</span>
                <StatusBadge status={s.status} />
              </>
            );
          })()}
        </div>
      ) : (
        <div className="muted">Choisis un dossier pour lancer/voir les clusters.</div>
      )}
    </div>
  );
}
