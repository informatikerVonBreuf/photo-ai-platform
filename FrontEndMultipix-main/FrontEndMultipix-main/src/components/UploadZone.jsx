import { useState, useCallback } from "react";
import { uploadImages } from "../api/client";

function formatBytes(bytes) {
  if (!bytes) return "0 Mo";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} Mo`;
}


// utilitaire pour récupérer largeur/hauteur d'une image
const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const width = img.width;
      const height = img.height;
      URL.revokeObjectURL(objectUrl);
      resolve({ width, height });
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };

    img.src = objectUrl;
  });
};

function UploadZone() {
  const [shoots, setShoots] = useState([]); // [{ id, name, files: File[] }]
  const [selectedShootId, setSelectedShootId] = useState(null); // destination d'import
  const [openShootId, setOpenShootId] = useState(null); // shooting ouvert dans la modale
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState(null); // index image agrandie
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const [maxWidth, setMaxWidth] = useState("");
  const [maxHeight, setMaxHeight] = useState("");

  // renommage de shooting (dans la modale)
  const [editingShootId, setEditingShootId] = useState(null);
  const [editingName, setEditingName] = useState("");

  // filtrage par type + dimensions + distribution vers le bon shooting
  const handleFiles = useCallback(
    async (fileList) => {
      const arr = Array.from(fileList);
      const images = arr.filter((f) => f.type.startsWith("image/"));

      const numericMaxWidth = Number(maxWidth) || null;
      const numericMaxHeight = Number(maxHeight) || null;

      const accepted = [];

      for (const file of images) {
        if (!numericMaxWidth && !numericMaxHeight) {
          accepted.push(file);
          continue;
        }

        try {
          const { width, height } = await getImageDimensions(file);
          const okWidth = !numericMaxWidth || width <= numericMaxWidth;
          const okHeight = !numericMaxHeight || height <= numericMaxHeight;

          if (okWidth && okHeight) {
            accepted.push(file);
          } else {
            console.warn(
              `Image rejetée (trop grande) : ${file.name} (${width}x${height})`
            );
          }
        } catch (err) {
          console.error("Erreur lecture dimensions image", file.name, err);
        }
      }

      if (accepted.length === 0) return;

      setShoots((prevShoots) => {
        // ajout dans un shooting existant
        if (selectedShootId) {
          return prevShoots.map((shoot) =>
            shoot.id === selectedShootId
              ? { ...shoot, files: [...shoot.files, ...accepted] }
              : shoot
          );
        }

        // création d'un nouveau shooting
        const newId = crypto.randomUUID();
        const index = prevShoots.length + 1;
        const newShoot = {
          id: newId,
          name: `Shooting ${index}`,
          files: accepted,
        };
        return [...prevShoots, newShoot];
      });
    },
    [maxWidth, maxHeight, selectedShootId]
  );

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onInputChange = (e) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  // supprimer une image du shooting actuellement ouvert
  const removeImageAtIndex = (indexToRemove) => {
    setShoots((prevShoots) =>
      prevShoots.map((shoot) => {
        if (shoot.id !== openShootId) return shoot;
        const newFiles = shoot.files.filter((_, idx) => idx !== indexToRemove);
        return { ...shoot, files: newFiles };
      })
    );
  };

  // upload (ex: envoyer toutes les photos de tous les shootings)
  const handleUploadClick = async () => {
    const allFiles = shoots.flatMap((s) => s.files);
    if (!allFiles.length) return;
    const data = await uploadImages(allFiles);
    console.log("Upload terminé:", data);
    console.log("Préparation upload :");
    console.log("Nombre total de photos :", totalFilesCount);
    console.log("Taille totale (bytes) :", totalBytes);
    console.log("Taille totale (formatée) :", totalSizeLabel);

  };

  const openShoot = shoots.find((s) => s.id === openShootId) || null;
  const currentFile =
    selectedIndex !== null && openShoot ? openShoot.files[selectedIndex] : null;
  const currentUrl = currentFile ? URL.createObjectURL(currentFile) : null;

  // gestion renommage (dans la modale)
  const startEditingShoot = (shoot) => {
    setEditingShootId(shoot.id);
    setEditingName(shoot.name);
  };

  const applyShootRename = () => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingShootId(null);
      setEditingName("");
      return;
    }

    setShoots((prevShoots) =>
      prevShoots.map((s) =>
        s.id === editingShootId ? { ...s, name: trimmed } : s
      )
    );
    setEditingShootId(null);
    setEditingName("");
  };

  const totalFilesCount = shoots.reduce(
    (acc, shoot) => acc + shoot.files.length,
    0
  );

  const totalBytes = shoots.reduce(
    (acc, shoot) =>
      acc + shoot.files.reduce((s, f) => s + (f.size || 0), 0),
    0
  );

  const totalSizeLabel = formatBytes(totalBytes);


  return (
    <div id="upload-section">
      <h2>Importer un shooting</h2>

      <div className="upload-summary">
        <span>{totalFilesCount} photo(s) au total</span>
        <span>•</span>
        <span>Taille estimée : {totalSizeLabel}</span>
      </div>


      {/* Filtre par taille */}
      <div className="size-filter">
        <span>Filtrer par taille (px) :</span>
        <label>
          Largeur max :
          <input
            type="number"
            min="0"
            value={maxWidth}
            onChange={(e) => setMaxWidth(e.target.value)}
            placeholder="ex : 4000"
          />
        </label>
        <label>
          Hauteur max :
          <input
            type="number"
            min="0"
            value={maxHeight}
            onChange={(e) => setMaxHeight(e.target.value)}
            placeholder="ex : 3000"
          />
        </label>
      </div>

      {/* Choix du shooting destination */}
      <div className="shoot-target">
        <span>Destination des nouvelles photos :</span>
        <select
          value={selectedShootId || ""}
          onChange={(e) => setSelectedShootId(e.target.value || null)}
        >
          <option value="">-- Nouveau shooting --</option>
          {shoots.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.files.length} photos)
            </option>
          ))}
        </select>
      </div>

      {/* Dropzone fichiers individuels */}
      <div
        className="dropzone"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onClick={() => document.getElementById("file-input").click()}
      >
        Glisse tes photos ici ou clique pour choisir des fichiers
        <input
          id="file-input"
          type="file"
          multiple
          accept="image/*"
          hidden
          onChange={onInputChange}
        />
      </div>

      {/* input pour dossier */}
      <input
        id="folder-input"
        type="file"
        webkitdirectory="true"
        mozdirectory="true"
        multiple
        accept="image/*"
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          handleFiles(files);
        }}
      />

      <button
        type="button"
        onClick={() => document.getElementById("folder-input").click()}
      >
        Importer un dossier d'images
      </button>

      <button onClick={handleUploadClick}>Uploader</button>

      {/* Liste des shootings */}
      <div className="shoots-list">
        {shoots.map((shoot) => (
          <div
            key={shoot.id}
            className="shoot-folder"
            onClick={() => {
              setOpenShootId(shoot.id);
              setIsModalOpen(true);
              setSelectedIndex(0);
            }}
          >
            <div className="folder-icon">📁</div>
            <div className="folder-info">
              <div className="folder-name">{shoot.name}</div>
              <div className="folder-count">
                {shoot.files.length} photos importées
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal shooting (vignettes + suppression + clic pour agrandir + renommage) */}
      {isModalOpen && openShoot && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setIsModalOpen(false);
            setSelectedIndex(null);
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => {
                setIsModalOpen(false);
                setSelectedIndex(null);
              }}
            >
              ✕
            </button>

            {/* Titre renommable */}
            <h3
              onDoubleClick={() => startEditingShoot(openShoot)}
              style={{ cursor: "text" }}
            >
              {editingShootId === openShoot.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={applyShootRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyShootRename();
                    } else if (e.key === "Escape") {
                      setEditingShootId(null);
                      setEditingName("");
                    }
                  }}
                />
              ) : (
                openShoot.name
              )}
            </h3>

            <div className="preview-grid">
              {openShoot.files.map((file, idx) => (
                <div key={idx} className="preview-item">
                  <img
                    className="preview-thumb"
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    onClick={() => {
                      setSelectedIndex(idx);
                      setIsImageModalOpen(true);
                    }}
                  />
                  <button
                    type="button"
                    className="remove-image-btn"
                    onClick={() => removeImageAtIndex(idx)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal image agrandie avec navigation */}
      {isImageModalOpen && currentFile && openShoot && (
        <div
          className="modal-backdrop"
          onClick={() => setIsImageModalOpen(false)}
        >
          <div
            className="modal modal-image"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setIsImageModalOpen(false)}
            >
              ✕
            </button>

            {/* Flèche gauche */}
            <button
              className="nav-arrow left"
              onClick={() => {
                setSelectedIndex((prev) =>
                  prev > 0 ? prev - 1 : openShoot.files.length - 1
                );
              }}
            >
              ‹
            </button>

            {/* Image */}
            <img
              src={currentUrl}
              alt={currentFile.name}
              style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain" }}
            />

            {/* Flèche droite */}
            <button
              className="nav-arrow right"
              onClick={() => {
                setSelectedIndex((prev) =>
                  prev < openShoot.files.length - 1 ? prev + 1 : 0
                );
              }}
            >
              ›
            </button>

            <div style={{ marginTop: "8px", fontSize: "0.9rem" }}>
              {currentFile.name} ({selectedIndex + 1}/{openShoot.files.length})
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadZone;
