import { useMemo } from "react";
import Tooltip from "./Tooltip";
import Dropdown from "../components/Dropdown";

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
    return shootings.filter((shooting) => shooting.library_id === libraryId);
  }, [shootings, libraryId]);

  function handleLibrarySelect(item) {
    setLibraryId(item.value);
    setSelectedShootings([]);
  }

  function toggleShooting(id) {
    if (!allowMultiShootings) {
      setSelectedShootings([id]);
      return;
    }

    if (selectedShootings.includes(id)) {
      setSelectedShootings(selectedShootings.filter((selectedId) => selectedId !== id));
    } else {
      setSelectedShootings([...selectedShootings, id]);
    }
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <Tooltip text="Choisis une bibliotheque et/ou selectionne ses shootings." position="right">
          <div className="cardTitle">Ou chercher ?</div>
        </Tooltip>
      </div>

      <div className="grid2">
        <div className="field">
          <div className="fieldLabel">Bibliotheque</div>
          <Dropdown
            label="Choisis une bibliotheque"
            items={libraries.map((library) => ({
              value: library.id,
              label: library.name,
            }))}
            onSelect={handleLibrarySelect}
          />
        </div>

        <div className="field">
          <Tooltip
            text="Si aucun shooting n'est selectionne, la recherche s'applique a toute la bibliotheque."
            position="left"
          >
            <div className="fieldLabel">Shootings (optionnel)</div>
          </Tooltip>

          <div className="chipBox">
            {currentShootings.length === 0 && <div className="mutedSmall">Selectionne une bibliotheque.</div>}
            {currentShootings.map((shooting) => (
              <button
                key={shooting.id}
                type="button"
                className={`chip ${selectedShootings.includes(shooting.id) ? "on" : ""}`}
                onClick={() => toggleShooting(shooting.id)}
              >
                {shooting.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
