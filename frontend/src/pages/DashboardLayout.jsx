import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import WelcomeHeader from "../ui/WelcomeHeader";

import { 
  Books, 
  MagnifyingGlass, 
  Image, 
  Sliders, 
  GridFour, 
  Robot 
} from "@phosphor-icons/react";

const NAV = [
  { to: "/app/libraries", label: "Bibliothèque", icon: <Books size={18} />, tone: "tone-libraries", color: "#80a4ff" },
  { to: "/app/search-text", label: "Recherche texte", icon: <MagnifyingGlass size={18} />, tone: "tone-text", color: "#ff8686" },
  { to: "/app/search-image", label: "Recherche image", icon: <Image size={18} />, tone: "tone-image", color: "#b0ffbd" },
  { to: "/app/filters", label: "Filtres avancés", icon: <Sliders size={18} />, tone: "tone-filters", color: "#83e4ff" },
  { to: "/app/clustering", label: "Tri automatique", icon: <GridFour size={18} />, tone: "tone-cluster", color: "#fff67a" },
  { to: "/app/assistant", label: "Assistant IA", icon: <Robot size={18} />, tone: "tone-assistant", color: "#ea8aff" },
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
          <div className="logo">
            <img src="/Logo/logotransparent3.png" alt="Multipix" />
          </div>
          <div className="brandText">
            <div className="brandTitle">Multipix</div>
          </div>
        </div>

        <div className="nav">
          {NAV.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
                style={{ "--nav-color": it.color }}
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
