import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import WelcomeHeader from "../ui/WelcomeHeader";

const NAV = [
  { to: "/libraries", label: "Bibliothèques", icon: "📚", tone: "tone-libraries" },
  { to: "/search-text", label: "Recherche texte", icon: "🔎", tone: "tone-text" },
  { to: "/search-image", label: "Recherche image", icon: "🖼️", tone: "tone-image" },
  { to: "/filters", label: "Filtres", icon: "🎛️", tone: "tone-filters" },
  { to: "/clustering", label: "Clustering", icon: "🧩", tone: "tone-cluster" },
  { to: "/assistant", label: "Assistant IA", icon: "🤖", tone: "tone-assistant" },
];

function getTone(pathname) {
  const item = NAV.find((n) => pathname.startsWith(n.to));
  return item?.tone || "tone-default";
}

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const user = JSON.parse(localStorage.getItem("mpx_user") || "{}");
  const tone = getTone(pathname);

  function logout() {
    localStorage.removeItem("mpx_token");
    localStorage.removeItem("mpx_user");
    nav("/login");
  }

  return (
    <div className={`shell ${tone}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">MPX</div>
          <div className="brandText">
            <div className="brandTitle">Multipix</div>
            <div className="brandSub">Plateforme IA pour photographes</div>
          </div>
        </div>

        <div className="nav">
          {NAV.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              className={({ isActive }) => `navItem ${isActive ? "active" : ""}`}
            >
              <span className="navIcon">{it.icon}</span>
              <span className="navLabel">{it.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebarBottom">
          <div className="userCard">
            <div className="dot" />
            <div className="userMeta">
              <div className="userEmail">{user?.email || "Utilisateur"}</div>
              <div className="userHint">Session locale</div>
            </div>
          </div>

          <button className="btn ghost" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="main">
        {/* Header = message de bienvenue par page */}
        <WelcomeHeader pathname={pathname} />
        <Outlet />
      </main>
    </div>
  );
}
