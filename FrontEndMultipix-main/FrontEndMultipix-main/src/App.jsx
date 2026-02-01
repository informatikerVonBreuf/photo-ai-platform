import { Routes, Route, Navigate } from "react-router-dom";
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

export default function App() {
  return (
    <div className="app-root">
      <BackgroundScene />
      <div className="app-content">
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <DashboardLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/libraries" replace />} />
        <Route path="libraries" element={<LibrariesPage />} />
        <Route path="search-text" element={<TextSearchPage />} />
        <Route path="search-image" element={<ImageSearchPage />} />
        <Route path="filters" element={<FiltersPage />} />
        <Route path="clustering" element={<ClusteringPage />} />
        <Route path="assistant" element={<AssistantPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </div>
    </div>
  );
}
