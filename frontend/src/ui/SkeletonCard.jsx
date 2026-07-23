import React from "react";

export default function SkeletonCard({ count = 4 }) {
  return Array.from({ length: count }).map((_, index) => (
    <div className="tile skeleton" key={index}>
      <div className="skeletonImg" />
      <div className="tileMeta">
        <div className="skeletonLine" />
        <div className="skeletonLine short" />
      </div>
    </div>
  ));
}
