import { useEffect, useRef, useState } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import RatingStars from "../ui/RatingStars";
import HistoryPanel from "../ui/HistoryPanel";
import useToast from "../hooks/useToast";
import FieldError from "../ui/FieldError";
import Tooltip from "../ui/Tooltip";
import Modal from "../ui/Modal";
import PhotoModal from "../ui/PhotoModal";
import { uploadImages } from "../api/client";
import LibraryImageGrid from "../components/LibraryImageGrid";

export default function LibrariesPage() {
  const { addToast, ToastContainer } = useToast();
  const [libraries, setLibraries] = useState([
    { id: "lib1", name: "Mariages 2024", desc: "Clients & cérémonies", images: [] },
    { id: "lib2", name: "Portraits Studio", desc: "Portraits pro", images: [] },
  ]);
  const [albumShootingFilter, setAlbumShootingFilter] = useState("all");

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState({ name: "", desc: "" });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    libraryId: null,
    libraryName: ""
  });
  const [openLibraryModal, setOpenLibraryModal] = useState({
    isOpen: false,
    libraryId: null
  });
  const [photoModal, setPhotoModal] = useState({
    isOpen: false,
    photo: null
  });
  const [openShootingModal, setOpenShootingModal] = useState({
    isOpen: false,
    shooting: null
  });
  const [droppedFiles, setDroppedFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [libraryImages, setLibraryImages] = useState([]);
  const directoryInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const modalImageInputRef = useRef(null);
  const localPreviewUrlsRef = useRef(new Set());

  useEffect(() => {
    const previewUrls = localPreviewUrlsRef.current;
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

  const [mockShootings, setMockShootings] = useState([
    {
      id: "sh1",
      name: "Mariage — Marie & Rochinel",
      album: "Mariages 2024",
      images: [
        { id: "sh1-1", url: "https://picsum.photos/600/400?101", name: "Photo 1" },
        { id: "sh1-2", url: "https://picsum.photos/600/400?102", name: "Photo 2" },
        { id: "sh1-3", url: "https://picsum.photos/600/400?103", name: "Photo 3" },
      ],
    },
    {
      id: "sh2",
      name: "Cérémonie — Église",
      album: "Mariages 2024",
      images: [
        { id: "sh2-1", url: "https://picsum.photos/600/400?104", name: "Photo 1" },
        { id: "sh2-2", url: "https://picsum.photos/600/400?105", name: "Photo 2" },
      ],
    },
    {
      id: "sh3",
      name: "Portrait — Corporate",
      album: "Portraits Studio",
      images: [
        { id: "sh3-1", url: "https://picsum.photos/600/400?106", name: "Photo 1" },
        { id: "sh3-2", url: "https://picsum.photos/600/400?107", name: "Photo 2" },
        { id: "sh3-3", url: "https://picsum.photos/600/400?108", name: "Photo 3" },
        { id: "sh3-4", url: "https://picsum.photos/600/400?109", name: "Photo 4" },
      ],
    },
  ]);

  const IMAGE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "bmp",
    "tiff",
    "heic",
    "avif"
  ]);

  function isImageFile(file) {
    if (!file) return false;
    if (file.type && file.type.startsWith("image/")) return true;
    const parts = file.name.split(".");
    const ext = parts.length > 1 ? parts.pop().toLowerCase() : "";
    return IMAGE_EXTENSIONS.has(ext);
  }

  function createLocalPreview(file) {
    const url = URL.createObjectURL(file);
    localPreviewUrlsRef.current.add(url);
    return {
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      url,
      name: file.name,
      isLocalPreview: true,
    };
  }

  function revokeLocalPreview(image) {
    if (image?.isLocalPreview && image.url) {
      URL.revokeObjectURL(image.url);
      localPreviewUrlsRef.current.delete(image.url);
    }
  }

  function handleFilesReady(files) {
    if (!files || files.length === 0) return;
    setDroppedFiles((prev) => [...prev, ...files]);
    handleUploadFiles(files, { stageOnly: true });
  }

  async function handleUploadFiles(files, { targetLibraryId = null, stageOnly = false } = {}) {
    if (!files || files.length === 0 || isUploading) return;
    setIsUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const response = await uploadImages(files, { libraryId: targetLibraryId || undefined });
      const responseImages = Array.isArray(response?.images) ? response.images : [];
      const normalized = responseImages
        .map((img) => ({
          id: img.id || img.url || img.path || img.src || crypto.randomUUID(),
          url: img.url || img.path || img.src,
          name: img.name || img.filename || "Image",
        }))
        .filter((img) => img.url);

      // Limite mémoire : on stocke uniquement les infos nécessaires à l'affichage.
      const incomingImages = normalized.length ? normalized : files.map(createLocalPreview);

      if (stageOnly) {
        setLibraryImages((prev) => [
          ...incomingImages,
          ...prev,
        ]);
      }

      if (targetLibraryId) {
        setLibraries((prev) =>
          prev.map((lib) =>
            lib.id === targetLibraryId
              ? {
                  ...lib,
                  images: [
                    ...incomingImages,
                    ...(Array.isArray(lib.images) ? lib.images : []),
                  ],
                }
              : lib
          )
        );
      }

      setDroppedFiles([]);
      setUploadSuccess("");
      addToast("Images importées avec succès", "success");
      // TODO: rafraîchir la liste des bibliothèques via l'API quand elle sera branchée
    } catch (err) {
      const msg = err?.message || "Erreur lors de l'import";
      setUploadError(msg);
      addToast(msg, "error");
    } finally {
      setIsUploading(false);
    }
  }

  async function traverseEntry(entry) {
    if (!entry) return [];

    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file) => resolve([file]), () => resolve([]));
      });
    }

    if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = [];

      function readEntries() {
        return new Promise((resolve) => {
          dirReader.readEntries((batch) => {
            if (!batch.length) return resolve();
            entries.push(...batch);
            resolve(readEntries());
          }, () => resolve());
        });
      }

      await readEntries();
      const nested = await Promise.all(entries.map(traverseEntry));
      return nested.flat();
    }

    return [];
  }

  async function getFilesFromDataTransferItems(items) {
    if (!items || items.length === 0) return [];
    const entries = Array.from(items)
      .map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null))
      .filter(Boolean);

    if (!entries.length) return [];
    const filesByEntry = await Promise.all(entries.map(traverseEntry));
    return filesByEntry.flat();
  }

  function handleDragOver(e) {
    if (isUploading) return;
    e.preventDefault();
  }

  function handleDragEnter(e) {
    if (isUploading) return;
    e.preventDefault();
    setIsDragActive(true);
  }

  function handleDragLeave(e) {
    if (isUploading) return;
    e.preventDefault();
    setIsDragActive(false);
  }

  async function handleDrop(e) {
    if (isUploading) return;
    e.preventDefault();
    setIsDragActive(false);
    const dt = e.dataTransfer;
    let files = [];

    if (dt && dt.items && dt.items.length) {
      const fromEntries = await getFilesFromDataTransferItems(dt.items);
      if (fromEntries.length) {
        files = fromEntries;
      } else if (dt.files && dt.files.length) {
        files = Array.from(dt.files);
      }
    } else if (dt && dt.files && dt.files.length) {
      files = Array.from(dt.files);
    }

    const imageFiles = files.filter(isImageFile);
    handleFilesReady(imageFiles);
  }

  function handleDirectorySelect(e) {
    if (isUploading) return;
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(isImageFile);
    handleFilesReady(imageFiles);
    e.target.value = "";
  }

  function handleImageSelect(e) {
    if (isUploading) return;
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(isImageFile);
    handleFilesReady(imageFiles);
    e.target.value = "";
  }

  function handleModalImageSelect(e) {
    if (isUploading) return;
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length && modalLibrary?.id) {
      handleUploadFiles(imageFiles, { targetLibraryId: modalLibrary.id, stageOnly: false });
    }
    e.target.value = "";
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      addLibrary();
    }
  }

  function addLibrary() {
    if (!name.trim()) {
      setErrors({ name: "Le nom est obligatoire", desc: "" });
      return;
    }
    setErrors({ name: "", desc: "" });
    
    try {
      const newLibrary = {
        id: crypto.randomUUID(),
        name,
        desc,
        images: Array.isArray(libraryImages) ? libraryImages : [],
      };
      setLibraries((prev) => [newLibrary, ...prev]);
      setLibraryImages([]);
      setName("");
      setDesc("");
      addToast(`Bibliothèque "${name}" créée avec succès`, "success");
    } catch (err) {
      const msg = err?.message || "Erreur lors de la création de la bibliothèque";
      addToast(msg, "error");
    }
  }

  function openDeleteModal(library) {
    setDeleteModal({
      isOpen: true,
      libraryId: library.id,
      libraryName: library.name
    });
  }

  function closeDeleteModal() {
    setDeleteModal({
      isOpen: false,
      libraryId: null,
      libraryName: ""
    });
  }

  function confirmDelete() {
    setLibraries(libraries.filter(lib => lib.id !== deleteModal.libraryId));
    addToast(`Bibliothèque "${deleteModal.libraryName}" supprimée`, "success");
    closeDeleteModal();
  }

  function openLibrary(library) {
    setOpenLibraryModal({
      isOpen: true,
      libraryId: library.id
    });
    setAlbumShootingFilter("all");
  }

  function closeLibraryModal() {
    setOpenLibraryModal({
      isOpen: false,
      libraryId: null
    });
  }

  function openPhotoDetails(photo) {
    setPhotoModal({
      isOpen: true,
      photo
    });
  }

  function closePhotoDetails() {
    setPhotoModal({
      isOpen: false,
      photo: null
    });
  }

  function handleDeletePhoto(photo) {
    if (!photo) return;

    const photoKey = photo.id || photo.url;
    revokeLocalPreview(photo);

    if (photo.library === "Dépôt d'images") {
      setLibraryImages((prev) => prev.filter((img) => (img.id || img.url) !== photoKey));
    }

    if (photo.library) {
      setLibraries((prev) =>
        prev.map((lib) =>
          lib.name === photo.library
            ? {
                ...lib,
                images: (lib.images || []).filter(
                  (img) => (img.id || img.url) !== photoKey
                ),
              }
            : lib
        )
      );
    }

    setMockShootings((prev) =>
      prev.map((shooting) =>
        !photo.shooting || shooting.name === photo.shooting
          ? {
              ...shooting,
              images: (shooting.images || []).filter(
                (img) => (img.id || img.url) !== photoKey
              ),
            }
          : shooting
      )
    );

    closePhotoDetails();
  }

  function openShooting(shooting) {
    setOpenShootingModal({
      isOpen: true,
      shooting
    });
  }

  function closeShootingModal() {
    setOpenShootingModal({
      isOpen: false,
      shooting: null
    });
  }

  function deleteShooting(shootingId) {
    setMockShootings((prev) => prev.filter((s) => s.id !== shootingId));
    setAlbumShootingFilter((prev) => (prev === shootingId ? "all" : prev));
  }

  const modalLibrary = libraries.find((lib) => lib.id === openLibraryModal.libraryId) || null;
  const modalShootings = mockShootings.filter(
    (shooting) => shooting.album === modalLibrary?.name
  );
  const allShootingImages = modalShootings.flatMap((s) => s.images || []);
  const modalShootingImages =
    albumShootingFilter === "all"
      ? (modalLibrary?.images?.length ? modalLibrary.images : allShootingImages)
      : modalShootings.find((s) => s.id === albumShootingFilter)?.images || [];

  return (
    <div className="pageGrid">
      {/* Welcome section */}
      <div className="fullRow">
        <div className="welcome">
          <Tooltip text="Crée et organise tes albums, shootings et photos" position="right">
            <div className="welcomeTitle">Bibliothèques</div>
          </Tooltip>
        </div>
      </div>

      {/* Left column */}
      <div className="leftCol">
        <div className="card">
          <div className="cardHeader">
            <Tooltip text="Crée un album afin d’y importer les shootings sélectionnés depuis tes recherches." position="right">
              <div className="cardTitle">Créer un album</div>
            </Tooltip>
          </div>

          <label className="field">
            Nom
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder="ex: Mariages 2025" 
              className={errors.name ? "error" : ""} 
            />
            <FieldError message={errors.name} />
          </label>

          <label className="field">
            Description
            <input 
              value={desc} 
              onChange={(e) => setDesc(e.target.value)} 
              onKeyDown={handleKeyDown} 
              placeholder="ex: clients, cérémonies, soirées..." 
            />
          </label>

        </div>

        <div className="card">
          <div className="cardHeader">
            <Tooltip text="Dépose des images ou un dossier complet" position="right">
              <div className="cardTitle"></div>
            </Tooltip>
          </div>

          <div
            className={`library-upload-dropzone ${isDragActive ? "library-upload-dropzone--active" : ""} ${isUploading ? "library-upload-dropzone--disabled" : ""}`}
            onClick={() => !isUploading && imageInputRef.current && imageInputRef.current.click()}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            role="button"
            tabIndex={0}
            aria-disabled={isUploading}
          >
            <div className="library-upload-icon">
              <UploadSimple size={28} />
            </div>
            <div className="library-upload-title">
              {isUploading ? "Import en cours…" : "Déposez vos images ou dossiers ici"}
            </div>
            <div className="library-upload-subtitle">
              {isUploading ? "Merci de patienter" : "ou cliquez pour sélectionner des images"}
            </div>

            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageSelect}
              disabled={isUploading}
              style={{ display: "none" }}
            />

            <input
              ref={directoryInputRef}
              type="file"
              multiple
              directory=""
              webkitdirectory=""
              mozdirectory=""
              onChange={handleDirectorySelect}
              disabled={isUploading}
              style={{ display: "none" }}
            />
          </div>


          {droppedFiles.length > 0 && (
            <div className="mutedSmall" style={{ marginTop: "10px" }}>
              {droppedFiles.length} image(s) prête(s) pour l’upload.
            </div>
          )}

          {uploadError && (
            <div style={{ marginTop: "8px" }}>
              <FieldError message={uploadError} />
            </div>
          )}

          {uploadSuccess && !uploadError && (
            <div className="mutedSmall" style={{ marginTop: "8px", color: "var(--success)" }}>
              {uploadSuccess}
            </div>
          )}
        </div>

      </div>

      {/* Right column */}
      <div className="rightCol">
        <HistoryPanel title="Historique — Bibliothèque" items={[]} />
      </div>

      {/* Mes albums */}
      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardSub">
                {libraryImages.length ? `${libraryImages.length} image(s)` : ""}
              </div>
            </div>
          </div>

          <LibraryImageGrid
            images={libraryImages}
            pageSize={36}
            loading={isUploading}
            resetKey={libraryImages.length || "default"}
            onOpen={(photo) =>
              openPhotoDetails({
                ...photo,
                library: "Dépôt d'images"
              })
            }
          />
        </div>
      </div>

      <div className="fullRow">
        <Tooltip text="Crée ta bibliotèque" position="top">
          <button
            className="btn primary"
            onClick={addLibrary}
            disabled={!name.trim()}
          >
            Créer
          </button>
        </Tooltip>
      </div>

      {/* Mes bibliothèques */}
      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Mes albums</div>
              <div className="cardSub">{libraries.length} album(s)</div>
            </div>
          </div>

          <div className="libGrid">
            {libraries.map((l) => (
              <div className="libCard" key={l.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div className="libName">{l.name}</div>
                  <button 
                    className="libDeleteBtn"
                    onClick={() => openDeleteModal(l)}
                    aria-label="Supprimer la bibliothèque"
                  >
                    ×
                  </button>
                </div>
                <div className="mutedSmall">{l.desc || "—"}</div>
                <button className="btn" onClick={() => openLibrary(l)}>
                  Ouvrir
                </button>
              </div>
            ))}
          </div>

          <div className="dropdownDivider" style={{ margin: "18px 0" }} />

          <div className="cardTitle" style={{ marginBottom: "10px" }}>
            Mes shootings
          </div>

          <div className="historyList">
            {mockShootings.map((shooting) => (
              <div
                className="historyItem"
                key={shooting.id}
                role="button"
                tabIndex={0}
                onClick={() => openShooting(shooting)}
              >
                <span>{shooting.name}</span>
                <span className="mutedSmall" style={{ fontStyle: "italic" }}>
                  {shooting.album ? ` — ${shooting.album}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rating section */}
      <div className="fullRow">
        <RatingStars 
          featureName="Bibliothèques"
          onRate={(v) => console.log("rate libraries", v)} 
        />
      </div>

      <ToastContainer />

      {/* Modal de confirmation de suppression */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        title="Supprimer la bibliothèque ?"
      >
        <p>
          Êtes-vous sûr de vouloir supprimer la bibliothèque <strong>"{deleteModal.libraryName}"</strong> ?
        </p>
        <p style={{ marginTop: "12px", color: "var(--muted)", fontSize: "13px" }}>
          Cette action est irréversible.
        </p>

        <div className="modalActions">
          <button className="btn" onClick={closeDeleteModal}>
            Annuler
          </button>
          <button 
            className="btn primary" 
            onClick={confirmDelete}
            style={{ 
              background: "linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.25))",
              borderColor: "rgba(239, 68, 68, 0.4)"
            }}
          >
            Supprimer
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={openLibraryModal.isOpen}
        onClose={closeLibraryModal}
        title={modalLibrary?.name || "Bibliothèque"}
        contentClassName="modalWide"
      >
        <div style={{ marginBottom: "16px" }}>
          <div
            className={`library-upload-dropzone ${isUploading ? "library-upload-dropzone--disabled" : ""}`}
            onClick={() => !isUploading && modalImageInputRef.current && modalImageInputRef.current.click()}
            role="button"
            tabIndex={0}
            aria-disabled={isUploading}
          >
            <div className="library-upload-icon">
              <UploadSimple size={24} />
            </div>
            <div className="library-upload-title">
              {isUploading ? "Import en cours…" : "Ajouter des images à cette bibliothèque"}
            </div>
            <div className="library-upload-subtitle">
              {isUploading ? "Merci de patienter" : "Cliquez pour sélectionner des images"}
            </div>

            <input
              ref={modalImageInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleModalImageSelect}
              disabled={isUploading}
              style={{ display: "none" }}
            />
          </div>
        </div>
          <div className="albumBadgeRow">
            <button
              type="button"
              className={`albumBadge ${albumShootingFilter === "all" ? "albumBadge--active" : ""}`}
              onClick={() => setAlbumShootingFilter("all")}
            >
              Tout
            </button>
            {modalShootings.map((shooting) => (
              <button
                key={shooting.id}
                type="button"
                className={`albumBadge ${albumShootingFilter === shooting.id ? "albumBadge--active" : ""}`}
                onClick={() => setAlbumShootingFilter(shooting.id)}
              >
                <span className="albumBadgeLabel">{shooting.name}</span>
                <span
                  className="albumBadgeDelete"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteShooting(shooting.id);
                  }}
                >
                  ×
                </span>
              </button>
            ))}
          </div>

        <LibraryImageGrid
            images={modalShootingImages}
          pageSize={48}
          loading={false}
            resetKey={`${modalLibrary?.id || "library-modal"}-${albumShootingFilter}`}
          onOpen={(photo) =>
            openPhotoDetails({
              ...photo,
              shooting:
                albumShootingFilter !== "all"
                  ? modalShootings.find((s) => s.id === albumShootingFilter)?.name
                  : photo.shooting,
              library: modalLibrary?.name || photo.library
            })
          }
        />
      </Modal>

      <PhotoModal
        isOpen={photoModal.isOpen}
        onClose={closePhotoDetails}
        photo={photoModal.photo}
        onDelete={handleDeletePhoto}
      />

      <Modal
        isOpen={openShootingModal.isOpen}
        onClose={closeShootingModal}
        title={openShootingModal.shooting?.name || "Shooting"}
        contentClassName="modalWide"
      >
        <LibraryImageGrid
          images={openShootingModal.shooting?.images || []}
          pageSize={48}
          loading={false}
          resetKey={openShootingModal.shooting?.id || "shooting-modal"}
          onOpen={(photo) =>
            openPhotoDetails({
              ...photo,
              shooting: openShootingModal.shooting?.name,
              library: openShootingModal.shooting?.album,
            })
          }
        />
      </Modal>
    </div>
  );
}
