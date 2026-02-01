// src/components/FloatingModel.jsx
import { useGLTF } from '@react-three/drei';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

// Liste des modèles disponibles
const CAMERA_MODELS = [
  '/models/camera1.glb',
  '/models/camera2.glb',
  '/models/camera3.glb',
  '/models/camera4.glb',
  '/models/camera5.glb',
];

const MODEL_CONFIG = {
  '/models/camera1.glb': { scale: [1, 1, 1] }, //Bords arrondis
  '/models/camera2.glb': { scale: [0.3, 0.3, 0.3] }, //Accordéon
  '/models/camera3.glb': { scale: [2.2, 2.2, 2.2] }, //Flash immense
  '/models/camera4.glb': { scale: [2.5, 2.5, 2.5] }, //Surveillance
  '/models/camera5.glb': { scale: [25, 25, 25] }, //Avec lance
};
// IMPORTANT : ne pas précharger tous, seulement le modèle choisi plus bas si tu veux
// (tu peux enlever le preload global que tu avais avant)

/**
 * Caméra 3D qui se déplace et rebondit sur les bords,
 * avec sélection ALÉATOIRE d’un modèle parmi CAMERA_MODELS.
 */
function FloatingModel() {
  const modelPath = useMemo(() => {
    const index = Math.floor(Math.random() * CAMERA_MODELS.length);
    return CAMERA_MODELS[index];
  }, []);

  const { scene } = useGLTF(modelPath);
  const modelRef = useRef(null);

  // Vitesse du mouvement (augmentée pour plus de dynamisme)
  const velocity = useRef({ x: 0.04, y: 0.04 });
  
  // Limites de déplacement (élargies pour couvrir plus l'écran)
  const bounds = useRef({
    left: -6,
    right: 6,
    top: 3,
    bottom: -3,
  });

  const config = MODEL_CONFIG[modelPath] || { scale: [1, 1, 1] };

  useFrame((_, delta) => {
    if (!modelRef.current) return;

    const pos = modelRef.current.position;
    const vel = velocity.current;

    pos.x += vel.x * delta;
    pos.y += vel.y * delta;

    if (pos.x > bounds.current.right) {
      pos.x = bounds.current.right;
      vel.x *= -1;
    } else if (pos.x < bounds.current.left) {
      pos.x = bounds.current.left;
      vel.x *= -1;
    }

    if (pos.y > bounds.current.top) {
      pos.y = bounds.current.top;
      vel.y *= -1;
    } else if (pos.y < bounds.current.bottom) {
      pos.y = bounds.current.bottom;
      vel.y *= -1;
    }

    modelRef.current.rotation.y += 0.2 * delta;
  });

  return (
    <primitive
      ref={modelRef}
      object={scene}
      position={[0, 0, 0]}
      scale={config.scale} // ajuste si un modèle est trop grand/petit
    />
  );
}

export default FloatingModel;
