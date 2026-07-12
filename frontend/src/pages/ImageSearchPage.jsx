import { useMemo, useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import SkeletonCard from "../ui/SkeletonCard";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Tooltip from "../ui/Tooltip";
import PhotoModal from "../ui/PhotoModal";
import { downloadClusterImages } from "../utils/downloadClusterImages";
import Modal from "../ui/Modal";
import FieldError from "../ui/FieldError";
import Dropdown from "../components/Dropdown";
import "../styles/dropdown.css";

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
  const [libraryId, setLibraryId] = useState("");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [refFiles, setRefFiles] = useState([]);
  const [logic, setLogic] = useState("intersection"); // intersection | union
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [saveAlbumId, setSaveAlbumId] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [albumMode, setAlbumMode] = useState("select");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumDesc, setNewAlbumDesc] = useState("");
  const [shootingName, setShootingName] = useState("");
  const [shootingDesc, setShootingDesc] = useState("");
  const [albumError, setAlbumError] = useState("");
  const [shootingError, setShootingError] = useState("");

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

  function openSaveModal() {
    setAlbumMode("select");
    setAlbumError("");
    setShootingError("");
    setIsSaveModalOpen(true);
  }

  function closeSaveModal() {
    setIsSaveModalOpen(false);
    setAlbumMode("select");
    setSaveAlbumId("");
    setNewAlbumName("");
    setNewAlbumDesc("");
    setShootingName("");
    setShootingDesc("");
    setAlbumError("");
    setShootingError("");
  }

  function handleSaveShooting() {
    if (albumMode === "select" && !saveAlbumId) {
      setAlbumError("Choisis un album.");
      return;
    }
    if (albumMode === "create" && !newAlbumName.trim()) {
      setAlbumError("Choisis un album ou crée-en un.");
      return;
    }
    if (!shootingName.trim()) {
      setShootingError("Le nom du shooting est obligatoire.");
      return;
    }
    setAlbumError("");
    setShootingError("");
    closeSaveModal();
  }

  async function handleDownloadResults() {
    if (!results.length) return;
    await downloadClusterImages({ theme: "resultats-recherche-image", photos: results });
  }

  return (
    <div className="pageGrid">
      <div className="fullRow">
              <div className="welcome">
                <Tooltip text="Sélectionne les visages de référence, indique l’album et/ou le shooting dans lequel effectuer la recherche, puis lance-la." position="right">
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
              className="fileInput"
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
            <button className="btn" disabled={!results.length} onClick={handleDownloadResults}>
              Télécharger
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

      {results.length > 0 && (
        <div className="fullRow">
          <div className="card">
            <div className="cardHeader">
              <div>
                <div className="cardSub">Associer ces résultats à un album</div>
              </div>
            </div>

            <button
              className="btn primary"
              onClick={openSaveModal}
              disabled={results.length === 0}
            >
              Enregistrer le shooting
            </button>
          </div>
        </div>
      )}

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

      <Modal
        isOpen={isSaveModalOpen}
        onClose={closeSaveModal}
        title="Nouveau shooting"
        bodyClassName="shootingModalBody"
      >
        <div className="albumModeRow">
          <button
            type="button"
            className="albumModeOption"
            onClick={() => {
              setAlbumMode("select");
              setAlbumError("");
              setNewAlbumName("");
              setNewAlbumDesc("");
            }}
          >
            <span className={`albumModeDot ${albumMode === "select" ? "active" : ""}`} />
            <span> Sélectionner un album</span>
          </button>

          <button
            type="button"
            className="albumModeOption"
            onClick={() => {
              setAlbumMode("create");
              setAlbumError("");
              setSaveAlbumId("");
            }}
          >
            <span className={`albumModeDot ${albumMode === "create" ? "active" : ""}`} />
            <span> Créer un album</span>
          </button>
        </div>

        {albumMode === "select" ? (
          <div className="field">
            <Dropdown
              label="Choisis un album"
              className="dd-compact"
              items={MOCK_LIBRARIES.map((lib) => ({
                value: lib.id,
                label: lib.name,
              }))}
              onSelect={(item) => setSaveAlbumId(item.value)}
            />
            <FieldError message={albumError} />
          </div>
        ) : (
          <>
            <div className="field">
              <input
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Nom de l’album"
              />
              <FieldError message={albumError} />
            </div>

            <div className="field">
              <input
                value={newAlbumDesc}
                onChange={(e) => setNewAlbumDesc(e.target.value)}
                placeholder="Description de l’album"
              />
            </div>
          </>
        )}

        <div className="dropdownDivider" style={{ margin: "16px 0" }} />

        <label className="field">
          Nom du shooting
          <input
            value={shootingName}
            onChange={(e) => setShootingName(e.target.value)}
            placeholder="ex: Mariage — Marie & Rochinel"
          />
          <FieldError message={shootingError} />
        </label>

        <label className="field">
          Description
          <input
            value={shootingDesc}
            onChange={(e) => setShootingDesc(e.target.value)}
            placeholder="ex: Cérémonie + soirée"
          />
        </label>

        <div className="modalActions">
          <button className="btn" onClick={closeSaveModal}>
            Annuler
          </button>
          <button
            className="btn primary"
            onClick={handleSaveShooting}
            disabled={
              !shootingName.trim() ||
              (albumMode === "select" ? !saveAlbumId : !newAlbumName.trim())
            }
          >
            Enregistrer
          </button>
        </div>
      </Modal>
    </div>
  );
}
