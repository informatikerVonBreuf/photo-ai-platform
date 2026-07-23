import "./App.css";
import BackgroundScene from "./components/BackgroundScene";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Import des pages
import DashboardLayout from "./pages/DashboardLayout";

export default function App() {
  return (
    <div className="app-root">
      {/* Scène 3D en arrière-plan */}
      <BackgroundScene />

      {/* Contenu principal de l'application */}
      <div className="app-content">
        <Router>
          <Routes>
            <Route path="/*" element={<DashboardLayout />} />
          </Routes>
        </Router>
      </div>
    </div>
  );
}
