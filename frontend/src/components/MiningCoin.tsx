import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

interface MiningCoinProps {
  isMiningActive: boolean;
  isMiningCompleted: boolean;
  className?: string;
}

export const MiningCoin: React.FC<MiningCoinProps> = ({
  isMiningActive,
  isMiningCompleted,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isMiningRef = useRef<boolean>(isMiningActive);

  useEffect(() => {
    isMiningRef.current = isMiningActive;
  }, [isMiningActive]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 240;
    const height = container.clientHeight || 240;

    // ── 1. Scene, Camera, Renderer ─────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // Remove any previous canvas
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // ── 2. Lights ──────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffd700, 3.0);
    dirLight1.position.set(5, 5, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff8a00, 2.0);
    dirLight2.position.set(-5, -3, 3);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffd700, 2.5, 10);
    pointLight.position.set(0, 0, 4);
    scene.add(pointLight);

    // ── 3. Model Loading ───────────────────────────────────────────────────
    let modelGroup: THREE.Group | null = null;
    const loader = new GLTFLoader();

    loader.load(
      '/3dsvg.glb',
      (gltf) => {
        modelGroup = gltf.scene;

        // Auto-center and scale model bounding box
        const box = new THREE.Box3().setFromObject(modelGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        modelGroup.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 2.4 / maxDim;
          modelGroup.scale.set(scale, scale, scale);
        }

        scene.add(modelGroup);
      },
      undefined,
      (err) => {
        console.warn('[MiningCoin3D] GLB Load warning:', err);
      }
    );

    // ── 4. Animation Loop ──────────────────────────────────────────────────
    let reqId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (modelGroup) {
        if (isMiningRef.current) {
          // Smooth 3D Rotation when mining is ACTIVE
          modelGroup.rotation.y += 0.025;
          const elapsedTime = clock.getElapsedTime();
          modelGroup.position.y = Math.sin(elapsedTime * 2) * 0.08;
          modelGroup.rotation.x = Math.sin(elapsedTime * 1.5) * 0.05;
        } else {
          // Still / Paused when mining is NOT ACTIVE
          modelGroup.rotation.y = THREE.MathUtils.lerp(modelGroup.rotation.y, 0, 0.05);
          modelGroup.position.y = THREE.MathUtils.lerp(modelGroup.position.y, 0, 0.05);
          modelGroup.rotation.x = THREE.MathUtils.lerp(modelGroup.rotation.x, 0, 0.05);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // ── 5. Cleanup ─────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(reqId);
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
    >
      {/* Glow Effects Behind 3D Canvas */}
      <div
        className={`absolute inset-[-16px] rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
          isMiningActive
            ? 'bg-[#FF8A00]/45 animate-pulse'
            : isMiningCompleted
            ? 'bg-[#FFD700]/55 animate-pulse'
            : 'bg-[#FF8A00]/15'
        }`}
      />
      <div
        className={`absolute inset-[-4px] rounded-full blur-xl transition-all duration-700 pointer-events-none ${
          isMiningActive
            ? 'bg-[#00E5FF]/35'
            : isMiningCompleted
            ? 'bg-[#FFD700]/40'
            : 'bg-[#FF8A00]/20'
        }`}
      />

      {/* Three.js 3D Model Mount Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-full relative z-10 flex items-center justify-center pointer-events-none"
      />
    </div>
  );
};
