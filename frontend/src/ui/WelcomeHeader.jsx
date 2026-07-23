export default function WelcomeHeader({ pathname }) {
  const map = {
    "/app/libraries": {
      /*title: "Bibliothèques",
      desc: "Crée et organise tes libraries, shootings et photos.",*/
      badge: "Organisation",
    },
    "/app/search-text": {
      /*title: "Recherche par texte",
      desc: "Bienvenue ! Décris ce que tu cherches, puis lance la recherche sur une library ou des shootings.",*/
      badge: "Texte",
    },
    "/app/search-image": {
      /*title: "Recherche par image",
      desc: "Bienvenue ! Choisis des images de référence (visage / scène), sélectionne le scope, puis lance la recherche.",*/
      badge: "Image",
    },
    "/app/filters": {
      /*title: "Filtres",
      desc: "Bienvenue ! Filtre tes photos (dates, orientation, tailles, tags) sur une library ou une sélection de shootings.",*/
      badge: "Filtrage",
    },
    "/app/clustering": {
      /*title: "Clustering",
      desc: "Bienvenue ! Regroupe automatiquement tes photos par thème. Tu verras le résultat en cartes + galerie.",*/
      badge: "Clusters",
    },
    "/app/assistant": {
      /*title: "Assistant IA",
      desc: "Bienvenue ! Pose une question (ex: “résume ce shooting”, “propose une sélection”).",*/
      badge: "Assistant",
    },    "/app/test-components": {
      title: "🧪 Test des Composants UI",
      desc: "Page de test pour vérifier le bon fonctionnement des 8 composants UI réutilisables.",
      badge: "Composants",
    },  };

  const key = Object.keys(map).find((k) => pathname.startsWith(k)) || "/app/libraries";
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
