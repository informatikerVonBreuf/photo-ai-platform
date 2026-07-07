// src/components/FloatingModel.jsx
import { useGLTF } from '@react-three/drei';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';

// Liste des modèles disponibles
const CAMERA_MODELS = [
  '/models/camera4.glb',
  '/models/camera5.glb',
  '/models/camera6.glb',
  '/models/camera7.glb',
  '/models/camera11.glb',
  '/models/camera12.glb',
  '/models/Camera13.glb',
];

const MODEL_CONFIG = {
  '/models/camera4.glb': { scale: [2.5, 2.5, 2.5] }, //Caméra de surveillance
  '/models/camera5.glb': { scale: [25, 25, 25] }, //Leica
  '/models/camera6.glb': { scale: [1, 1, 1] }, //Canon
  '/models/camera7.glb': { scale: [25, 25, 25] }, //Exacta
  '/models/camera11.glb': { scale: [2.5, 2.5, 2.5] }, //Keystone
  '/models/camera12.glb': { scale: [0.7, 0.7, 0.7] }, //Sniper
  '/models/Camera13.glb': { scale: [6, 6, 6] }, //Polaroid
}

const MODEL_INITIALS = {
  '/models/camera5.glb': {
    position: { x: 0.2362928207022853, y: -0.8311586386808305, z: 0 },
    rotation: { x: 0, y: 0.9006499999999976, z: 0 },
  }, // Leica
  '/models/camera7.glb': {
    position: { x: -1.392935976296831, y: -1.0240860589944665, z: 0 },
    rotation: { x: 0, y: 7.000870000000285, z: 0 },
  }, // Exacta
  '/models/camera6.glb': {
    position: { x: -1.1816077596101022, y: -0.36234628126745083, z: 0 },
    rotation: { x: 0, y: 0.099229999999702, z: 0 },
  }, // Canon
  '/models/camera4.glb': {
    rotation: { x: 0, y: 0.49997999999970255, z: 0 },
  }, // Surveillance
  '/models/camera11.glb': {
    position: { x: 1.243628242116148, y: 1.4983178468209113, z: 0 },
    rotation: { x: 0, y: 1.4007549999997027, z: 0 },
  }, // Keystone
  '/models/camera12.glb': {
    rotation: { x: 0, y: 0.4016049999997023, z: 0 },
  }, // Sniper
};

const BOUNDS = {
  left: -3,
  right: 3,
  top: 1.8,
  bottom: -1.8,
};

function seededUnit(value, salt) {
  const text = `${value}:${salt}`;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return (hash % 1000) / 1000;
}
// IMPORTANT : ne pas précharger tous, seulement le modèle choisi plus bas si tu veux
// (tu peux enlever le preload global que tu avais avant)

/**
 * Caméra 3D qui se déplace et rebondit sur les bords,
 * avec sélection ALÉATOIRE d’un modèle parmi CAMERA_MODELS.
 */
function FloatingModel({ modelPath }) {
  const resolvedPath = modelPath || CAMERA_MODELS[0];

  const { scene } = useGLTF(resolvedPath);
  const modelRef = useRef(null);

  // Limites de déplacement (élargies pour couvrir plus l'écran)
  const initialPosition = useMemo(() => {
    const preset = MODEL_INITIALS[resolvedPath];
    if (preset?.position) return preset.position;
    const { left, right, top, bottom } = BOUNDS;
    return {
      x: left + seededUnit(resolvedPath, "x") * (right - left),
      y: bottom + seededUnit(resolvedPath, "y") * (top - bottom),
    };
  }, [resolvedPath]);

  const initialRotation = useMemo(() => {
    const preset = MODEL_INITIALS[resolvedPath];
    return preset?.rotation || { x: 0, y: 0, z: 0 };
  }, [resolvedPath]);

  const initialVelocity = useMemo(() => {
    const speed = 0.06;
    const angle = seededUnit(resolvedPath, "velocity") * Math.PI * 2;
    return {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    };
  }, [resolvedPath]);

  const velocity = useRef(initialVelocity);

  useEffect(() => {
    velocity.current = initialVelocity;
    if (modelRef.current) {
      modelRef.current.position.set(initialPosition.x, initialPosition.y, 0);
      modelRef.current.rotation.set(initialRotation.x, initialRotation.y, initialRotation.z);
    }
  }, [initialVelocity, initialPosition, initialRotation]);

  const config = MODEL_CONFIG[resolvedPath] || { scale: [1, 1, 1] };

  useFrame((_, delta) => {
    if (!modelRef.current) return;

    const pos = modelRef.current.position;
    const vel = velocity.current;

    pos.x += vel.x * delta;
    pos.y += vel.y * delta;

    if (pos.x > BOUNDS.right) {
      pos.x = BOUNDS.right;
      vel.x *= -1;
    } else if (pos.x < BOUNDS.left) {
      pos.x = BOUNDS.left;
      vel.x *= -1;
    }

    if (pos.y > BOUNDS.top) {
      pos.y = BOUNDS.top;
      vel.y *= -1;
    } else if (pos.y < BOUNDS.bottom) {
      pos.y = BOUNDS.bottom;
      vel.y *= -1;
    }

    modelRef.current.rotation.y += 0.05 * delta;
  });

  return (
    <primitive
      ref={modelRef}
      object={scene}
      position={[initialPosition.x, initialPosition.y, 0]}
      scale={config.scale} // ajuste si un modèle est trop grand/petit
    />
  );
}

export default FloatingModel;
