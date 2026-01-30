import { useMemo } from "react";
import Tooltip from "./Tooltip";

export default function ScopePicker({
  libraries = [],
  shootings = [],
  libraryId,
  setLibraryId,
  selectedShootings,
  setSelectedShootings,
  allowMultiShootings = true,
}) {
  const currentShootings = useMemo(() => {
    if (!libraryId) return [];
    return shootings.filter((s) => s.library_id === libraryId);
  }, [shootings, libraryId]);

  function toggleShooting(id) {
    if (!allowMultiShootings) {
      setSelectedShootings([id]);
      return;
    }
    if (selectedShootings.includes(id)) {
      setSelectedShootings(selectedShootings.filter((x) => x !== id));
    } else {
      setSelectedShootings([...selectedShootings, id]);
    }
  }

  return (
    <div className="card">
      <div className="cardHeader">
      <Tooltip text="Choisis une bibliothèque et/ou sélectionne ses shootings" position="right">
    <div className="cardTitle">Où chercher ?</div>
      </Tooltip>
    </div>

      <div className="grid2">
        <label className="field">
          Bibliotèque
          <select value={libraryId || ""} onChange={(e) => setLibraryId(e.target.value || null)}>
            <option value="">— choisir —</option>
            {libraries.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <div className="field">
          <Tooltip text="Si aucun shooting n’est sélectionné, la recherche s’applique à toute la bibliothèque." position="left">
          <div className="fieldLabel">Shootings (optionnel)</div>
                </Tooltip>

          <div className="chipBox">
            {currentShootings.length === 0 && <div className="mutedSmall">Sélectionne une library.</div>}
            {currentShootings.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip ${selectedShootings.includes(s.id) ? "on" : ""}`}
                onClick={() => toggleShooting(s.id)}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      
    </div>
  );
}
