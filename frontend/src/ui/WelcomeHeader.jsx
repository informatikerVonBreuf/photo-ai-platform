const PAGE_META = {
  "/libraries": {
    title: "Bibliotheques",
    desc: "Cree et organise tes bibliotheques, shootings et photos.",
    badge: "Organisation",
  },
  "/search-text": {
    title: "Recherche par texte",
    desc: "Decris ce que tu cherches, puis lance la recherche sur une bibliotheque ou des shootings.",
    badge: "Texte",
  },
  "/search-image": {
    title: "Recherche par image",
    desc: "Choisis des images de reference, selectionne le scope, puis lance la recherche.",
    badge: "Image",
  },
  "/filters": {
    title: "Filtres",
    desc: "Filtre tes photos par dates, orientation, tailles et tags.",
    badge: "Filtrage",
  },
  "/clustering": {
    title: "Clustering",
    desc: "Regroupe automatiquement tes photos par theme et explore les galeries.",
    badge: "Clusters",
  },
  "/assistant": {
    title: "Assistant IA",
    desc: "Pose une question sur tes shootings, tes selections ou tes themes dominants.",
    badge: "Assistant",
  },
};

export default function WelcomeHeader({ pathname }) {
  const key = Object.keys(PAGE_META).find((path) => pathname.startsWith(path)) || "/libraries";
  const { title, desc, badge } = PAGE_META[key];

  return (
    <header className="welcome">
      <div>
        <div className="welcomeTitle">{title}</div>
        <div className="welcomeDesc">{desc}</div>
      </div>
      <div className="pill">{badge}</div>
    </header>
  );
}
