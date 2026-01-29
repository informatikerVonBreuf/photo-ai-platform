function MessageBubble({ message }) {
  const isUser = message.sender === "user";
  const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;

  return (
    <div className={`message-row ${isUser ? "user" : "assistant"}`}>
      {!isUser && <div className="avatar assistant-avatar">IA</div>}

      <div className={`bubble ${isUser ? "bubble-user" : "bubble-assistant"}`}>
        {message.text && <div>{message.text}</div>}

        {hasAttachments && (
          <div className="preview-grid">
            {message.attachments.map((file, idx) => (
              <img
                key={idx}
                className="preview-thumb"
                src={URL.createObjectURL(file)}
                alt={file.name}
              />
            ))}
          </div>
        )}
      </div>

      {isUser && <div className="avatar user-avatar">Moi</div>}
    </div>
  );
}

export default MessageBubble;
