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
// IMPORTANT : ne pas précharger tous, seulement le modèle choisi plus bas si tu veux
// (tu peux enlever le preload global que tu avais avant)

/**
 * Caméra 3D qui se déplace et rebondit sur les bords,
 * avec sélection ALÉATOIRE d’un modèle parmi CAMERA_MODELS.
 */
function FloatingModel({ modelPath }) {
  const randomPath = useMemo(() => {
    const index = Math.floor(Math.random() * CAMERA_MODELS.length);
    return CAMERA_MODELS[index];
  }, []);

  const resolvedPath = modelPath || randomPath;

  const { scene } = useGLTF(resolvedPath);
  const modelRef = useRef(null);

  // Limites de déplacement (élargies pour couvrir plus l'écran)
  const bounds = useRef({
    left: -3,
    right: 3,
    top: 1.8,
    bottom: -1.8,
  });

  const initialPosition = useMemo(() => {
    const preset = MODEL_INITIALS[resolvedPath];
    if (preset?.position) return preset.position;
    const { left, right, top, bottom } = bounds.current;
    return {
      x: left + Math.random() * (right - left),
      y: bottom + Math.random() * (top - bottom),
    };
  }, [resolvedPath]);

  const initialRotation = useMemo(() => {
    const preset = MODEL_INITIALS[resolvedPath];
    return preset?.rotation || { x: 0, y: 0, z: 0 };
  }, [resolvedPath]);

  const initialVelocity = useMemo(() => {
    const speed = 0.06;
    const angle = Math.random() * Math.PI * 2;
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (!modelRef.current) return;
      const { x, y, z } = modelRef.current.position;
      const { x: rx, y: ry, z: rz } = modelRef.current.rotation;
      console.log("[3D] position:", { x, y, z }, "rotation:", { x: rx, y: ry, z: rz });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const config = MODEL_CONFIG[resolvedPath] || { scale: [1, 1, 1] };

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
