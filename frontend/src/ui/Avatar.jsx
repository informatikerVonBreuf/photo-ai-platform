import { useState } from "react";

export default function Avatar({ 
  src, 
  alt = "Avatar", 
  size = "md", 
  status,
  fallback 
}) {
  const [imageError, setImageError] = useState(false);

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className={`avatar avatar-${size}`}>
      {!imageError && src ? (
        <img 
          src={src} 
          alt={alt} 
          onError={() => setImageError(true)}
          className="avatarImg"
        />
      ) : (
        <div className="avatarFallback">
          {fallback || getInitials(alt)}
        </div>
      )}
      
      {status && <div className={`avatarStatus avatarStatus-${status}`} />}
    </div>
  );
}
