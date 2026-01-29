import { useState } from "react";

export default function RatingStars({ label = "Votre avis", onRate }) {
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);

  function commit(v) {
    setValue(v);
    onRate?.(v);
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <div>
          <div className="cardTitle">{label}</div>
          <div className="cardSub">Note cette fonctionnalité (feedback utilisateur).</div>
        </div>
      </div>

      <div className="stars">
        {[1,2,3,4,5].map((n) => (
          <button
            key={n}
            type="button"
            className={`star ${((hover || value) >= n) ? "on" : ""}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => commit(n)}
            aria-label={`${n} étoiles`}
          >
            ★
          </button>
        ))}
        <span className="mutedSmall">{value ? `${value}/5` : "—"}</span>
      </div>
    </div>
  );
}
