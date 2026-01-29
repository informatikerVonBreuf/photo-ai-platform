import { useState } from "react";
import ScopePicker from "../ui/ScopePicker";
import HistoryPanel from "../ui/HistoryPanel";
import RatingStars from "../ui/RatingStars";

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

  async function run() {
    // TODO: /cluster
    setClusters([
      {
        id: "c1",
        theme: "Cérémonie",
        count: 12,
        photos: [
          "https://picsum.photos/600/400?30",
          "https://picsum.photos/600/400?31",
          "https://picsum.photos/600/400?32",
        ],
      },
      {
        id: "c2",
        theme: "Photos de groupe",
        count: 20,
        photos: [
          "https://picsum.photos/600/400?33",
          "https://picsum.photos/600/400?34",
          "https://picsum.photos/600/400?35",
        ],
      },
    ]);
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
            {clusters.map((c) => (
              <div className="clusterCard" key={c.id}>
                <div className="clusterTop">
                  <div className="clusterTheme">{c.theme}</div>
                  <div className="pill">{c.count} photos</div>
                </div>
                <div className="clusterPhotos">
                  {c.photos.map((u, i) => (
                    <img key={i} src={u} alt="" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
