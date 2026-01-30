import { useState } from "react";
import RatingStars from "../ui/RatingStars";
import HistoryPanel from "../ui/HistoryPanel";
import useToast from "../hooks/useToast";
import FieldError from "../ui/FieldError";
import Tooltip from "../ui/Tooltip";

export default function LibrariesPage() {
  const { toasts, addToast, ToastContainer } = useToast();
  const [libraries, setLibraries] = useState([
    { id: "lib1", name: "Mariages 2024", desc: "Clients & cérémonies" },
    { id: "lib2", name: "Portraits Studio", desc: "Portraits pro" },
  ]);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState({ name: "", desc: "" });

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

  return (
    <div className="pageGrid">
      {/* Welcome section en fullRow */}
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

          <Tooltip text="Créer une nouvelle bibliothèque" position="top">
            <button className="btn primary" onClick={addLibrary}>
              Créer
            </button>
          </Tooltip>
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
                <div className="libName">{l.name}</div>
                <div className="mutedSmall">{l.desc || "—"}</div>
                <button className="btn">Ouvrir (bientôt)</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rating section en bas */}
      <div className="fullRow">
        <RatingStars 
          featureName="Bibliothèques"
          onRate={(v) => console.log("rate libraries", v)} 
        />
      </div>

      <ToastContainer />
    </div>
  );
}
