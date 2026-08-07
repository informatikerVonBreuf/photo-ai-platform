import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
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
import { listLibraries, listShootings, searchImages } from "../api/client";
import "../styles/dropdown.css";

export default function ImageSearchPage() {
  const [libraries, setLibraries] = useState([]);
  const [shootings, setShootings] = useState([]);
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

  useEffect(() => {
    let cancelled = false;
    Promise.all([listLibraries(), listShootings()])
      .then(([libraryResponse, shootingResponse]) => {
        if (cancelled) return;
        setLibraries(libraryResponse.libraries || []);
        setShootings(shootingResponse.shootings || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Impossible de charger les albums");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canRun = useMemo(() => refFiles.length > 0, [refFiles]);

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
      const response = await searchImages({
        mode: "image",
        query: "",
        imageFiles: refFiles,
        libraryId: libraryId || undefined,
        shootingId:
          selectedShootings.length === 1
            ? selectedShootings[0]
            : undefined,
        referenceLogic: logic,
      });
      setResults(
        (response.results || []).map((photo) => ({
          ...photo,
          caption:
            photo.caption ||
            photo.original_filename ||
            "Image similaire",
        }))
      );
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
                <Tooltip text="Sélectionne une ou plusieurs images de référence. L’album et le shooting sont des filtres optionnels." position="right">
                  <div className="welcomeTitle">Recherche par image</div>
                </Tooltip>
              </div>
            </div>
      <div className="leftCol">
        <ScopePicker
          libraries={libraries}
          shootings={shootings}
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
            {loading ? (
              "Recherche..."
            ) : (
              <>
                <MagnifyingGlass size={18} />
                Lancer la recherche
              </>
            )}
          </button>
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
              items={libraries.map((lib) => ({
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
