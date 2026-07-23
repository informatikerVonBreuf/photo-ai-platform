import { useState } from "react";
import ProgressBar from "../ui/ProgressBar";

export default function TestProgress() {
  const [progress, setProgress] = useState(45);

  return (
    <div className="shell">
      <div style={{ gridColumn: "1 / -1", padding: "20px" }}>
        <div className="card" style={{ padding: "20px" }}>
          <h1 style={{ marginTop: 0, fontSize: "24px", fontWeight: "bold" }}>Test Progress Bars</h1>
          
          <div style={{ display: "grid", gap: "20px", marginTop: "20px" }}>
            {/* Default */}
            <div>
              <div className="mutedSmall" style={{ marginBottom: "8px" }}>
                Default - {progress}%
              </div>
              <ProgressBar 
                value={progress} 
                variant="default" 
                showLabel 
                size="md"
              />
            </div>

            {/* Success */}
            <div>
              <div className="mutedSmall" style={{ marginBottom: "8px" }}>
                Success - 80%
              </div>
              <ProgressBar 
                value={80} 
                variant="success" 
                showLabel 
                size="lg"
              />
            </div>

            {/* Warning */}
            <div>
              <div className="mutedSmall" style={{ marginBottom: "8px" }}>
                Warning - 60%
              </div>
              <ProgressBar 
                value={60} 
                variant="warning" 
                size="md"
              />
            </div>

            {/* Error */}
            <div>
              <div className="mutedSmall" style={{ marginBottom: "8px" }}>
                Error - 30%
              </div>
              <ProgressBar 
                value={30} 
                variant="error" 
                size="sm"
              />
            </div>

            {/* Info */}
            <div>
              <div className="mutedSmall" style={{ marginBottom: "8px" }}>
                Info - 70%
              </div>
              <ProgressBar 
                value={70} 
                variant="info" 
                showLabel
                size="md"
              />
            </div>

            {/* Animated */}
            <div>
              <div className="mutedSmall" style={{ marginBottom: "8px" }}>
                Loading (animé)
              </div>
              <ProgressBar 
                value={40} 
                variant="info" 
                animated 
                size="md"
              />
            </div>

            {/* Contrôles */}
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button 
                className="btn primary" 
                onClick={() => setProgress(Math.min(100, progress + 10))}
              >
                + 10%
              </button>
              <button 
                className="btn" 
                onClick={() => setProgress(Math.max(0, progress - 10))}
              >
                - 10%
              </button>
              <button 
                className="btn" 
                onClick={() => setProgress(0)}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
