import RatingStars from "../ui/RatingStars";

export default function AssistantPage() {
  return (
    <div className="pageGrid">
      <div className="leftCol">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Chat</div>
              <div className="cardSub">Base UI (DB + modèles plus tard).</div>
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

        <RatingStars label="Appréciation — Assistant" onRate={(v) => console.log("rate assistant", v)} />
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
