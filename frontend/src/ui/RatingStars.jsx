import { useState } from "react";
import Tooltip from "./Tooltip";
import { submitRatingComment } from "../api/client";

export default function RatingStars({ featureName, onRate, onComment }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");

  const handleClick = (value) => {
    setRating(value);
    if (onRate) onRate(value);
  };

  const handleSend = async () => {
    const trimmed = comment.trim();
    if (!trimmed) return;
    try {
      await submitRatingComment({ featureName, rating, comment: trimmed });
      if (onComment) onComment({ rating, comment: trimmed, featureName });
      setComment("");
    } catch (error) {
      console.error("submitRatingComment failed", error);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="card" style={{ textAlign: "center", padding: "16px" }}>
      <div className="ratingRow">
        <div className="stars">
          {[1, 2, 3, 4, 5].map((value) => {
            const isActive = value <= (hover || rating);
            
            return (
              <Tooltip 
                key={value} 
                text={`Fonctionnalité ${featureName} notée ${value}/5`}
                position="top"
              >
                <button
                  className={`star ${isActive ? "on" : ""}`}
                  onClick={() => handleClick(value)}
                  onMouseEnter={() => setHover(value)}
                  onMouseLeave={() => setHover(0)}
                >
                  ★
                </button>
              </Tooltip>
            );
          })}
        </div>
        <div className="ratingComment">
          <textarea
            className="ratingCommentInput"
            placeholder="Votre commentaire..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <button
            className="ratingCommentSend"
            onClick={handleSend}
            type="button"
          >
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
