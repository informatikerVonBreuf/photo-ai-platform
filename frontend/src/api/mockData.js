// src/api/mockData.js
export const MOCK_SHOOTINGS = [
  { id: "s1", name: "Mariage - Rochinel & Marie", created_at: "2026-01-10", status: "READY" },
  { id: "s2", name: "Shooting Studio - Portraits", created_at: "2026-01-15", status: "EMBEDDING" },
  { id: "s3", name: "Événement Corporate", created_at: "2026-01-18", status: "READY" },
];

// Un mock simple : des urls publiques pour afficher quelque chose.
// Plus tard, ça viendra du backend: /media/{shootingId}/{photoId}.jpg
const pics = [
  "https://picsum.photos/id/1025/600/400",
  "https://picsum.photos/id/1035/600/400",
  "https://picsum.photos/id/1050/600/400",
  "https://picsum.photos/id/1062/600/400",
  "https://picsum.photos/id/1074/600/400",
  "https://picsum.photos/id/1084/600/400",
  "https://picsum.photos/id/1080/600/400",
  "https://picsum.photos/id/1047/600/400",
  "https://picsum.photos/id/1011/600/400",
  "https://picsum.photos/id/1003/600/400",
];

function buildPhotos(prefix = "p") {
  const photos = {};
  for (let i = 0; i < 30; i++) {
    const id = `${prefix}${i + 1}`;
    const url = pics[i % pics.length] + `?v=${i}`;
    photos[id] = {
      id,
      url,
      date: "2026-01-25",
      tags: i % 2 === 0 ? ["group"] : ["portrait"],
      w: 4000,
      h: 3000,
    };
  }
  return photos;
}

export const MOCK_CLUSTER_RESULT = {
  shooting_id: "s1",
  created_at: "2026-01-21T10:20:00Z",
  clusters: [
    {
      cluster_id: 0,
      theme: "Ceremony",
      validated: false,
      confidence: 0.78,
      count: 12,
      cover_photo_ids: ["p1", "p2", "p3"],
      photo_ids: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12"],
    },
    {
      cluster_id: 1,
      theme: "Group Photos",
      validated: true,
      confidence: 0.84,
      count: 10,
      cover_photo_ids: ["p13", "p14", "p15"],
      photo_ids: ["p13", "p14", "p15", "p16", "p17", "p18", "p19", "p20", "p21", "p22"],
    },
    {
      cluster_id: 2,
      theme: "Dancing",
      validated: false,
      confidence: 0.72,
      count: 8,
      cover_photo_ids: ["p23", "p24", "p25"],
      photo_ids: ["p23", "p24", "p25", "p26", "p27", "p28", "p29", "p30"],
    },
  ],
  photos: buildPhotos("p"),
  umap: {
    dim: 2,
    points: Array.from({ length: 30 }).map((_, i) => ({
      photo_id: `p${i + 1}`,
      x: (Math.random() * 2 - 1).toFixed(3),
      y: (Math.random() * 2 - 1).toFixed(3),
      cluster_id: i < 12 ? 0 : i < 22 ? 1 : 2,
    })),
  },
};
