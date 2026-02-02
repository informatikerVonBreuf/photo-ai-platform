// src/components/BackgroundScene.jsx
import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import FloatingModel from './FloatingModel';

export default function BackgroundScene({ modelPath = null }) {
  const [ambientColor, setAmbientColor] = useState('#6c7cff');

  useEffect(() => {
    const target = document.querySelector('.shell') || document.body;

    const updateFromTone = () => {
      const styles = getComputedStyle(target);
      const accent = styles.getPropertyValue('--accent')?.trim();
      if (accent) {
        setAmbientColor(accent);
      }
    };

    updateFromTone();

    const observer = new MutationObserver(updateFromTone);
    observer.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });

    return () => observer.disconnect();
  }, []);

  return (
    <Canvas
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
      }}
      camera={{
        position: [0, 0, 6],
        fov: 50,
      }}
    >
      <ambientLight intensity={0.5} color={ambientColor} />
      <directionalLight
        position={[5, 5, 8]}
        intensity={1.2}
        color="#ffffff"
        castShadow
      />

      {modelPath ? <FloatingModel modelPath={modelPath} /> : null}

      <color attach="background" args={['rgb(19, 17, 20)']} />
    </Canvas>
  );
}
