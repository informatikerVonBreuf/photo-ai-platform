// src/components/ClusterDetailsPanel.jsx
import { useEffect, useMemo, useState } from "react";

export default function ClusterDetailsPanel({
  cluster,
  onSave,
  onExportCluster,
  onExportAll,
}) {
  const [theme, setTheme] = useState("");
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    setTheme(cluster?.theme || "");
    setValidated(Boolean(cluster?.validated));
  }, [cluster]);

  const canSave = useMemo(() => {
    if (!cluster) return false;
    return theme.trim().length > 0 || validated !== Boolean(cluster.validated);
  }, [cluster, theme, validated]);

  if (!cluster) {
    return (
      <div className="panel">
        <div className="panel__title">Détails cluster</div>
        <div className="muted">Sélectionne un cluster pour voir les détails.</div>

        <div className="panel__actions">
          <button className="btn btn-secondary" type="button" onClick={onExportAll}>
            Export global (JSON)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel__title">Détails cluster</div>

      <div className="field">
        <label className="label">Thématique</label>
        <input
          className="input"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="Ex: Ceremony, Group Photos..."
        />
      </div>

      <div className="field row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={validated}
            onChange={(e) => setValidated(e.target.checked)}
          />
          <span>Thématique validée</span>
        </label>
      </div>

      <div className="panel__stats">
        <div className="stat">
          <div className="stat__k">Images</div>
          <div className="stat__v">{cluster.count}</div>
        </div>
        <div className="stat">
          <div className="stat__k">Confiance</div>
          <div className="stat__v">
            {typeof cluster.confidence === "number" ? cluster.confidence.toFixed(2) : "—"}
          </div>
        </div>
      </div>

      <div className="panel__actions">
        <button
          className="btn"
          type="button"
          disabled={!canSave}
          onClick={() => onSave?.({ theme: theme.trim(), validated })}
        >
          Sauvegarder
        </button>

        <button className="btn btn-secondary" type="button" onClick={onExportCluster}>
          Export cluster (JSON)
        </button>

        <button className="btn btn-secondary" type="button" onClick={onExportAll}>
          Export global (JSON)
        </button>
      </div>

      <div className="muted small">
        (Prévu) Fusion / split / exclusion d’images : on gardera ces actions ici.
      </div>
    </div>
  );
}
