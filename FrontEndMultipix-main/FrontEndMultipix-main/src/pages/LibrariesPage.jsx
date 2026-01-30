import { useState } from "react";
import RatingStars from "../ui/RatingStars";
import HistoryPanel from "../ui/HistoryPanel";
import useToast from "../hooks/useToast";
import FieldError from "../ui/FieldError";

export default function LibrariesPage() {
  const { toasts, addToast, ToastContainer } = useToast();
  const [libraries, setLibraries] = useState([
    { id: "lib1", name: "Mariages 2024", desc: "Clients & cérémonies" },
    { id: "lib2", name: "Portraits Studio", desc: "Portraits pro" },
  ]);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [errors, setErrors] = useState({ name: "", desc: "" });

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
      <div className="leftCol">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Créer une library</div>
              <div className="cardSub">Organise tes shootings par library.</div>
            </div>
          </div>

          <label className="field">
            Nom
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Mariages 2025" className={errors.name ? "error" : ""} />
            <FieldError message={errors.name} />
          </label>
          <label className="field">
            Description
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="ex: clients, cérémonies, soirées..." />
          </label>

          <button className="btn primary" onClick={addLibrary}>Créer</button>
        </div>

        <RatingStars label="Appréciation — Bibliothèques" onRate={(v) => console.log("rate libraries", v)} />
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique — Bibliothèques" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Mes libraries</div>
              <div className="cardSub">{libraries.length} library(s)</div>
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
      <ToastContainer />
    </div>
  );
}
