export default function WelcomeHeader({ pathname }) {
  const map = {
    "/libraries": {
      title: "Bibliothèques",
      desc: "Crée et organise tes libraries, shootings et photos.",
      badge: "Organisation",
    },
    "/search-text": {
      title: "Recherche par texte",
      desc: "Bienvenue ! Décris ce que tu cherches, puis lance la recherche sur une library ou des shootings.",
      badge: "Texte",
    },
    "/search-image": {
      title: "Recherche par image",
      desc: "Bienvenue ! Choisis des images de référence (visage / scène), sélectionne le scope, puis lance la recherche.",
      badge: "Image",
    },
    "/filters": {
      title: "Filtres",
      desc: "Bienvenue ! Filtre tes photos (dates, orientation, tailles, tags) sur une library ou une sélection de shootings.",
      badge: "Filtrage",
    },
    "/clustering": {
      title: "Clustering",
      desc: "Bienvenue ! Regroupe automatiquement tes photos par thème. Tu verras le résultat en cartes + galerie.",
      badge: "Clusters",
    },
    "/assistant": {
      title: "Assistant IA",
      desc: "Bienvenue ! Pose une question (ex: “résume ce shooting”, “propose une sélection”).",
      badge: "Assistant",
    },
  };

  const key = Object.keys(map).find((k) => pathname.startsWith(k)) || "/libraries";
  const { title, desc, badge } = map[key];

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
