export default function ProgressBar({ 
  value = 0, 
  max = 100, 
  variant = "default",
  showLabel = false,
  size = "md"
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`progressBarContainer progressBar-${size}`}>
      <div className={`progressBar progressBar-${variant}`}>
        <div 
          className="progressBarFill"
          style={{ width: `${percentage}%` }}
        >
          {showLabel && (
            <span className="progressBarLabel">{Math.round(percentage)}%</span>
          )}
        </div>
      </div>
    </div>
  );
}
