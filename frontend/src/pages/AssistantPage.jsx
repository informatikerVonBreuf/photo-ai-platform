import { useState } from "react";
import { askAssistant } from "../api/client";
import useAsyncRunner from "../hooks/useAsyncRunner";
import RatingStars from "../ui/RatingStars";

const INITIAL_MESSAGES = [
  {
    id: "welcome",
    role: "assistant",
    text: "Bonjour ! Que veux-tu faire aujourd'hui ?",
  },
];

export default function AssistantPage() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const { loading, error, runAsync } = useAsyncRunner();

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setInput("");

    const response = await runAsync(() => askAssistant(text));
    if (!response) return;

    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: response.reply || "Reponse vide de l'assistant.",
      },
    ]);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      sendMessage();
    }
  }

  return (
    <div className="pageGrid">
      <div className="leftCol">
        <div className="card">
          <div className="cardHeader">
            <div>
              <div className="cardTitle">Chat</div>
              <div className="cardSub">Connecte au client API mock ou backend.</div>
            </div>
          </div>

          <div className="chatBox">
            {messages.map((message) => (
              <div className={`chatBubble ${message.role === "assistant" ? "ai" : "user"}`} key={message.id}>
                {message.text}
              </div>
            ))}
            {error && <div className="fieldError">{error}</div>}
            <div className="chatInputRow">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pose une question..."
              />
              <button className="btn primary" disabled={loading || !input.trim()} onClick={sendMessage}>
                {loading ? "Envoi..." : "Envoyer"}
              </button>
            </div>
          </div>
        </div>

        <RatingStars featureName="Assistant" onRate={(value) => console.log("rate assistant", value)} />
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
            - Resume ce shooting en 5 points
            <br />
            - Propose une selection de 30 photos
            <br />
            - Quels themes dominent ?
          </div>
        </div>
      </div>
    </div>
  );
}
