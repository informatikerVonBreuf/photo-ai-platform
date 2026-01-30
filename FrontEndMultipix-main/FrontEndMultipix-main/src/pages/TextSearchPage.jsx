import { useMemo, useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import LoadingSpinner from "../ui/LoadingSpinner";
import SkeletonCard from "../ui/SkeletonCard";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";

const MOCK_LIBRARIES = [
  { id: "lib1", name: "Mariages 2024" },
  { id: "lib2", name: "Portraits Studio" },
];

const MOCK_SHOOTINGS = [
  { id: "sh1", library_id: "lib1", name: "Mariage — Marie & Rochinel" },
  { id: "sh2", library_id: "lib1", name: "Cérémonie — Église" },
  { id: "sh3", library_id: "lib2", name: "Portrait — Corporate" },
];

export default function TextSearchPage() {
  const [libraryId, setLibraryId] = useState("lib1");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const canRun = useMemo(() => Boolean(libraryId) && query.trim().length > 0, [libraryId, query]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && canRun && !loading) {
      run();
    }
  }

  async function run() {
    if (!canRun) return;
    setLoading(true);
    setError(null);

    try {
      // Simulation d'erreur aléatoire (1 chance sur 3)
      if (Math.random() < 0.33) {
        throw new Error("Erreur de connexion au serveur");
      }

      // TODO: appeler ton backend /search-text avec scope + query
      // Ici: mock results
      await new Promise((r) => setTimeout(r, 500));
      setResults([
        { id: "p1", url: "https://picsum.photos/600/400?1", caption: "Photo de groupe", score: 0.91 },
        { id: "p2", url: "https://picsum.photos/600/400?2", caption: "Cérémonie", score: 0.87 },
        { id: "p3", url: "https://picsum.photos/600/400?3", caption: "Danse", score: 0.82 },
      ]);
    } catch (err) {
      setError(err.message || "Erreur inconnue");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pageGrid">
      <div className="leftCol">
        <ScopePicker
          libraries={MOCK_LIBRARIES}
          shootings={MOCK_SHOOTINGS}
          libraryId={libraryId}
          setLibraryId={setLibraryId}
          selectedShootings={selectedShootings}
          setSelectedShootings={setSelectedShootings}
        />

        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Votre requête</div>
              <div className="cardSub">Décris ce que tu veux trouver (ex: “photos de groupe”).</div>
            </div>
          </div>

          <label className="field">
            Requête texte
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ex: photos de groupe, cérémonie, danse…"
            />
          </label>

          <button className="btn primary" disabled={!canRun || loading} onClick={run}>
            {loading ? (
              <>
                <span className="btnSpinner" />
                Recherche...
              </>
            ) : (
              <>
                🔍 Lancer la recherche
              </>
            )}
          </button>
        </div>

        <RatingStars
          label="Appréciation — Recherche texte"
          onRate={(v) => console.log("rate text search", v)}
        />
      </div>

      <div className="rightCol">
        <HistoryPanel
          title="Historique — Recherche texte"
          items={[]}
        />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Résultats</div>
              <div className="cardSub">
                {results.length ? `${results.length} photo(s)` : "Aucun résultat"}
              </div>
            </div>
            <button className="btn" disabled={!results.length}>
              Télécharger (bientôt)
            </button>
          </div>

          <div className="gallery">
            {loading ? (
              <SkeletonCard count={8} />
            ) : error ? (
              <ErrorState
                title="Erreur de recherche"
                message={error}
                onRetry={run}
              />
            ) : results.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="Aucun résultat"
                message="Essayez une autre requête ou ajustez votre sélection de bibliothèque."
              />
            ) : (
              results.map((r) => (
                <div className="tile" key={r.id}>
                  <div className="tileImg">
                    <img src={r.url} alt={r.caption} />
                  </div>
                  <div className="tileMeta">
                    <div className="tileCap">{r.caption}</div>
                    <div className="tileSub">score: {r.score}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
