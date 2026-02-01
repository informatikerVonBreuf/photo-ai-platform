import { useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import SkeletonCard from "../ui/SkeletonCard";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Tooltip from "../ui/Tooltip";
import PhotoModal from "../ui/PhotoModal";
import Dropdown from "../components/Dropdown";
import DateTimePicker from "../components/DateTimePicker";
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

export default function FiltersPage() {
  const [libraryId, setLibraryId] = useState("");
  const [selectedShootings, setSelectedShootings] = useState([]);

  const [tags, setTags] = useState([]);
  const [tagDraft, setTagDraft] = useState("");

  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [orientation, setOrientation] = useState("any");
  const [maxW, setMaxW] = useState("");
  const [maxH, setMaxH] = useState("");

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  function addTag() {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagDraft("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  async function run() {
    // TODO: appeler /filters avec scope + filtres
    setLoading(true);
    setError(null);

    try {
      // Simulation d'erreur aléatoire (1 chance sur 3)
      if (Math.random() < 0.33) {
        throw new Error("Erreur de connexion au serveur");
      }

      await new Promise((r) => setTimeout(r, 600));
      setResults([
        { id: "p1", url: "https://picsum.photos/600/400?20", caption: "Filtré", score: 1 },
      ]);
    } catch (err) {
      setError(err.message || "Erreur inconnue");
      setResults([]);
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
    
    // Mettre à jour l'état local en retirant la photo des résultats
    setResults((prevResults) => 
      prevResults.filter((p) => p.id !== photo.id)
    );
    
    console.log("Photo supprimée avec succès");
  }

  return (
    <div className="pageGrid">
      <div className="fullRow">
                    <div className="welcome">
                      <Tooltip text="Filtre les photos sur ta bibliotèque et/ou de ses shootings" position="right">
                        <div className="welcomeTitle">Filtres</div>
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
              <Tooltip text="Ajoute des tags pour affiner." position="right">
              <div className="cardTitle">Tags</div>
              </Tooltip>
            </div>
          </div>

          <div className="tagAddRow">
            <div className="tagAddControls">
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="ex: portrait, mariage..."
                onKeyDown={handleKeyDown}
              />
              <button className="btn tagAddBtn" onClick={addTag}>Ajouter</button>
            </div>
            <div className="chipBox">
              {tags.map((t) => (
                <span className="chip on" key={t}>
                  {t}
                  <button className="chipX" onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <div>
              <Tooltip text="Dates, orientations, dimensions" position="right">
              <div className="cardTitle">Filtres</div>
              </Tooltip>
            </div>
          </div>

          <div className="grid2">
            <label className="field">
              Du
              <DateTimePicker
                value={from}
                onChange={(date) => setFrom(date)}
                placeholder="Sélectionner une date"
              />
            </label>
            <label className="field">
              Au
              <DateTimePicker
                value={to}
                onChange={(date) => setTo(date)}
                placeholder="Sélectionner une date"
              />
            </label>

            <div className="field">
              <div className="fieldLabel">Orientation</div>
              <Dropdown
                label="Toutes"
                items={[
                  { value: "any", label: "Toutes" },
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Paysage" },
                  { value: "square", label: "Carrée" },
                ]}
                onSelect={(item) => setOrientation(item.value)}
              />
            </div>

            <label className="field">Largeur max (px) <input value={maxW} onChange={(e) => setMaxW(e.target.value)} placeholder="ex: 4000" /></label>
            <label className="field">Hauteur max (px) <input value={maxH} onChange={(e) => setMaxH(e.target.value)} placeholder="ex: 3000" /></label>
          </div>

          <button className="btn primary" onClick={run}>Appliquer</button>
        </div>
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique — Filtres" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Résultats</div>
              <div className="cardSub">{results.length ? `${results.length} photo(s)` : ""}</div>
            </div>
          </div>

          <div className="gallery">
            {loading ? (
              <SkeletonCard count={8} />
            ) : error ? (
              <ErrorState title="Erreur de recherche" message={error} onRetry={run} />
            ) : results.length === 0 ? (
              <EmptyState
                icon="🎛️"
                title="Aucun résultat"
                tooltip="Ajustez vos filtres pour affiner votre recherche."
              />
            ) : (
              results.map((r) => (
                <div 
                  className="tile" 
                  key={r.id}
                  onClick={() => openPhotoModal(r)}
                >
                  <div className="tileImg"><img src={r.url} alt={r.caption} /></div>
                  <div className="tileMeta">
                    <div className="tileCap">{r.caption}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Rating en bas */}
      <div className="fullRow">
        <RatingStars 
          featureName="Filtres"
          onRate={(v) => console.log("rate filters", v)}
        />
      </div>

      {/* Modal de détails photo */}
      <PhotoModal
        isOpen={isPhotoModalOpen}
        onClose={closePhotoModal}
        photo={selectedPhoto}
        onDelete={handleDeletePhoto}
      />
    </div>
  );
}
