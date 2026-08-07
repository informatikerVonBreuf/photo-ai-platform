import { useEffect, useRef } from "react";
import * as THREE from "three";

function addBox(group, geometry, material, position, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
}

function createCameraModel() {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x4652a8,
    emissive: 0x11183f,
    emissiveIntensity: 0.75,
    metalness: 0.64,
    roughness: 0.2,
  });
  const detailMaterial = new THREE.MeshStandardMaterial({
    color: 0x121526,
    emissive: 0x070913,
    metalness: 0.86,
    roughness: 0.16,
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xff4d8d,
    emissive: 0x6b092f,
    emissiveIntensity: 1.4,
    metalness: 0.38,
    roughness: 0.16,
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x62e8ff,
    emissive: 0x06394d,
    emissiveIntensity: 1.1,
    metalness: 0.16,
    roughness: 0.04,
    transmission: 0.48,
    thickness: 0.8,
  });
  const cyanLineMaterial = new THREE.LineBasicMaterial({
    color: 0x6cecff,
    transparent: true,
    opacity: 0.82,
  });
  const pinkLineMaterial = new THREE.LineBasicMaterial({
    color: 0xff4d8d,
    transparent: true,
    opacity: 0.66,
  });

  const body = addBox(
    group,
    new THREE.BoxGeometry(3.25, 2.02, 1.1, 3, 3, 3),
    bodyMaterial,
    [0, 0, 0]
  );
  const bodyOutline = new THREE.LineSegments(
    new THREE.EdgesGeometry(body.geometry),
    cyanLineMaterial
  );
  bodyOutline.position.copy(body.position);
  group.add(bodyOutline);

  addBox(
    group,
    new THREE.BoxGeometry(1.15, 0.48, 0.72),
    detailMaterial,
    [-0.72, 1.18, -0.02]
  );
  addBox(
    group,
    new THREE.BoxGeometry(0.58, 0.28, 0.2),
    glassMaterial,
    [0.78, 0.68, 0.68]
  );
  addBox(
    group,
    new THREE.BoxGeometry(0.42, 0.16, 0.32),
    accentMaterial,
    [-1.05, 0.72, 0.7]
  );

  const lensBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 0.94, 0.82, 48),
    detailMaterial
  );
  lensBase.rotation.x = Math.PI / 2;
  lensBase.position.set(0.35, -0.05, 0.94);
  group.add(lensBase);

  const lensRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.69, 0.1, 18, 64),
    accentMaterial
  );
  lensRing.position.set(0.35, -0.05, 1.39);
  group.add(lensRing);

  const lensGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.61, 64),
    glassMaterial
  );
  lensGlass.position.set(0.35, -0.05, 1.48);
  group.add(lensGlass);

  const focusRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.53, 0.035, 12, 64),
    glassMaterial
  );
  focusRing.position.set(0.35, -0.05, 1.52);
  group.add(focusRing);

  const shutter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.12, 32),
    accentMaterial
  );
  shutter.position.set(1.05, 1.08, 0.1);
  group.add(shutter);

  const hologramFrame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(4.65, 3.45, 0.08)),
    cyanLineMaterial
  );
  hologramFrame.position.set(0, 0, -0.92);
  hologramFrame.rotation.z = -0.06;
  group.add(hologramFrame);

  const orbitalRing = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(
      Array.from({ length: 96 }, (_, index) => {
        const angle = (index / 96) * Math.PI * 2;
        return new THREE.Vector3(
          Math.cos(angle) * 2.35,
          Math.sin(angle) * 1.72,
          -0.78
        );
      })
    ),
    pinkLineMaterial
  );
  orbitalRing.rotation.z = 0.18;
  group.add(orbitalRing);

  group.rotation.set(-0.08, -0.34, 0.04);
  return group;
}

export default function BackgroundScene() {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xdde7ff, 0x11091f, 2.2);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 4.6);
    keyLight.position.set(4, 5, 7);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x6cecff, 34, 18);
    rimLight.position.set(-4, -1, 4);
    scene.add(rimLight);
    const pinkLight = new THREE.PointLight(0xff4d8d, 28, 16);
    pinkLight.position.set(4, 2, 3);
    scene.add(pinkLight);

    const model = createCameraModel();
    model.position.set(4.1, 2.25, -0.35);
    model.scale.setScalar(0.42);
    scene.add(model);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const clock = new THREE.Clock();
    let animationFrame = 0;
    let baseY = -0.15;
    const pointer = new THREE.Vector2();

    function handlePointerMove(event) {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
    }

    function resize() {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const compact = width < 900;
      model.position.x = compact ? 0.7 : 4.1;
      baseY = compact ? -1.25 : 2.25;
      model.position.y = baseY;
      model.scale.setScalar(compact ? 0.68 : 0.42);
    }

    function render() {
      const elapsed = clock.getElapsedTime();
      if (!prefersReducedMotion) {
        model.rotation.y =
          -0.34 + Math.sin(elapsed * 0.28) * 0.14 + pointer.x * 0.08;
        model.rotation.x =
          -0.08 + Math.cos(elapsed * 0.34) * 0.045 - pointer.y * 0.05;
        model.position.y +=
          (baseY + Math.sin(elapsed * 0.5) * 0.13 - model.position.y) * 0.035;
      }
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointerMove);
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={containerRef} className="backgroundScene" aria-hidden="true" />;
}
