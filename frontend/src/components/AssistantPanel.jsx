import { useState, useRef } from "react";
import { askAssistant } from "../api/client";
import MessageBubble from "./MessageBubble";

function AssistantPanel() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "assistant",
      text: "Bonjour, comment puis-je t’aider avec tes shootings ?",
      role: "assistant",
    },
  ]);
  const [attachments, setAttachments] = useState([]); // images jointes

  // compteur d'ID pour les nouveaux messages
  const nextIdRef = useRef(2);

  const handleSend = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    // on refuse d'envoyer si pas de texte ET pas de pièces jointes
    if (!trimmed && attachments.length === 0) return;

    // message utilisateur
    const userMessage = {
      id: nextIdRef.current++,
      sender: "user",
      text: trimmed,
      role: "user",
      attachments, // tableau de File (tu l'utiliseras plus tard côté backend)
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setAttachments([]);

    // appel backend (stub ou vrai)
    let replyText = "";
    try {
      const data = await askAssistant(userMessage.text);
      replyText = data.reply || "(Réponse vide de l'assistant)";
    } catch (err) {
      replyText = "Erreur lors de l'appel à l'assistant.";
      console.error(err);
    }

    const assistantMessage = {
      id: nextIdRef.current++,
      sender: "assistant",
      text: replyText,
      role: "assistant",
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  return (
    <div id="assistant-section">
      <h2>Assistant IA</h2>

      <div id="assistant-messages">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      <form onSubmit={handleSend} className="assistant-input-form">
        <textarea
          rows={3}
          placeholder="Pose une question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();      // empêche le retour à la ligne
              handleSend(e);           // déclenche l’envoi
            }
          }}
        />

        <div className="assistant-actions">
          <button
            type="button"
            onClick={() =>
              document.getElementById("assistant-file-input").click()
            }
          >
            Joindre des photos
          </button>
          <input
            id="assistant-file-input"
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              const images = files.filter((f) => f.type.startsWith("image/"));
              setAttachments((prev) => [...prev, ...images]);
            }}
          />

          <button type="submit">Envoyer</button>
        </div>

        {attachments.length > 0 && (
          <div className="preview-grid">
            {attachments.map((file, idx) => (
              <img
                key={idx}
                className="preview-thumb"
                src={URL.createObjectURL(file)}
                alt={file.name}
              />
            ))}
          </div>
        )}
      </form>
    </div>
  );
}

export default AssistantPanel;
