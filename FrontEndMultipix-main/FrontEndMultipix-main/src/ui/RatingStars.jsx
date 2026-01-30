import { useState } from "react";
import Tooltip from "./Tooltip";

export default function RatingStars({ featureName, onRate }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  const handleClick = (value) => {
    setRating(value);
    if (onRate) onRate(value);
  };

  return (
    <div className="card" style={{ textAlign: "center", padding: "16px" }}>
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
    </div>
  );
}
