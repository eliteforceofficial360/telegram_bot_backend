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
    const SIZE = 240;

    // ── Scene Setup ────────────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    // ── Lights ─────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 2.2));

    const keyLight = new THREE.DirectionalLight(0xfffae0, 3.5);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffa800, 2.2);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 1.5);
    backLight.position.set(0, 0, -4);
    scene.add(backLight);

    const pointLight = new THREE.PointLight(0xffd700, 3.0, 10);
    pointLight.position.set(0, 2, 3);
    scene.add(pointLight);

    // ── Model Group ───────────────────────────────────────────────
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // Load GLB Model
    const loader = new GLTFLoader();
    loader.load(
      '/mining-coin.glb',
      (gltf) => {
        const model = gltf.scene;

        // Auto-center and fit model size
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 2.4 / (maxDim || 1);

        model.position.sub(center); // Center geometry
        model.scale.setScalar(targetScale);

        // Enhance material lighting response
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((mat) => {
                if ('metalness' in mat) (mat as THREE.MeshStandardMaterial).metalness = Math.max((mat as THREE.MeshStandardMaterial).metalness || 0.7, 0.6);
                if ('roughness' in mat) (mat as THREE.MeshStandardMaterial).roughness = Math.min((mat as THREE.MeshStandardMaterial).roughness || 0.3, 0.35);
              });
            }
          }
        });

        modelGroup.add(model);
      },
      undefined,
      (err) => {
        console.error('Error loading 3D GLB model:', err);
      }
    );

    // ── Animation Loop ─────────────────────────────────────────────
    let reqId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (isMiningRef.current) {
        // Active: rotate around Y-axis with gentle wobble
        modelGroup.rotation.y += 0.022;
        modelGroup.rotation.x = Math.sin(t * 1.2) * 0.06;
        modelGroup.position.y = Math.sin(t * 2.0) * 0.06;
      } else {
        // Idle: smoothly return to rest (facing forward)
        modelGroup.rotation.y = THREE.MathUtils.lerp(modelGroup.rotation.y, 0, 0.06);
        modelGroup.rotation.x = THREE.MathUtils.lerp(modelGroup.rotation.x, 0, 0.06);
        modelGroup.position.y = THREE.MathUtils.lerp(modelGroup.position.y, 0, 0.06);
      }

      renderer.render(scene, camera);
    };
    animate();

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
    <div className={`relative w-full h-full flex items-center justify-center select-none ${className}`}>
      {/* Ambient Glow */}
      {(isMiningActive || isMiningCompleted) && (
        <>
          <div className={`absolute inset-[-18px] rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            isMiningActive ? 'bg-[#FF8A00]/50 animate-pulse' : 'bg-[#FFD700]/60 animate-pulse'
          }`} />
          <div className={`absolute inset-[-4px] rounded-full blur-lg pointer-events-none transition-all duration-700 ${
            isMiningActive ? 'bg-[#FFD700]/35' : 'bg-[#FFD700]/45'
          }`} />
        </>
      )}

      {/* 3D Canvas */}
      <div
        ref={mountRef}
        className="w-[240px] h-[240px] rounded-full overflow-hidden relative z-10 pointer-events-none"
      />
    </div>
  );
};
