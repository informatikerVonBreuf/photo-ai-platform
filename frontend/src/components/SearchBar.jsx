import { useMemo, useState } from "react";

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState("");

  // tags (UI)
  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState("");

  // filters
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [orientationFilter, setOrientationFilter] = useState("any");
  const [maxWidth, setMaxWidth] = useState("");
  const [maxHeight, setMaxHeight] = useState("");
  const [excludeLargeImages, setExcludeLargeImages] = useState(false);

  const canSearch = useMemo(() => query.trim().length > 0 || tags.length > 0, [query, tags]);

  function addTag() {
    const t = tagDraft.trim();
    if (!t) return;
    if (tags.includes(t)) return;
    setTags((prev) => [...prev, t]);
    setTagDraft("");
  }

  function removeTag(t) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  function handleSubmit(e) {
    e.preventDefault();

    const filters = {
      dateRangeStart: dateRangeStart || null,
      dateRangeEnd: dateRangeEnd || null,
      orientation: orientationFilter,
      maxWidth: maxWidth ? Number(maxWidth) : null,
      maxHeight: maxHeight ? Number(maxHeight) : null,
      excludeLargeImages,
    };

    onSearch?.({
      query: query.trim() || null,
      filters,
      tags,
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
      <label>
        Requête texte
        <input
          type="text"
          placeholder="ex : photos de groupe, cérémonie, danse…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      <div className="card" style={{ padding: 12, borderRadius: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700 }}>Tags</div>
            <div className="muted small">Ajoute des tags pour affiner (ex: “mariage”, “portrait-pro”).</div>
          </div>
          <span className="pill">{tags.length} sélectionné(s)</span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            placeholder="Ajouter un tag…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
          />
          <button type="button" className="btn" onClick={addTag}>
            Ajouter
          </button>
        </div>

        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {tags.map((t) => (
              <span
                key={t}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.12)",
                  background: "rgba(0,0,0,.18)",
                  color: "rgba(255,255,255,.86)",
                  fontSize: 12,
                }}
              >
                {t}
                <button
                  type="button"
                  className="btn ghost"
                  style={{ padding: "4px 8px", borderRadius: 999 }}
                  onClick={() => removeTag(t)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 12, borderRadius: 16 }}>
        <div style={{ fontWeight: 700 }}>Filtres</div>
        <div className="muted small">Dates, orientation, dimensions.</div>

        <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
          <div className="form-row">
            <label>
              Du
              <input
                type="datetime-local"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
              />
            </label>

            <label>
              Au
              <input
                type="datetime-local"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Orientation
              <select
                value={orientationFilter}
                onChange={(e) => setOrientationFilter(e.target.value)}
              >
                <option value="any">Toutes</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Paysage</option>
                <option value="square">Carrée</option>
              </select>
            </label>

            <label>
              Exclure images trop grandes
              <select
                value={excludeLargeImages ? "yes" : "no"}
                onChange={(e) => setExcludeLargeImages(e.target.value === "yes")}
              >
                <option value="no">Non</option>
                <option value="yes">Oui</option>
              </select>
            </label>
          </div>

          <div className="form-row">
            <label>
              Largeur max (px)
              <input
                type="number"
                min="0"
                value={maxWidth}
                onChange={(e) => setMaxWidth(e.target.value)}
                placeholder="ex: 4000"
              />
            </label>

            <label>
              Hauteur max (px)
              <input
                type="number"
                min="0"
                value={maxHeight}
                onChange={(e) => setMaxHeight(e.target.value)}
                placeholder="ex: 3000"
              />
            </label>
          </div>
        </div>
      </div>

      <button className="btn primary" disabled={!canSearch}>
        Lancer la recherche
      </button>
    </form>
  );
}
