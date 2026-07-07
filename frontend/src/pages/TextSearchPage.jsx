import { useMemo, useState } from "react";
import { MOCK_LIBRARIES, MOCK_SHOOTINGS, MOCK_TEXT_RESULTS, mockRequest } from "../api/mockData";
import useAsyncRunner from "../hooks/useAsyncRunner";
import usePhotoModal from "../hooks/usePhotoModal";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import ResultsGallery from "../ui/ResultsGallery";
import PhotoModal from "../ui/PhotoModal";

export default function TextSearchPage() {
  const [libraryId, setLibraryId] = useState("");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const { loading, error, runAsync } = useAsyncRunner();
  const { selectedPhoto, isPhotoModalOpen, openPhotoModal, closePhotoModal } = usePhotoModal();

  const canRun = useMemo(() => Boolean(libraryId) && query.trim().length > 0, [libraryId, query]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && canRun && !loading) {
      run();
    }
  }

  async function run() {
    if (!canRun) return;
    const data = await runAsync(() => mockRequest(MOCK_TEXT_RESULTS, 500));
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
          <label className="field">
            <div style={{ fontStyle: "italic" }}>Decris ce que tu cherches</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="ex: photos de groupe, ceremonie, danse..."
            />
          </label>

          <button className="btn primary" disabled={!canRun || loading} onClick={run}>
            {loading ? (
              <>
                <span className="btnSpinner" />
                Recherche...
              </>
            ) : (
              "Lancer la recherche"
            )}
          </button>
        </div>
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique - Recherche texte" items={[]} />
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
            emptyTooltip="Essayez une autre requete ou ajustez votre selection de bibliotheque."
          />
        </div>
      </div>

      <div className="fullRow">
        <RatingStars featureName="Recherche texte" onRate={(value) => console.log("rate text search", value)} />
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
