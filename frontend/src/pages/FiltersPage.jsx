import { useState } from "react";
import { MOCK_FILTER_RESULTS, MOCK_LIBRARIES, MOCK_SHOOTINGS, mockRequest } from "../api/mockData";
import useAsyncRunner from "../hooks/useAsyncRunner";
import usePhotoModal from "../hooks/usePhotoModal";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import Tooltip from "../ui/Tooltip";
import ResultsGallery from "../ui/ResultsGallery";
import PhotoModal from "../ui/PhotoModal";
import Dropdown from "../components/Dropdown";
import DateTimePicker from "../components/DateTimePicker";

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
  const { loading, error, runAsync } = useAsyncRunner();
  const { selectedPhoto, isPhotoModalOpen, openPhotoModal, closePhotoModal } = usePhotoModal();

  function addTag() {
    const tag = tagDraft.trim();
    if (!tag || tags.includes(tag)) return;
    setTags((currentTags) => [...currentTags, tag]);
    setTagDraft("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  async function run() {
    const requestPayload = {
      libraryId,
      selectedShootings,
      tags,
      from,
      to,
      orientation,
      maxW,
      maxH,
    };
    const data = await runAsync(() => mockRequest({ requestPayload, results: MOCK_FILTER_RESULTS }, 600));
    setResults(data?.results || []);
  }

  function handleDeletePhoto(photo) {
    setResults((prevResults) => prevResults.filter((item) => item.id !== photo.id));
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
            <Tooltip text="Ajoute des tags pour affiner." position="right">
              <div className="cardTitle">Tags</div>
            </Tooltip>
          </div>

          <div className="tagAddRow">
            <div className="tagAddControls">
              <input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                placeholder="ex: portrait, mariage..."
                onKeyDown={handleKeyDown}
              />
              <button className="btn tagAddBtn" onClick={addTag}>
                Ajouter
              </button>
            </div>
            <div className="chipBox">
              {tags.map((tag) => (
                <span className="chip on" key={tag}>
                  {tag}
                  <button className="chipX" onClick={() => setTags(tags.filter((item) => item !== tag))}>
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="cardHeader">
            <Tooltip text="Dates, orientations, dimensions" position="right">
              <div className="cardTitle">Filtres</div>
            </Tooltip>
          </div>

          <div className="grid2">
            <label className="field">
              Du
              <DateTimePicker value={from} onChange={setFrom} placeholder="Selectionner une date" />
            </label>
            <label className="field">
              Au
              <DateTimePicker value={to} onChange={setTo} placeholder="Selectionner une date" />
            </label>

            <div className="field">
              <div className="fieldLabel">Orientation</div>
              <Dropdown
                label="Toutes"
                items={[
                  { value: "any", label: "Toutes" },
                  { value: "portrait", label: "Portrait" },
                  { value: "landscape", label: "Paysage" },
                  { value: "square", label: "Carree" },
                ]}
                onSelect={(item) => setOrientation(item.value)}
              />
            </div>

            <label className="field">
              Largeur max (px)
              <input value={maxW} onChange={(e) => setMaxW(e.target.value)} placeholder="ex: 4000" />
            </label>
            <label className="field">
              Hauteur max (px)
              <input value={maxH} onChange={(e) => setMaxH(e.target.value)} placeholder="ex: 3000" />
            </label>
          </div>

          <button className="btn primary" disabled={loading} onClick={run}>
            {loading ? "Application..." : "Appliquer"}
          </button>
        </div>
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique - Filtres" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Resultats</div>
              <div className="cardSub">{results.length ? `${results.length} photo(s)` : ""}</div>
            </div>
          </div>

          <ResultsGallery
            loading={loading}
            error={error}
            results={results}
            onRetry={run}
            onOpen={openPhotoModal}
            emptyTitle="Aucun resultat"
            emptyTooltip="Ajustez vos filtres pour affiner votre recherche."
            showScore={false}
          />
        </div>
      </div>

      <div className="fullRow">
        <RatingStars featureName="Filtres" onRate={(value) => console.log("rate filters", value)} />
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
