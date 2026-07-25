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

    // Use the container's actual dimensions for perfect fill
    const SIZE = 220;

    // ── Scene Setup ────────────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap at 1.5 for mobile perf
    renderer.shadowMap.enabled = false; // GPU optimization

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    // Style canvas for perfect centering — no margin/padding shifts
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.margin = '0';

    // ── Lights ─────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 2.5));

    const keyLight = new THREE.DirectionalLight(0xfffae0, 3.8);
    keyLight.position.set(4, 5, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffa800, 2.5);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 1.8);
    backLight.position.set(0, 0, -4);
    scene.add(backLight);

    const rimLight = new THREE.DirectionalLight(0xFFD700, 2.0);
    rimLight.position.set(2, -3, 2);
    scene.add(rimLight);

    const pointLight = new THREE.PointLight(0xffd700, 3.5, 12);
    pointLight.position.set(0, 1.5, 3);
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

        // Tilt XZ-plane emblem face into XY plane facing camera (+Z)
        model.rotation.x = -Math.PI / 2;

        const pivot = new THREE.Group();
        pivot.add(model);

        // Compute exact bounding box of rotated model
        const box = new THREE.Box3().setFromObject(pivot);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetScale = 1.9 / (maxDim || 1);

        // ✅ Center the model geometry exactly at pivot origin (0,0,0)
        model.position.x -= center.x;
        model.position.y -= center.y;
        model.position.z -= center.z;

        pivot.scale.setScalar(targetScale);
        // ✅ No positional offset — dead center in world space
        pivot.position.set(0, 0, 0);

        // Enhance material quality
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((mat) => {
                if ('metalness' in mat) {
                  (mat as THREE.MeshStandardMaterial).metalness = Math.max(
                    (mat as THREE.MeshStandardMaterial).metalness || 0.7, 0.7
                  );
                }
                if ('roughness' in mat) {
                  (mat as THREE.MeshStandardMaterial).roughness = Math.min(
                    (mat as THREE.MeshStandardMaterial).roughness || 0.25, 0.25
                  );
                }
                // Boost emissive slightly for completed state glow
                if ('emissive' in mat && isMiningCompleted) {
                  (mat as THREE.MeshStandardMaterial).emissive = new THREE.Color(0xffa500);
                  (mat as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
                }
              });
            }
          }
        });

        modelGroup.add(pivot);
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
        modelGroup.rotation.y += 0.020;
        modelGroup.rotation.x = Math.sin(t * 1.1) * 0.055;
        modelGroup.position.y = Math.sin(t * 1.9) * 0.055;
      } else if (isMiningCompleted) {
        // Completed: slow proud display spin + gentle float
        modelGroup.rotation.y += 0.007;
        modelGroup.rotation.x = Math.sin(t * 0.8) * 0.025;
        modelGroup.position.y = Math.sin(t * 1.4) * 0.04;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showGlow = isMiningActive || isMiningCompleted;

  // Single box-shadow glow — GPU composited, zero CPU paint cost.
  // Replaces the old 3x filter:blur() divs which each triggered a paint pass.
  const glowShadow = isMiningCompleted
    ? '0 0 40px rgba(255,200,0,0.45), 0 0 80px rgba(255,138,0,0.22), 0 0 4px rgba(255,240,100,0.4)'
    : isMiningActive
    ? '0 0 35px rgba(0,229,255,0.40), 0 0 70px rgba(0,136,255,0.18), 0 0 4px rgba(100,240,255,0.3)'
    : 'none';

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
    >
      {/* ── 3D Canvas with GPU-composited glow via box-shadow ── */}
      <div
        ref={mountRef}
        className="relative z-10 pointer-events-none flex items-center justify-center"
        style={{
          width: '220px',
          height: '220px',
          borderRadius: '50%',
          overflow: 'hidden',
          boxShadow: showGlow ? glowShadow : 'none',
          // Subtle inner radial backdrop — painted once, static, no animation
          background: isMiningCompleted
            ? 'radial-gradient(circle at 40% 35%, rgba(255,200,50,0.07) 0%, rgba(255,138,0,0.03) 50%, transparent 75%)'
            : 'radial-gradient(circle at 40% 35%, rgba(0,229,255,0.04) 0%, transparent 70%)',
          transition: 'box-shadow 0.6s ease',
          willChange: 'box-shadow',
        }}
      />
    </div>
  );
};
