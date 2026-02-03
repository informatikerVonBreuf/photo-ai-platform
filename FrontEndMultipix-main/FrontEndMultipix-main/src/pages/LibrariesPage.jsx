import { useState } from "react";
import RatingStars from "../ui/RatingStars";
import HistoryPanel from "../ui/HistoryPanel";
import useToast from "../hooks/useToast";
import FieldError from "../ui/FieldError";
import Tooltip from "../ui/Tooltip";
import Modal from "../ui/Modal";

export default function LibrariesPage() {
  const { toasts, addToast, ToastContainer } = useToast();
  const [libraries, setLibraries] = useState([
    { id: "lib1", name: "Mariages 2024", desc: "Clients & cérémonies" },
    { id: "lib2", name: "Portraits Studio", desc: "Portraits pro" },
  ]);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState({ name: "", desc: "" });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    libraryId: null,
    libraryName: ""
  });

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
      setLibraries([{ id: crypto.randomUUID(), name, desc }, ...libraries]);
      setName("");
      setDesc("");
      addToast(`Bibliothèque "${name}" créée avec succès`, "success");
    } catch (err) {
      addToast("Erreur lors de la création de la bibliothèque", "error");
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

  return (
    <div className="pageGrid">
      {/* Welcome section */}
      <div className="fullRow">
        <div className="welcome">
          <Tooltip text="Crée et organise les bibliothèques, shootings et photos" position="right">
            <div className="welcomeTitle">Bibliothèques</div>
          </Tooltip>
        </div>
      </div>

      {/* Left column */}
      <div className="leftCol">
        <div className="card">
          <div className="cardHeader">
            <Tooltip text="Organise tes shootings par bibliothèque(s)" position="right">
              <div className="cardTitle">Créer une bibliothèque</div>
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

          <button className="btn primary" onClick={addLibrary}>
            Créer
          </button>
        </div>
      </div>

      {/* Right column */}
      <div className="rightCol">
        <HistoryPanel title="Historique — Bibliothèques" items={[]} />
      </div>

      {/* Mes bibliothèques */}
      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Mes bibliothèques</div>
              <div className="cardSub">{libraries.length} bibliothèque(s)</div>
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
                <button className="btn">Ouvrir (bientôt)</button>
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
    </div>
  );
}
