import Modal from "./Modal";
import { DownloadSimple } from "@phosphor-icons/react";

export default function ClusterModal({
  isOpen,
  onClose,
  cluster,
  onDownload,
  isDownloading,
}) {
  if (!cluster) return null;

  const photos = cluster.photos || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cluster ${cluster.theme ? `— ${cluster.theme}` : ""}`}
      contentClassName="clusterModalContentWrapper cluster-modal"
      bodyClassName="clusterModalBody cluster-modal-body"
      overlayClassName="cluster-modal-overlay"
    >
      <div className="clusterModalContent">
        <div className="clusterModalTop">
          <div className="clusterModalCount">
            {cluster.count || photos.length} image{(cluster.count || photos.length) > 1 ? "s" : ""}
          </div>
          <button
            className="btn primary clusterDownloadBtn"
            type="button"
            onClick={onDownload}
            disabled={isDownloading || photos.length === 0}
          >
            <DownloadSimple size={18} />
            {isDownloading ? "Préparation..." : "Télécharger ce cluster"}
          </button>
        </div>

        <div className="clusterModalGrid cluster-modal-grid">
          {photos.map((photo) => (
            <div key={photo.id || photo.url} className="clusterModalTile cluster-modal-tile">
              <img src={photo.url} alt={photo.caption || photo.id || "photo"} loading="lazy" />
              {photo.caption ? (
                <div className="clusterModalCaption">{photo.caption}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
