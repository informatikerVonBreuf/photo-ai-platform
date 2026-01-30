import { useMemo, useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import SkeletonCard from "../ui/SkeletonCard";
import EmptyState from "../ui/EmptyState";

const MOCK_LIBRARIES = [
  { id: "lib1", name: "Mariages 2024" },
  { id: "lib2", name: "Portraits Studio" },
];

const MOCK_SHOOTINGS = [
  { id: "sh1", library_id: "lib1", name: "Mariage — Marie & Rochinel" },
  { id: "sh2", library_id: "lib1", name: "Cérémonie — Église" },
  { id: "sh3", library_id: "lib2", name: "Portrait — Corporate" },
];

export default function ImageSearchPage() {
  const [libraryId, setLibraryId] = useState("lib1");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [refFiles, setRefFiles] = useState([]);
  const [logic, setLogic] = useState("intersection"); // intersection | union
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const canRun = useMemo(() => Boolean(libraryId) && refFiles.length > 0, [libraryId, refFiles]);

  async function run() {
    if (!canRun) return;
    setLoading(true);

    // TODO: ton endpoint /search-image
    await new Promise((r) => setTimeout(r, 600));
    setResults([
      { id: "p1", url: "https://picsum.photos/600/400?7", caption: "Portrait", score: 0.93 },
      { id: "p2", url: "https://picsum.photos/600/400?8", caption: "Portrait 2", score: 0.88 },
    ]);

    setLoading(false);
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
              <div className="cardTitle">Images de référence</div>
              <div className="cardSub">
                Choisis une ou plusieurs images (ex: un visage par image).
              </div>
            </div>
          </div>

          <label className="field">
            Importer depuis ton PC
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setRefFiles(Array.from(e.target.files || []))}
            />
          </label>

          <div className="toggleRow">
            <div className="toggleLabel">Logique</div>
            <div className="toggle">
              <button
                type="button"
                className={`toggleBtn ${logic === "intersection" ? "on" : ""}`}
                onClick={() => setLogic("intersection")}
              >
                Intersection
              </button>
              <button
                type="button"
                className={`toggleBtn ${logic === "union" ? "on" : ""}`}
                onClick={() => setLogic("union")}
              >
                Union
              </button>
            </div>
          </div>

          <button className="btn primary" disabled={!canRun || loading} onClick={run}>
            {loading ? "Recherche..." : "Lancer la recherche"}
          </button>

          <div className="mutedSmall">
            (Prochain step) Ajouter un sélecteur “Choisir une photo depuis la library”.
          </div>
        </div>

        <RatingStars
          label="Appréciation — Recherche image"
          onRate={(v) => console.log("rate image search", v)}
        />
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique — Recherche image" items={[]} />
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
            ) : results.length === 0 ? (
              <EmptyState
                icon="🔍"
                title="Aucun résultat"
                message="Essayez avec d'autres images ou ajustez votre sélection de bibliothèque."
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
