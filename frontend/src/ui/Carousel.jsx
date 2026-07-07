import { useState } from "react";

export default function Carousel({ images, onImageClick }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) {
    return <div className="carouselEmpty">Aucune image</div>;
  }

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="carousel">
      {/* Image principale */}
      <div className="carouselImageContainer">
        <img 
          src={images[currentIndex]} 
          alt={`Slide ${currentIndex + 1}`}
          className="carouselImage"
          onClick={() => onImageClick && onImageClick(images[currentIndex])}
          style={{ cursor: onImageClick ? "pointer" : "default" }}
        />
        
        {/* Boutons de navigation */}
        {images.length > 1 && (
          <>
            <button 
              className="carouselBtn carouselBtnPrev" 
              onClick={goToPrevious}
              aria-label="Image précédente"
            >
              ‹
            </button>
            <button 
              className="carouselBtn carouselBtnNext" 
              onClick={goToNext}
              aria-label="Image suivante"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Indicateurs (points) */}
      {images.length > 1 && (
        <div className="carouselIndicators">
          {images.map((_, index) => (
            <button
              key={index}
              className={`carouselDot ${index === currentIndex ? "active" : ""}`}
              onClick={() => setCurrentIndex(index)}
              aria-label={`Aller à l'image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Compteur */}
      <div className="carouselCounter">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
