import { useState } from "react";
import { MOCK_CLUSTERS, MOCK_LIBRARIES, MOCK_SHOOTINGS, mockRequest } from "../api/mockData";
import useAsyncRunner from "../hooks/useAsyncRunner";
import usePhotoModal from "../hooks/usePhotoModal";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Tooltip from "../ui/Tooltip";
import Carousel from "../ui/Carousel";
import PhotoModal from "../ui/PhotoModal";

export default function ClusteringPage() {
  const [libraryId, setLibraryId] = useState("");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [clusters, setClusters] = useState([]);
  const { loading, error, runAsync } = useAsyncRunner();
  const { selectedPhoto, isPhotoModalOpen, openPhotoModal, closePhotoModal } = usePhotoModal();

  async function run() {
    const data = await runAsync(() => mockRequest(MOCK_CLUSTERS, 800));
    setClusters(data || []);
  }

  function openClusterPhoto(cluster, imageUrl) {
    const photo = cluster.photos.find((item) => item.url === imageUrl);
    if (!photo) return;
    openPhotoModal({
      ...photo,
      name: photo.caption,
      library: "Clustering",
      shooting: cluster.theme,
      tags: [cluster.theme],
      format: "JPEG",
    });
  }

  function handleDeletePhoto(photo) {
    setClusters((prevClusters) =>
      prevClusters
        .map((cluster) => {
          const photos = cluster.photos.filter((item) => item.id !== photo.id && item.url !== photo.url);
          return { ...cluster, photos, count: photos.length };
        })
        .filter((cluster) => cluster.photos.length > 0)
    );
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
            <Tooltip text="Les clusters s'affichent apres le lancement." position="right">
              <div className="cardTitle">Lancer un clustering</div>
            </Tooltip>
          </div>

          <button className="btn primary" disabled={loading} onClick={run}>
            {loading ? "Analyse..." : "Lancer"}
          </button>
        </div>
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique - Clustering" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Clusters</div>
              <div className="cardSub">{clusters.length ? `${clusters.length} cluster(s)` : ""}</div>
            </div>
          </div>

          <div className="clusterGrid">
            {loading ? (
              <div className="loadingBox" style={{ gridColumn: "1 / -1" }}>
                <div className="spinner" />
                <div className="loadingText">Analyse des clusters...</div>
              </div>
            ) : error ? (
              <ErrorState title="Erreur d'analyse" message={error} onRetry={run} />
            ) : clusters.length === 0 ? (
              <EmptyState
                icon="🧩"
                title="Aucun cluster"
                tooltip="Lancez une analyse pour regrouper automatiquement vos photos par theme."
              />
            ) : (
              clusters.map((cluster) => (
                <div className="clusterCard" key={cluster.id}>
                  <div className="clusterTop">
                    <div className="clusterTheme">{cluster.theme}</div>
                    <div className="mutedSmall">{cluster.count} photos</div>
                  </div>
                  <Carousel
                    images={cluster.photos.map((photo) => photo.url)}
                    onImageClick={(imageUrl) => openClusterPhoto(cluster, imageUrl)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="fullRow">
        <RatingStars featureName="Clustering" onRate={(value) => console.log("rate clustering", value)} />
      </div>

      <PhotoModal
        isOpen={isPhotoModalOpen}
        onClose={closePhotoModal}
        photo={selectedPhoto}
        onDelete={handleDeletePhoto}
      />
    </div>
  );
}
