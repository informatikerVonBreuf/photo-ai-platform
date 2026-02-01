import { useMemo, useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import SkeletonCard from "../ui/SkeletonCard";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Tooltip from "../ui/Tooltip";
import PhotoModal from "../ui/PhotoModal";

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
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const canRun = useMemo(() => Boolean(libraryId) && refFiles.length > 0, [libraryId, refFiles]);

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

      // TODO: ton endpoint /search-image
      await new Promise((r) => setTimeout(r, 600));
      setResults([
        { id: "p1", url: "https://picsum.photos/600/400?7", caption: "Portrait", score: 0.93 },
        { id: "p2", url: "https://picsum.photos/600/400?8", caption: "Portrait 2", score: 0.88 },
      ]);
    } catch (err) {
      setError(err.message || "Erreur inconnue");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function openPhotoModal(photo) {
    setSelectedPhoto(photo);
    setIsPhotoModalOpen(true);
  }

  function closePhotoModal() {
    setIsPhotoModalOpen(false);
    setSelectedPhoto(null);
  }

  function handleDeletePhoto(photo) {
    console.log("Suppression de la photo:", photo);
    
    // TODO: Appel API pour supprimer la photo du backend
    // await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
    
    // Mettre à jour l'état local en retirant la photo des résultats
    setResults((prevResults) => 
      prevResults.filter((p) => p.id !== photo.id)
    );
    
    console.log("Photo supprimée avec succès");
  }

  return (
    <div className="pageGrid">
      <div className="fullRow">
              <div className="welcome">
                <Tooltip text="Choisis des images de référence (visage / scène), sélectionne le scope, puis lance la recherche." position="right">
                  <div className="welcomeTitle">Recherche par image</div>
                </Tooltip>
              </div>
            </div>
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
            <Tooltip text="Choisis une ou plusieurs images (ex: un visage par image)." position="right">
              <div className="cardTitle">Images de référence</div>
            </Tooltip>
          </div>

          <label className="field italic">
            Importer depuis ton PC
            <input
              type="file"
              accept="image/*"
              multiple
              onKeyDown={handleKeyDown}
              onChange={(e) => setRefFiles(Array.from(e.target.files || []))}
            />
          </label>

          <div className="toggleRow">
            <div className="toggleLabel">
              Logique
              <Tooltip 
                text="Intersection : Images avec toutes les images de référence / Union : Images avec n'importe quelle image de référence" 
                position="top"
              >
                <span className="infoIcon">ⓘ</span>
              </Tooltip>
            </div>
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
                {results.length ? `${results.length} photo(s)` : ""}
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
                tooltip="Essayez avec d'autres images ou ajustez votre sélection de bibliothèque."
              />
            ) : (
              results.map((r) => (
                <div 
                  className="tile" 
                  key={r.id}
                  onClick={() => openPhotoModal(r)}
                >
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

      {/* Rating en bas */}
      <div className="fullRow">
        <RatingStars 
          featureName="Recherche image"
          onRate={(v) => console.log("rate image search", v)} 
        />
      </div>

      {/* Modal de détails photo */}
      <PhotoModal
        isOpen={isPhotoModalOpen}
        onClose={closePhotoModal}
        photo={selectedPhoto}
        onDelete={handleDeletePhoto}
      />
    </div>
  );
}
