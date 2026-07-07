import { useMemo, useState } from "react";
import { MOCK_IMAGE_RESULTS, MOCK_LIBRARIES, MOCK_SHOOTINGS, mockRequest } from "../api/mockData";
import useAsyncRunner from "../hooks/useAsyncRunner";
import usePhotoModal from "../hooks/usePhotoModal";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import Tooltip from "../ui/Tooltip";
import ResultsGallery from "../ui/ResultsGallery";
import PhotoModal from "../ui/PhotoModal";

export default function ImageSearchPage() {
  const [libraryId, setLibraryId] = useState("");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [refFiles, setRefFiles] = useState([]);
  const [logic, setLogic] = useState("intersection");
  const [results, setResults] = useState([]);
  const { loading, error, runAsync } = useAsyncRunner();
  const { selectedPhoto, isPhotoModalOpen, openPhotoModal, closePhotoModal } = usePhotoModal();

  const canRun = useMemo(() => Boolean(libraryId) && refFiles.length > 0, [libraryId, refFiles]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && canRun && !loading) {
      run();
    }
  }

  async function run() {
    if (!canRun) return;
    const data = await runAsync(() => mockRequest(MOCK_IMAGE_RESULTS, 600));
    setResults(data || []);
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
            <Tooltip text="Choisis une ou plusieurs images de reference." position="right">
              <div className="cardTitle">Images de reference</div>
            </Tooltip>
          </div>

          <label className="field italic">
            Importer depuis ton PC
            <input
              className="fileInput"
              type="file"
              accept="image/*"
              multiple
              onKeyDown={handleKeyDown}
              onChange={(e) => setRefFiles(Array.from(e.target.files || []))}
            />
          </label>

          <div className="toggleRow">
            <div className="toggleLabel">
              Logique
              <Tooltip
                text="Intersection: toutes les references. Union: au moins une reference."
                position="top"
              >
                <span className="infoIcon">i</span>
              </Tooltip>
            </div>
            <div className="toggle">
              <button
                type="button"
                className={`toggleBtn ${logic === "intersection" ? "on" : ""}`}
                onClick={() => setLogic("intersection")}
              >
                Intersection
              </button>
              <button
                type="button"
                className={`toggleBtn ${logic === "union" ? "on" : ""}`}
                onClick={() => setLogic("union")}
              >
                Union
              </button>
            </div>
          </div>

          <button className="btn primary" disabled={!canRun || loading} onClick={run}>
            {loading ? "Recherche..." : "Lancer la recherche"}
          </button>
        </div>
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique - Recherche image" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Resultats</div>
              <div className="cardSub">{results.length ? `${results.length} photo(s)` : ""}</div>
            </div>
            <button className="btn" disabled={!results.length}>
              Telecharger bientot
            </button>
          </div>

          <ResultsGallery
            loading={loading}
            error={error}
            results={results}
            onRetry={run}
            onOpen={openPhotoModal}
            emptyTitle="Aucun resultat"
            emptyTooltip="Essayez avec d'autres images ou ajustez votre selection de bibliotheque."
          />
        </div>
      </div>

      <div className="fullRow">
        <RatingStars featureName="Recherche image" onRate={(value) => console.log("rate image search", value)} />
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
