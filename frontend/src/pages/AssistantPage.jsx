import { useState } from "react";
import RatingStars from "../ui/RatingStars";
import Tooltip from "../ui/Tooltip";


export default function AssistantPage() {
  const [assistantMode, setAssistantMode] = useState("techniques");

  return (
    <div className="pageGrid">
      <div className="fullRow">
                          <div className="welcome">
                            <Tooltip text=" Pose une question (ex: “résume ce shooting”, “propose une sélection”)." position="right">
                              <div className="welcomeTitle">Assistant IA</div>
                            </Tooltip>
                          </div>
                        </div>
      <div className="leftCol">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Chat</div>
              <div className="cardSub">Base UI (DB + modèles plus tard).</div>
            </div>
          </div>

          <div className="toggleRow" style={{ marginTop: "4px", justifyContent: "flex-end" }}>
            <div className="toggle">
              <button
                type="button"
                className={`toggleBtn ${assistantMode === "techniques" ? "on" : ""}`}
                onClick={() => setAssistantMode("techniques")}
              >
                Techniques
              </button>
              <button
                type="button"
                className={`toggleBtn ${assistantMode === "usages" ? "on" : ""}`}
                onClick={() => setAssistantMode("usages")}
              >
                Usages
              </button>
              <button
                type="button"
                className={`toggleBtn ${assistantMode === "resultats" ? "on" : ""}`}
                onClick={() => setAssistantMode("resultats")}
              >
                Résultats
              </button>
              <button
                type="button"
                className={`toggleBtn ${assistantMode === "problemes" ? "on" : ""}`}
                onClick={() => setAssistantMode("problemes")}
              >
                Problèmes
              </button>
            </div>
          </div>

          <div className="chatBox">
            <div className="chatBubble ai">Bonjour ! Que veux-tu faire aujourd’hui ?</div>
            <div className="chatInputRow">
              <input placeholder="Pose une question…" />
              <button className="btn primary">Envoyer</button>
            </div>
          </div>
        </div>

        <RatingStars 
          featureName="Assistant"
          onRate={(v) => console.log("rate assistant", v)}
        />
      </div>

      <div className="rightCol">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Conseils</div>
              <div className="cardSub">Exemples de prompts</div>
            </div>
          </div>
          <div className="muted">
            • “Résume ce shooting en 5 points”<br />
            • “Propose une sélection de 30 photos”<br />
            • “Quels thèmes dominent ?”
          </div>
        </div>
      </div>
    </div>
  );
}
