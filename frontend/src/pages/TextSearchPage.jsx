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

export default function TextSearchPage() {
  const [libraries, setLibraries] = useState([]);
  const [shootings, setShootings] = useState([]);
  const [libraryId, setLibraryId] = useState("");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [query, setQuery] = useState("");
  const [resultLimit, setResultLimit] = useState("all");
  const [useVlm, setUseVlm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
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

  const canRun = useMemo(() => query.trim().length > 0, [query]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && canRun && !loading) {
      run();
    }
  }

  async function run() {
    if (!canRun) return;
    setLoading(true);
    setError(null);
    setSearchMeta(null);

    try {
      const response = await searchImages({
        mode: "text",
        query: query.trim(),
        imageFiles: [],
        libraryId: libraryId || undefined,
        shootingId:
          selectedShootings.length === 1
            ? selectedShootings[0]
            : undefined,
        limit: resultLimit === "all" ? undefined : Number(resultLimit),
        useVlm,
      });
      setResults(
        (response.results || []).map((photo) => ({
          ...photo,
          caption:
            photo.caption ||
            photo.original_filename ||
            "Image sans description",
          name: photo.original_filename || "Image",
        }))
      );
      setSearchMeta(response.diagnostics || null);
    } catch (err) {
      setError(err.message || "Erreur inconnue");
      setResults([]);
      setSearchMeta(null);
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
    await downloadClusterImages({ theme: "resultats-recherche-texte", photos: results });
  }

  const vlmMode = searchMeta?.vlm_rerank?.mode;
  const vlmSummary =
    vlmMode === "verified"
      ? `VLM : ${searchMeta.vlm_rerank.accepted}/${searchMeta.vlm_rerank.reviewed} retenues`
      : vlmMode === "skipped_by_user"
        ? "VLM désactivé"
        : ["server_disabled", "unavailable", "disabled"].includes(vlmMode)
          ? "VLM indisponible, filtre textuel appliqué"
          : ["busy", "cooldown"].includes(vlmMode)
            ? "VLM occupé, filtre textuel appliqué"
            : vlmMode === "failed_open"
              ? "VLM interrompu, filtre textuel appliqué"
              : null;
  const totalMs = searchMeta?.stage_timings_ms?.total;
  const resultSummary = [
    searchMeta ? `${results.length} photo(s)` : null,
    vlmSummary,
    Number.isFinite(totalMs) ? `${Math.round(totalMs)} ms` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="pageGrid">
      <div className="fullRow">
        <div className="welcome">
          <Tooltip text="Décris ce que tu cherches. La bibliothèque et le shooting sont des filtres optionnels." position="right">
            <div className="welcomeTitle">Recherche par texte</div>
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

          <label className="field">
            <div style={{ fontStyle: "italic" }}>Décris ce que tu cherches </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ex : personnes jouant au football sous la pluie"
            />
          </label>

          <div className="searchOptions">
            <div className="searchOptionRow">
              <span className="searchOptionLabel">Résultats</span>
              <div className="toggle" role="group" aria-label="Nombre de résultats">
                {["all", "10", "20", "50"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`toggleBtn ${resultLimit === value ? "on" : ""}`}
                    aria-pressed={resultLimit === value}
                    onClick={() => setResultLimit(value)}
                  >
                    {value === "all" ? "Tous" : value}
                  </button>
                ))}
              </div>
            </div>

            <div className="searchOptionRow">
              <div className="searchOptionLabel">
                Vérification VLM
                <Tooltip
                  text="Vérifie directement les images après la fusion RRF."
                  position="top"
                >
                  <span className="infoIcon">i</span>
                </Tooltip>
              </div>
              <label className="searchSwitch">
                <input
                  type="checkbox"
                  checked={useVlm}
                  onChange={(event) => setUseVlm(event.target.checked)}
                  aria-label="Activer la vérification VLM"
                />
                <span className="searchSwitchTrack" aria-hidden="true">
                  <span className="searchSwitchThumb" />
                </span>
              </label>
            </div>
          </div>

          <button className="btn primary" disabled={!canRun || loading} onClick={run}>
            {loading ? (
              <>
                <span className="btnSpinner" />
                Recherche...
              </>
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
                {resultSummary}
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
                tooltip="Essayez une autre requête ou ajustez votre sélection de bibliothèque"
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
          featureName="Recherche texte"
          onRate={(v) => console.log("rate text search", v)} 
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
