import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";

import "./styles/dropdown.css";

import "./App.css";

const DashboardLayout = lazy(() => import("./pages/DashboardLayout"));
const BackgroundScene = lazy(() => import("./components/BackgroundScene"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const LibrariesPage = lazy(() => import("./pages/LibrariesPage"));
const TextSearchPage = lazy(() => import("./pages/TextSearchPage"));
const ImageSearchPage = lazy(() => import("./pages/ImageSearchPage"));
const FiltersPage = lazy(() => import("./pages/FiltersPage"));
const ClusteringPage = lazy(() => import("./pages/ClusteringPage"));
const AssistantPage = lazy(() => import("./pages/AssistantPage"));

function RequireAuth({ children }) {
  const token = localStorage.getItem("mpx_token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <div className="app-root">
      <Suspense fallback={null}>
        <BackgroundScene />
      </Suspense>
      <div className="app-content">
    <Suspense
      fallback={
        <div className="routeLoader" role="status" aria-label="Chargement">
          <span className="btnSpinner" />
        </div>
      }
    >
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <DashboardLayout />
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
    </Suspense>
    </div>
    </div>
  );
}
