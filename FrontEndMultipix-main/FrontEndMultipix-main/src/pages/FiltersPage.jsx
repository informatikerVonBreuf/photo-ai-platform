import { useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
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

export default function FiltersPage() {
  const [libraryId, setLibraryId] = useState("lib1");
  const [selectedShootings, setSelectedShootings] = useState([]);

  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState("");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [orientation, setOrientation] = useState("any");
  const [maxW, setMaxW] = useState("");
  const [maxH, setMaxH] = useState("");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  function addTag() {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagDraft("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  async function run() {
    // TODO: appeler /filters avec scope + filtres
    setLoading(true);
    setError(null);

    try {
      // Simulation d'erreur aléatoire (1 chance sur 3)
      if (Math.random() < 0.33) {
        throw new Error("Erreur de connexion au serveur");
      }

      await new Promise((r) => setTimeout(r, 600));
      setResults([
        { id: "p1", url: "https://picsum.photos/600/400?20", caption: "Filtré", score: 1 },
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
              <div className="cardTitle">Tags</div>
              <div className="cardSub">Ajoute des tags pour affiner.</div>
            </div>
          </div>

          <div className="row">
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="ex: portrait, mariage..."
              onKeyDown={handleKeyDown}
            />
            <button className="btn" onClick={addTag}>Ajouter</button>
          </div>

          <div className="chipBox">
            {tags.map((t) => (
              <span className="chip on" key={t}>
                {t}
                <button className="chipX" onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Filtres</div>
              <div className="cardSub">Dates, orientation, dimensions.</div>
            </div>
          </div>

          <div className="grid2">
            <label className="field">Du <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="field">Au <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} /></label>

            <label className="field">
              Orientation
              <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
                <option value="any">Toutes</option>
                <option value="portrait">Portrait</option>
                <option value="landscape">Paysage</option>
                <option value="square">Carrée</option>
              </select>
            </label>

            <label className="field">Largeur max (px) <input value={maxW} onChange={(e) => setMaxW(e.target.value)} placeholder="ex: 4000" /></label>
            <label className="field">Hauteur max (px) <input value={maxH} onChange={(e) => setMaxH(e.target.value)} placeholder="ex: 3000" /></label>
          </div>

          <button className="btn primary" onClick={run}>Appliquer</button>
        </div>

        <RatingStars label="Appréciation — Filtres" onRate={(v) => console.log("rate filters", v)} />
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique — Filtres" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Résultats</div>
              <div className="cardSub">{results.length ? `${results.length} photo(s)` : "Aucun résultat"}</div>
            </div>
          </div>

          <div className="gallery">
            {loading ? (
              <SkeletonCard count={8} />
            ) : error ? (
              <ErrorState title="Erreur de recherche" message={error} onRetry={run} />
            ) : results.length === 0 ? (
              <EmptyState
                icon="🎛️"
                title="Aucun résultat"
                message="Ajustez vos filtres pour affiner votre recherche."
              />
            ) : (
              results.map((r) => (
                <div className="tile" key={r.id}>
                  <div className="tileImg"><img src={r.url} alt={r.caption} /></div>
                  <div className="tileMeta">
                    <div className="tileCap">{r.caption}</div>
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
