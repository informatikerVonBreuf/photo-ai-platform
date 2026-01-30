import { useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import Tooltip from "../ui/Tooltip";

const MOCK_LIBRARIES = [
  { id: "lib1", name: "Mariages 2024" },
  { id: "lib2", name: "Portraits Studio" },
];

const MOCK_SHOOTINGS = [
  { id: "sh1", library_id: "lib1", name: "Mariage — Marie & Rochinel" },
  { id: "sh2", library_id: "lib1", name: "Cérémonie — Église" },
  { id: "sh3", library_id: "lib2", name: "Portrait — Corporate" },
];

export default function ClusteringPage() {
  const [libraryId, setLibraryId] = useState("lib1");
  const [selectedShootings, setSelectedShootings] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function run() {
    // TODO: /cluster
    setLoading(true);
    setError(null);

    try {
      // Simulation d'erreur aléatoire (1 chance sur 3)
      if (Math.random() < 0.33) {
        throw new Error("Erreur de connexion au serveur");
      }

      await new Promise((r) => setTimeout(r, 800));
      setClusters([
        {
          id: "c1",
          theme: "Cérémonie",
          count: 12,
          photos: [
            { id: "p1", url: "https://picsum.photos/600/400?30", caption: "Cérémonie 1" },
            { id: "p2", url: "https://picsum.photos/600/400?31", caption: "Cérémonie 2" },
            { id: "p3", url: "https://picsum.photos/600/400?32", caption: "Cérémonie 3" },
          ],
        },
        {
          id: "c2",
          theme: "Photos de groupe",
          count: 20,
          photos: [
            { id: "p4", url: "https://picsum.photos/600/400?33", caption: "Groupe 1" },
            { id: "p5", url: "https://picsum.photos/600/400?34", caption: "Groupe 2" },
            { id: "p6", url: "https://picsum.photos/600/400?35", caption: "Groupe 3" },
          ],
        },
      ]);
    } catch (err) {
      setError(err.message || "Erreur inconnue");
      setClusters([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pageGrid">
      <div className="fullRow">
                    <div className="welcome">
                      <Tooltip text="Regroupe automatiquement tes photos par thème. Tu verras le résultat en cartes + galerie." position="right">
                        <div className="welcomeTitle">Clustering</div>
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
              <Tooltip text="Les clusters (thèmes et galeries) s'afficheront après le lancement" position="right">
              <div className="cardTitle">Lancer un clustering</div>
              </Tooltip>
            </div>
          </div>

          <button className="btn primary" onClick={run}>
            Lancer
          </button>
        </div>

        <RatingStars 
          featureName="Clustering"
          onRate={(v) => console.log("rate clustering", v)}
        />
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique — Clustering" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Clusters</div>
              <div className="cardSub">{clusters.length ? `${clusters.length} cluster(s)` : ""}</div>
            </div>
          </div>

          <div className="clusterGrid">
            {loading ? (
              <div className="loadingBox" style={{gridColumn: '1 / -1'}}>
                <div className="spinner" />
                <div className="loadingText">Analyse des clusters...</div>
              </div>
            ) : error ? (
              <ErrorState title="Erreur d'analyse" message={error} onRetry={run} />
            ) : clusters.length === 0 ? (
              <EmptyState
                icon="🧩"
                title="Aucun cluster"
                tooltip="Lancez une analyse pour regrouper automatiquement vos photos par thème."
              />
            ) : (
              clusters.map((cluster) => (
                <div className="clusterCard" key={cluster.id}>
                  <div className="clusterTop">
                    <div className="clusterTheme">{cluster.theme}</div>
                    <div className="mutedSmall">{cluster.count} photos</div>
                  </div>
                  <div className="clusterPhotos">
                    {cluster.photos.slice(0, 3).map((p) => (
                      <img key={p.id} src={p.url} alt={p.caption} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
