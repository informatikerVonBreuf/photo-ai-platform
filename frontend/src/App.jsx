import { Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import DashboardLayout from "./pages/DashboardLayout";
import LoginPage from "./pages/LoginPage";

import LibrariesPage from "./pages/LibrariesPage";
import TextSearchPage from "./pages/TextSearchPage";
import ImageSearchPage from "./pages/ImageSearchPage";
import FiltersPage from "./pages/FiltersPage";
import ClusteringPage from "./pages/ClusteringPage";
import AssistantPage from "./pages/AssistantPage";
import BackgroundScene from "./components/BackgroundScene";
import "./styles/dropdown.css";

import "./App.css";

function RequireAuth({ children }) {
  const token = localStorage.getItem("mpx_token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

const BG_MODELS = [
  { value: "none", label: "Aucun objet" },
];

const DEFAULT_BG_MODEL = "none";

export default function App() {
  const [bgModel, setBgModel] = useState(DEFAULT_BG_MODEL);
  return (
    <div className="app-root">
      <BackgroundScene modelPath={bgModel === "none" ? null : bgModel} />
      <div className="app-content">
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <DashboardLayout bgModel={bgModel} onChangeBgModel={setBgModel} bgModelOptions={BG_MODELS} />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/app/libraries" replace />} />
        <Route path="libraries" element={<LibrariesPage />} />
        <Route path="search-text" element={<TextSearchPage />} />
        <Route path="search-image" element={<ImageSearchPage />} />
        <Route path="filters" element={<FiltersPage />} />
        <Route path="clustering" element={<ClusteringPage />} />
        <Route path="assistant" element={<AssistantPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </div>
    </div>
  );
}
