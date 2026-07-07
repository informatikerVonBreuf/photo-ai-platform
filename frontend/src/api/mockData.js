// src/api/mockData.js
export const MOCK_LIBRARIES = [
  { id: "lib1", name: "Mariages 2024", desc: "Clients et ceremonies" },
  { id: "lib2", name: "Portraits Studio", desc: "Portraits professionnels" },
];

export const MOCK_SHOOTINGS = [
  {
    id: "sh1",
    library_id: "lib1",
    name: "Mariage - Marie & Rochinel",
    created_at: "2026-01-10",
    status: "READY",
  },
  {
    id: "sh2",
    library_id: "lib1",
    name: "Ceremonie - Eglise",
    created_at: "2026-01-12",
    status: "READY",
  },
  {
    id: "sh3",
    library_id: "lib2",
    name: "Portrait - Corporate",
    created_at: "2026-01-15",
    status: "EMBEDDING",
  },
];

export const MOCK_TEXT_RESULTS = [
  {
    id: "p1",
    url: "https://picsum.photos/600/400?1",
    caption: "Photo de groupe",
    name: "IMG_20260115_124530.jpg",
    date: "15 janvier 2026",
    dimensions: "4000 x 3000 px",
    size: "2.4 MB",
    format: "JPEG",
    library: "Mariages 2024",
    shooting: "Mariage - Marie & Rochinel",
    tags: ["portrait", "groupe", "exterieur"],
    score: 0.91,
  },
  {
    id: "p2",
    url: "https://picsum.photos/600/400?2",
    caption: "Ceremonie",
    name: "IMG_20260115_140000.jpg",
    date: "15 janvier 2026",
    dimensions: "3840 x 2560 px",
    size: "1.8 MB",
    format: "JPEG",
    library: "Mariages 2024",
    shooting: "Mariage - Marie & Rochinel",
    tags: ["ceremonie", "interieur"],
    score: 0.87,
  },
  {
    id: "p3",
    url: "https://picsum.photos/600/400?3",
    caption: "Danse",
    name: "IMG_20260115_185000.jpg",
    date: "15 janvier 2026",
    dimensions: "4000 x 3000 px",
    size: "2.2 MB",
    format: "JPEG",
    library: "Mariages 2024",
    shooting: "Mariage - Marie & Rochinel",
    tags: ["danse", "soiree", "ambiance"],
    score: 0.82,
  },
];

export const MOCK_IMAGE_RESULTS = [
  {
    id: "p7",
    url: "https://picsum.photos/600/400?7",
    caption: "Portrait",
    name: "IMG_20260115_150700.jpg",
    date: "15 janvier 2026",
    dimensions: "4000 x 3000 px",
    size: "2.1 MB",
    format: "JPEG",
    library: "Portraits Studio",
    shooting: "Portrait - Corporate",
    tags: ["portrait", "reference"],
    score: 0.93,
  },
  {
    id: "p8",
    url: "https://picsum.photos/600/400?8",
    caption: "Portrait 2",
    name: "IMG_20260115_151200.jpg",
    date: "15 janvier 2026",
    dimensions: "3840 x 2560 px",
    size: "1.9 MB",
    format: "JPEG",
    library: "Portraits Studio",
    shooting: "Portrait - Corporate",
    tags: ["portrait", "studio"],
    score: 0.88,
  },
];

export const MOCK_FILTER_RESULTS = [
  {
    id: "p20",
    url: "https://picsum.photos/600/400?20",
    caption: "Filtre",
    name: "IMG_20260116_092000.jpg",
    date: "16 janvier 2026",
    dimensions: "3000 x 2000 px",
    size: "1.6 MB",
    format: "JPEG",
    library: "Mariages 2024",
    shooting: "Ceremonie - Eglise",
    tags: ["selection", "filtre"],
    score: 1,
  },
];

export const MOCK_CLUSTERS = [
  {
    id: "c1",
    theme: "Ceremonie",
    count: 3,
    photos: [
      { id: "p30", url: "https://picsum.photos/600/400?30", caption: "Ceremonie 1" },
      { id: "p31", url: "https://picsum.photos/600/400?31", caption: "Ceremonie 2" },
      { id: "p32", url: "https://picsum.photos/600/400?32", caption: "Ceremonie 3" },
    ],
  },
  {
    id: "c2",
    theme: "Photos de groupe",
    count: 3,
    photos: [
      { id: "p33", url: "https://picsum.photos/600/400?33", caption: "Groupe 1" },
      { id: "p34", url: "https://picsum.photos/600/400?34", caption: "Groupe 2" },
      { id: "p35", url: "https://picsum.photos/600/400?35", caption: "Groupe 3" },
    ],
  },
];

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
  for (let i = 0; i < 30; i += 1) {
    const id = `${prefix}${i + 1}`;
    photos[id] = {
      id,
      url: `${pics[i % pics.length]}?v=${i}`,
      date: "2026-01-25",
      tags: i % 2 === 0 ? ["group"] : ["portrait"],
      w: 4000,
      h: 3000,
    };
  }
  return photos;
}

function seededPoint(index, axis) {
  const text = `${index}:${axis}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return ((hash % 2000) / 1000 - 1).toFixed(3);
}

export const MOCK_CLUSTER_RESULT = {
  shooting_id: "sh1",
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
      x: seededPoint(i, "x"),
      y: seededPoint(i, "y"),
      cluster_id: i < 12 ? 0 : i < 22 ? 1 : 2,
    })),
  },
};

function cloneMock(payload) {
  return JSON.parse(JSON.stringify(payload));
}

export async function mockRequest(payload, delayMs = 500) {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  return cloneMock(payload);
}
