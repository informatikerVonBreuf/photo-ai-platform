import { useState } from "react";
import { MOCK_LIBRARIES } from "../api/mockData";
import RatingStars from "../ui/RatingStars";
import HistoryPanel from "../ui/HistoryPanel";
import useToast from "../hooks/useToast";
import FieldError from "../ui/FieldError";
import Tooltip from "../ui/Tooltip";
import Modal from "../ui/Modal";

export default function LibrariesPage() {
  const { addToast, ToastContainer } = useToast();
  const [libraries, setLibraries] = useState(() => MOCK_LIBRARIES.map((library) => ({ ...library })));
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState({ name: "", desc: "" });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    libraryId: null,
    libraryName: "",
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
      const libraryName = name.trim();
      setLibraries((currentLibraries) => [
        { id: crypto.randomUUID(), name: libraryName, desc: desc.trim() },
        ...currentLibraries,
      ]);
      setName("");
      setDesc("");
      addToast(`Bibliotheque "${libraryName}" creee avec succes`, "success");
    } catch {
      addToast("Erreur lors de la creation de la bibliotheque", "error");
    }
  }

  function openDeleteModal(library) {
    setDeleteModal({
      isOpen: true,
      libraryId: library.id,
      libraryName: library.name,
    });
  }

  function closeDeleteModal() {
    setDeleteModal({
      isOpen: false,
      libraryId: null,
      libraryName: "",
    });
  }

  function confirmDelete() {
    setLibraries((currentLibraries) => currentLibraries.filter((library) => library.id !== deleteModal.libraryId));
    addToast(`Bibliotheque "${deleteModal.libraryName}" supprimee`, "success");
    closeDeleteModal();
  }

  return (
    <div className="pageGrid">
      <div className="leftCol">
        <div className="card">
          <div className="cardHeader">
            <Tooltip text="Organise tes shootings par bibliotheque." position="right">
              <div className="cardTitle">Creer une bibliotheque</div>
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
              placeholder="ex: clients, ceremonies, soirees..."
            />
          </label>

          <button className="btn primary" onClick={addLibrary}>
            Creer
          </button>
        </div>
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique - Bibliotheques" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Mes bibliotheques</div>
              <div className="cardSub">{libraries.length} bibliotheque(s)</div>
            </div>
          </div>

          <div className="libGrid">
            {libraries.map((library) => (
              <div className="libCard" key={library.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "8px",
                  }}
                >
                  <div className="libName">{library.name}</div>
                  <button
                    className="libDeleteBtn"
                    onClick={() => openDeleteModal(library)}
                    aria-label="Supprimer la bibliotheque"
                  >
                    x
                  </button>
                </div>
                <div className="mutedSmall">{library.desc || "-"}</div>
                <button className="btn">Ouvrir bientot</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="fullRow">
        <RatingStars featureName="Bibliotheques" onRate={(value) => console.log("rate libraries", value)} />
      </div>

      <ToastContainer />

      <Modal isOpen={deleteModal.isOpen} onClose={closeDeleteModal} title="Supprimer la bibliotheque ?">
        <p>
          Es-tu sur de vouloir supprimer la bibliotheque <strong>"{deleteModal.libraryName}"</strong> ?
        </p>
        <p style={{ marginTop: "12px", color: "var(--muted)", fontSize: "13px" }}>
          Cette action est irreversible.
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
              borderColor: "rgba(239, 68, 68, 0.4)",
            }}
          >
            Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}
