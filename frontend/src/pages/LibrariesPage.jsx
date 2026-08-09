import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Trash, UploadSimple } from "@phosphor-icons/react";
import RatingStars from "../ui/RatingStars";
import HistoryPanel from "../ui/HistoryPanel";
import useToast from "../hooks/useToast";
import FieldError from "../ui/FieldError";
import Tooltip from "../ui/Tooltip";
import Modal from "../ui/Modal";
import PhotoModal from "../ui/PhotoModal";
import {
  assignPhotosToLibrary,
  clearLibraryPhotos,
  clearUnassignedPhotos,
  createLibrary,
  deleteLibrary,
  deletePhoto as deletePhotoApi,
  deleteShooting as deleteShootingApi,
  getIndexStatus,
  listLibraries,
  listPhotos,
  listShootings,
  uploadImages,
} from "../api/client";
import LibraryImageGrid from "../components/LibraryImageGrid";

export default function LibrariesPage() {
  const { addToast, ToastContainer } = useToast();
  const [libraries, setLibraries] = useState([]);
  const [shootings, setShootings] = useState([]);
  const [unassignedPhotos, setUnassignedPhotos] = useState([]);
  const [indexStatus, setIndexStatus] = useState(null);
  const [albumShootingFilter, setAlbumShootingFilter] = useState("all");

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState({ name: "", desc: "" });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    libraryId: null,
    libraryName: ""
  });
  const [clearPhotosModal, setClearPhotosModal] = useState({
    isOpen: false,
    scope: null,
    libraryId: null,
    label: "",
    count: 0,
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
  const [uploadTargetId, setUploadTargetId] = useState("");
  const [assignmentTargetId, setAssignmentTargetId] = useState("");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const directoryInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const modalImageInputRef = useRef(null);

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

  const refreshData = useCallback(async () => {
    const [libraryResponse, shootingResponse, photoResponse, statusResponse] =
      await Promise.all([
        listLibraries(),
        listShootings(),
        listPhotos({ limit: 1000 }),
        getIndexStatus(),
      ]);
    const photos = photoResponse.photos || [];
    const rawLibraries = libraryResponse.libraries || [];
    const libraryNames = new Map(rawLibraries.map((library) => [library.id, library.name]));
    setLibraries(
      rawLibraries.map((library) => ({
        ...library,
        desc: library.description,
        images: photos.filter((photo) => photo.library_id === library.id),
      }))
    );
    setShootings(
      (shootingResponse.shootings || []).map((shooting) => ({
        ...shooting,
        album: libraryNames.get(shooting.library_id) || "",
        images: photos.filter((photo) => photo.shooting_id === shooting.id),
      }))
    );
    setUnassignedPhotos(photos.filter((photo) => !photo.library_id));
    setIndexStatus(statusResponse);
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshData().catch((err) => {
      if (!cancelled) {
        const message = err?.message || "Impossible de charger les bibliothèques";
        setUploadError(message);
        addToast(message, "error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [addToast, refreshData]);

  async function handleUploadFiles(files, { targetLibraryId = null } = {}) {
    if (!files || files.length === 0 || isUploading) return;
    setIsUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const response = await uploadImages(files, { libraryId: targetLibraryId || undefined });
      await refreshData();
      const queued = (response?.images || []).filter(
        (image) => image.status !== "INDEXED"
      ).length;
      setUploadSuccess(
        queued
          ? `${queued} image(s) en cours d'indexation`
          : "Toutes les images sont indexées"
      );
      addToast("Images enregistrées et envoyées à l'indexeur", "success");
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
    await handleUploadFiles(imageFiles, {
      targetLibraryId: uploadTargetId || null,
    });
  }

  async function handleDirectorySelect(e) {
    if (isUploading) return;
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(isImageFile);
    await handleUploadFiles(imageFiles, {
      targetLibraryId: uploadTargetId || null,
    });
    e.target.value = "";
  }

  async function handleImageSelect(e) {
    if (isUploading) return;
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(isImageFile);
    await handleUploadFiles(imageFiles, {
      targetLibraryId: uploadTargetId || null,
    });
    e.target.value = "";
  }

  function handleModalImageSelect(e) {
    if (isUploading) return;
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(isImageFile);
    if (imageFiles.length && modalLibrary?.id) {
      handleUploadFiles(imageFiles, { targetLibraryId: modalLibrary.id });
    }
    e.target.value = "";
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      addLibrary();
    }
  }

  async function addLibrary() {
    if (!name.trim()) {
      setErrors({ name: "Le nom est obligatoire", desc: "" });
      return;
    }
    setErrors({ name: "", desc: "" });
    setIsUploading(true);
    setUploadError("");

    try {
      const newLibrary = await createLibrary({
        name: name.trim(),
        description: desc.trim(),
      });
      setName("");
      setDesc("");
      setUploadTargetId(newLibrary.id);
      setAssignmentTargetId(newLibrary.id);
      await refreshData();
      addToast(`Bibliothèque "${name}" créée avec succès`, "success");
    } catch (err) {
      const msg = err?.message || "Erreur lors de la création de la bibliothèque";
      setUploadError(msg);
      addToast(msg, "error");
    } finally {
      setIsUploading(false);
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

  async function confirmDelete() {
    try {
      await deleteLibrary(deleteModal.libraryId);
      await refreshData();
      addToast(`Bibliothèque "${deleteModal.libraryName}" supprimée`, "success");
      closeDeleteModal();
    } catch (err) {
      addToast(err?.message || "Suppression impossible", "error");
    }
  }

  function openClearPhotosModal({
    scope,
    libraryId = null,
    label,
    count,
  }) {
    setClearPhotosModal({
      isOpen: true,
      scope,
      libraryId,
      label,
      count,
    });
  }

  function closeClearPhotosModal() {
    setClearPhotosModal({
      isOpen: false,
      scope: null,
      libraryId: null,
      label: "",
      count: 0,
    });
  }

  async function confirmClearPhotos() {
    if (isUploading) return;
    setIsUploading(true);
    try {
      const response =
        clearPhotosModal.scope === "unassigned"
          ? await clearUnassignedPhotos()
          : await clearLibraryPhotos(clearPhotosModal.libraryId);
      setSelectedPhotoIds([]);
      await refreshData();
      if (openLibraryModal.libraryId === clearPhotosModal.libraryId) {
        closeLibraryModal();
      }
      addToast(`${response.deleted} photo(s) supprimée(s) définitivement`, "success");
      closeClearPhotosModal();
    } catch (err) {
      addToast(err?.message || "Suppression des photos impossible", "error");
    } finally {
      setIsUploading(false);
    }
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

  async function deletePhoto(photo) {
    if (!photo?.id || isUploading) return;
    setIsUploading(true);
    try {
      await deletePhotoApi(photo.id);
      setSelectedPhotoIds((current) =>
        current.filter((photoId) => photoId !== String(photo.id))
      );
      await refreshData();
      addToast("Photo supprimée définitivement", "success");
      closePhotoDetails();
    } catch (err) {
      addToast(err?.message || "Suppression de la photo impossible", "error");
      throw err;
    } finally {
      setIsUploading(false);
    }
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

  async function deleteShooting(shootingId) {
    try {
      await deleteShootingApi(shootingId);
      await refreshData();
      setAlbumShootingFilter((prev) => (prev === shootingId ? "all" : prev));
    } catch (err) {
      addToast(err?.message || "Suppression du shooting impossible", "error");
    }
  }

  function togglePhotoSelection(photoId) {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId]
    );
  }

  async function assignSelectedPhotos() {
    if (!assignmentTargetId || selectedPhotoIds.length === 0 || isUploading) {
      return;
    }
    setIsUploading(true);
    setUploadError("");
    setUploadSuccess("");
    try {
      await assignPhotosToLibrary(selectedPhotoIds, assignmentTargetId);
      const count = selectedPhotoIds.length;
      setSelectedPhotoIds([]);
      await refreshData();
      setUploadSuccess(`${count} image(s) ajoutée(s) à l'album`);
      addToast("Photos affectées et réindexation lancée", "success");
    } catch (err) {
      const message = err?.message || "Affectation des photos impossible";
      setUploadError(message);
      addToast(message, "error");
    } finally {
      setIsUploading(false);
    }
  }

  const modalLibrary = libraries.find((lib) => lib.id === openLibraryModal.libraryId) || null;
  const modalShootings = shootings.filter(
    (shooting) => shooting.library_id === modalLibrary?.id
  );
  const allShootingImages = modalShootings.flatMap((s) => s.images || []);
  const modalShootingImages =
    albumShootingFilter === "all"
      ? (modalLibrary?.images?.length ? modalLibrary.images : allShootingImages)
      : modalShootings.find((s) => s.id === albumShootingFilter)?.images || [];
  const depositImages = unassignedPhotos;

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

          <button
            className="btn primary"
            onClick={addLibrary}
            disabled={!name.trim() || isUploading}
          >
            Créer l'album
          </button>
        </div>

        <div className="card">
          <div className="cardHeader">
            <Tooltip text="Dépose des images ou un dossier complet" position="right">
              <div className="cardTitle">Importer des photos</div>
            </Tooltip>
          </div>

          <label className="field">
            Destination
            <select
              value={uploadTargetId}
              onChange={(event) => setUploadTargetId(event.target.value)}
              disabled={isUploading}
            >
              <option value="">Dépôt non classé</option>
              {libraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.name}
                </option>
              ))}
            </select>
          </label>

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
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                imageInputRef.current?.click();
              }
            }}
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

          <div className="library-upload-actions">
            <button
              type="button"
              className="btn"
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploading}
            >
              <UploadSimple size={18} />
              Images
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => directoryInputRef.current?.click()}
              disabled={isUploading}
            >
              <FolderOpen size={18} />
              Dossier
            </button>
          </div>

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
              <div className="cardTitle">Dépôt non classé</div>
              <div className="cardSub">
                {depositImages.length ? `${depositImages.length} image(s)` : ""}
              </div>
            </div>
            {indexStatus && (
              <div className="cardSub">
                {indexStatus.searchable} indexée(s)
                {indexStatus.pending ? ` · ${indexStatus.pending} en attente` : ""}
                {indexStatus.failed ? ` · ${indexStatus.failed} en échec` : ""}
              </div>
            )}
            {depositImages.length > 0 ? (
              <button
                type="button"
                className="btn btnDanger"
                onClick={() =>
                  openClearPhotosModal({
                    scope: "unassigned",
                    label: "le dépôt non classé",
                    count: depositImages.length,
                  })
                }
                disabled={isUploading}
              >
                <Trash size={18} />
                Vider le dépôt
              </button>
            ) : null}
          </div>

          {depositImages.length > 0 && libraries.length > 0 ? (
            <div className="library-assignment-bar">
              <span className="mutedSmall">
                {selectedPhotoIds.length} sélectionnée(s)
              </span>
              <select
                value={assignmentTargetId}
                onChange={(event) => setAssignmentTargetId(event.target.value)}
                disabled={isUploading}
                aria-label="Album de destination"
              >
                <option value="">Choisir un album</option>
                {libraries.map((library) => (
                  <option key={library.id} value={library.id}>
                    {library.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn primary"
                disabled={
                  !assignmentTargetId ||
                  selectedPhotoIds.length === 0 ||
                  isUploading
                }
                onClick={assignSelectedPhotos}
              >
                Ajouter à l'album
              </button>
            </div>
          ) : null}

          <LibraryImageGrid
            images={depositImages}
            pageSize={36}
            loading={isUploading}
            resetKey={depositImages.length || "default"}
            selectedIds={selectedPhotoIds}
            onToggleSelection={togglePhotoSelection}
            onOpen={(photo) =>
              openPhotoDetails({
                ...photo,
                library: "Dépôt d'images"
              })
            }
          />
        </div>
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
                <div className="mutedSmall">{l.photo_count || 0} image(s)</div>
                <div className="libCardActions">
                  <button className="btn" onClick={() => openLibrary(l)}>
                    Ouvrir
                  </button>
                  {l.photo_count > 0 ? (
                    <button
                      type="button"
                      className="btn btnDanger"
                      onClick={() =>
                        openClearPhotosModal({
                          scope: "library",
                          libraryId: l.id,
                          label: `l'album "${l.name}"`,
                          count: l.photo_count,
                        })
                      }
                    >
                      <Trash size={17} />
                      Vider
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="dropdownDivider" style={{ margin: "18px 0" }} />

          <div className="cardTitle" style={{ marginBottom: "10px" }}>
            Mes shootings
          </div>

          <div className="historyList">
            {shootings.map((shooting) => (
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
        isOpen={clearPhotosModal.isOpen}
        onClose={closeClearPhotosModal}
        title="Supprimer les photos ?"
      >
        <p>
          Les {clearPhotosModal.count} photo(s) de {clearPhotosModal.label} seront
          supprimées du stockage, de la base et de l'index de recherche.
        </p>
        <p className="mutedSmall">Cette action est irréversible.</p>
        <div className="modalActions">
          <button className="btn" onClick={closeClearPhotosModal}>
            Annuler
          </button>
          <button
            className="btn btnDanger"
            onClick={confirmClearPhotos}
            disabled={isUploading}
          >
            <Trash size={18} />
            Supprimer les photos
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
        onDelete={deletePhoto}
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
