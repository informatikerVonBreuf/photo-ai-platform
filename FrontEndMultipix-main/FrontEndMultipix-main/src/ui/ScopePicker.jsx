import { useMemo } from "react";

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
        <div>
          <div className="cardTitle">Scope</div>
          <div className="cardSub">Choisis une library ou sélectionne des shootings.</div>
        </div>
      </div>

      <div className="grid2">
        <label className="field">
          Library
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
          <div className="fieldLabel">Shootings (optionnel)</div>
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

      <div className="mutedSmall">
        Si aucun shooting n’est sélectionné, la recherche s’applique à toute la library.
      </div>
    </div>
  );
}
