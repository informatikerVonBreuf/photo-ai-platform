import { useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Tooltip from "../ui/Tooltip";
import Carousel from "../ui/Carousel";
import PhotoModal from "../ui/PhotoModal";
import ClusterModal from "../ui/ClusterModal";
import { downloadClusterImages } from "../utils/downloadClusterImages";
import { useToast } from "../hooks/useToast";
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

export default function ClusteringPage() {
  const [libraryId, setLibraryId] = useState("");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState(null);
  const [isClusterModalOpen, setIsClusterModalOpen] = useState(false);
  const [isClusterDownloading, setIsClusterDownloading] = useState(false);
  const [saveAlbumId, setSaveAlbumId] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [albumMode, setAlbumMode] = useState("select");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newAlbumDesc, setNewAlbumDesc] = useState("");
  const [shootingName, setShootingName] = useState("");
  const [shootingDesc, setShootingDesc] = useState("");
  const [albumError, setAlbumError] = useState("");
  const [shootingError, setShootingError] = useState("");
  const { addToast, ToastContainer } = useToast();

  // Validation UX: permet de lancer le clustering seulement si une bibliothèque est sélectionnée.
  const canRun = Boolean(libraryId);

  async function run() {
    // TODO: /cluster
    setLoading(true);
    setError(null);

    try {
      // Simulation d'erreur aléatoire (1 chance sur 3)
      if (Math.random() < 0.33) {
        throw new Error("Erreur de connexion au serveur");
      }

      await new Promise((r) => setTimeout(r, 800));
      setClusters([
        {
          id: "c1",
          theme: "Cérémonie",
          count: 12,
          photos: [
            { id: "p1", url: "https://picsum.photos/600/400?30", caption: "Cérémonie 1" },
            { id: "p2", url: "https://picsum.photos/600/400?31", caption: "Cérémonie 2" },
            { id: "p3", url: "https://picsum.photos/600/400?32", caption: "Cérémonie 3" },
          ],
        },
        {
          id: "c2",
          theme: "Photos de groupe",
          count: 20,
          photos: [
            { id: "p4", url: "https://picsum.photos/600/400?33", caption: "Groupe 1" },
            { id: "p5", url: "https://picsum.photos/600/400?34", caption: "Groupe 2" },
            { id: "p6", url: "https://picsum.photos/600/400?35", caption: "Groupe 3" },
          ],
        },
      ]);
    } catch (err) {
      setError(err.message || "Erreur inconnue");
      setClusters([]);
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
    
    // Mettre à jour l'état local en retirant la photo des clusters
    setClusters((prevClusters) => 
      prevClusters.map((cluster) => ({
        ...cluster,
        photos: cluster.photos.filter((p) => p.url !== photo.url),
        count: cluster.count - 1
      })).filter((cluster) => cluster.count > 0)
    );
    
    console.log("Photo supprimée avec succès");
  }

  function openClusterModal(cluster) {
    setSelectedCluster(cluster);
    setIsClusterModalOpen(true);
  }

  function closeClusterModal() {
    setIsClusterModalOpen(false);
    setSelectedCluster(null);
  }

  async function handleDownloadCluster() {
    if (!selectedCluster) return;
    setIsClusterDownloading(true);

    try {
      await downloadClusterImages(selectedCluster);
      addToast("Téléchargement du cluster lancé.");
    } catch (err) {
      addToast(err.message || "Échec du téléchargement du cluster.", "error");
    } finally {
      setIsClusterDownloading(false);
    }
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

  return (
    <div className="pageGrid">
      <div className="fullRow">
                    <div className="welcome">
                      <Tooltip text="Regroupe automatiquement tes photos par thème. Tu verras le résultat en cartes + galerie." position="right">
                        <div className="welcomeTitle">Tri automatique</div>
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
            <div>
              <Tooltip text="Les clusters (thèmes et galeries) s'afficheront après le lancement" position="right">
              <div className="cardTitle">Lancer un tri automatique</div>
              </Tooltip>
            </div>
          </div>

          <button className="btn primary" onClick={run} disabled={!canRun}>
            Lancer
          </button>
          {!canRun && (
            <div className="mutedSmall" style={{ marginTop: 8 }}>
              Sélectionne un album pour lancer le tri automatique.
            </div>
          )}
        </div>
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique — Tri automatique" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <Tooltip text="Ensemble de photos regroupées autour d’un même thème" position="right">
                <div className="cardTitle">Clusters</div>
              </Tooltip>
              <div className="cardSub">{clusters.length ? `${clusters.length} cluster(s)` : ""}</div>
            </div>
          </div>

          <div className="clusterGrid">
            {loading ? (
              <div className="loadingBox" style={{gridColumn: '1 / -1'}}>
                <div className="spinner" />
                <div className="loadingText">Analyse des clusters...</div>
              </div>
            ) : error ? (
              <ErrorState title="Erreur d'analyse" message={error} onRetry={run} />
            ) : clusters.length === 0 ? (
              <EmptyState
                icon="🧩"
                title="Aucun cluster"
                tooltip="Lancez une analyse pour regrouper automatiquement vos photos par thème."
              />
            ) : (
              clusters.map((cluster) => (
                <div className="clusterCard" key={cluster.id}>
                  <div className="clusterTop">
                    <div className="clusterTheme">{cluster.theme}</div>
                    <Tooltip text="Voir les photos du cluster" position="top">
                      <button
                        className="mutedSmall cluster-count-clickable"
                        type="button"
                        onClick={() => openClusterModal(cluster)}
                      >
                        {cluster.count} photos
                      </button>
                    </Tooltip>
                  </div>
                  <Carousel 
                    images={cluster.photos.map((p) => p.url)} 
                    onImageClick={(imageUrl) => openPhotoModal({
                      url: imageUrl,
                      name: `Photo du cluster "${cluster.theme}"`,
                      library: "Clustering",
                      tags: [cluster.theme],
                      format: "JPEG"
                    })}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Rating en bas */}
      <div className="fullRow">
        <RatingStars 
          featureName="Clustering"
          onRate={(v) => console.log("rate clustering", v)}
        />
      </div>

      {/* Modal de détails photo */}
      <PhotoModal
        isOpen={isPhotoModalOpen}
        onClose={closePhotoModal}
        photo={selectedPhoto}
        onDelete={handleDeletePhoto}
      />

      <ClusterModal
        isOpen={isClusterModalOpen}
        onClose={closeClusterModal}
        cluster={selectedCluster}
        onDownload={handleDownloadCluster}
        isDownloading={isClusterDownloading}
        onSaveShooting={openSaveModal}
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

      <ToastContainer />
    </div>
  );
}
