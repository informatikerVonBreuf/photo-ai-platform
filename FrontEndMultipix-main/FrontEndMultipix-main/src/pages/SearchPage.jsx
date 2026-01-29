import { useState } from "react";
import SearchBar from "../components/SearchBar";
import { searchImages } from "../api/client";

export default function SearchPage() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  async function onSearch({ query, filters, tags }) {
    setLoading(true);
    const t0 = performance.now();

    // ✅ On force TEXT (pas de mode hybride)
    const data = await searchImages({
      mode: "text",
      query,
      imageFiles: [],
      filters,
      tags,
    });

    const dt = Math.round(performance.now() - t0);
    setResults((data?.results || []).map((r) => ({ ...r, _ms: dt })));
    setLoading(false);
  }

  return (
    <div className="grid-2">
      <section className="card">
        <div className="card-header">
          <div>
            <h3 style={{ margin: 0 }}>Recherche / Filtres</h3>
            <div className="muted small">
              Texte + tags + plage de dates + orientation + dimensions.
            </div>
          </div>
          <span className="pill">TEXT</span>
        </div>

        <SearchBar onSearch={onSearch} />

        {loading && <div className="loader">Recherche en cours…</div>}
      </section>

      <section className="card">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Historique</h3>
          <div className="muted small">Bientôt: search_sessions</div>
        </div>
        <div className="muted">
          Ici tu affiches les recherches récentes (depuis PostgreSQL) avec un menu
          déroulant.
        </div>
      </section>

      <section className="card full">
        <div className="card-header">
          <h3 style={{ margin: 0 }}>Résultats</h3>
          <div className="muted">
            {results.length ? `${results.length} photo(s)` : "Aucun résultat"}
          </div>
        </div>

        <div className="results-grid">
          {results.map((r) => (
            <div key={r.id} className="result-tile">
              <div className="thumb">
                <img src={r.url} alt={r.caption || "photo"} />
              </div>
              <div className="tile-meta">
                <div className="cap">{r.caption || "—"}</div>
                <div className="sub">
                  <span>
                    score:{" "}
                    {typeof r.score === "number" ? r.score.toFixed(3) : "—"}
                  </span>
                  <span>· {r._ms} ms</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn" disabled={!results.length}>
            Exporter (bientôt)
          </button>
        </div>
      </section>
    </div>
  );
}
