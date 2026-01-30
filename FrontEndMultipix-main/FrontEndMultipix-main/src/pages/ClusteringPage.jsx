import { useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";
import EmptyState from "../ui/EmptyState";

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

  async function run() {
    // TODO: /cluster
    setLoading(true);
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
    setLoading(false);
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
            <div>
              <div className="cardTitle">Lancer un clustering</div>
              <div className="cardSub">Tu verras les clusters (thème + galerie) juste après.</div>
            </div>
          </div>

          <button className="btn primary" onClick={run}>
            Lancer
          </button>
        </div>

        <RatingStars label="Appréciation — Clustering" onRate={(v) => console.log("rate clustering", v)} />
      </div>

      <div className="rightCol">
        <HistoryPanel title="Historique — Clustering" items={[]} />
      </div>

      <div className="fullRow">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Clusters</div>
              <div className="cardSub">{clusters.length ? `${clusters.length} cluster(s)` : "Aucun clustering lancé."}</div>
            </div>
          </div>

          <div className="clusterGrid">
            {loading ? (
              <div className="loadingBox" style={{gridColumn: '1 / -1'}}>
                <div className="spinner" />
                <div className="loadingText">Analyse des clusters...</div>
              </div>
            ) : clusters.length === 0 ? (
              <EmptyState
                icon="🧩"
                title="Aucun cluster"
                message="Lancez une analyse pour regrouper automatiquement vos photos par thème."
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
