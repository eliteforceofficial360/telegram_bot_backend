import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { motion } from 'framer-motion';

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
  const [glbLoaded, setGlbLoaded] = useState(false);

  useEffect(() => {
    isMiningRef.current = isMiningActive;
  }, [isMiningActive]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = 240;
    const height = 240;

    // ── 1. Scene, Camera, Renderer ─────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // ── 2. Lights ──────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffd700, 3.5);
    dirLight1.position.set(5, 5, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff8a00, 2.5);
    dirLight2.position.set(-5, -3, 3);
    scene.add(dirLight2);

    const pointLight = new THREE.PointLight(0xffd700, 3.0, 10);
    pointLight.position.set(0, 0, 4);
    scene.add(pointLight);

    // ── 3. Model Loading ───────────────────────────────────────────────────
    let modelGroup: THREE.Group | null = null;
    const loader = new GLTFLoader();

    loader.load(
      '/3dsvg.glb',
      (gltf) => {
        modelGroup = gltf.scene;

        // Apply Gold Material / Points Material styling
        modelGroup.traverse((child) => {
          if ((child as THREE.Points).isPoints) {
            const pts = child as THREE.Points;
            pts.material = new THREE.PointsMaterial({
              color: 0xffb300,
              size: 0.035,
              transparent: true,
              opacity: 0.95,
              blending: THREE.AdditiveBlending,
            });
          } else if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.material = new THREE.MeshStandardMaterial({
              color: 0xffd700,
              metalness: 0.9,
              roughness: 0.2,
            });
          }
        });

        // Center and scale bounding box
        const box = new THREE.Box3().setFromObject(modelGroup);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        modelGroup.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
          const scale = 2.6 / maxDim;
          modelGroup.scale.set(scale, scale, scale);
        }

        scene.add(modelGroup);
        setGlbLoaded(true);
      },
      undefined,
      (err) => {
        console.warn('[MiningCoin3D] GLB Load fallback:', err);
      }
    );

    // ── 4. Animation Loop ──────────────────────────────────────────────────
    let reqId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);

      if (modelGroup) {
        if (isMiningRef.current) {
          modelGroup.rotation.y += 0.022;
          const elapsedTime = clock.getElapsedTime();
          modelGroup.position.y = Math.sin(elapsedTime * 2) * 0.08;
          modelGroup.rotation.x = Math.sin(elapsedTime * 1.5) * 0.04;
        } else {
          modelGroup.rotation.y = THREE.MathUtils.lerp(modelGroup.rotation.y, 0, 0.05);
          modelGroup.position.y = THREE.MathUtils.lerp(modelGroup.position.y, 0, 0.05);
          modelGroup.rotation.x = THREE.MathUtils.lerp(modelGroup.rotation.x, 0, 0.05);
        }
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
    <div
      className={`relative w-full h-full flex items-center justify-center select-none ${className}`}
    >
      {/* Ambient Glow Aura */}
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

      {/* Three.js 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className={`w-[240px] h-[240px] relative z-10 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${
          glbLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback Gold EF Emblem until 3D GLB initializes */}
      {!glbLoaded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <motion.div
            className="w-52 h-52 rounded-full relative flex items-center justify-center bg-gradient-to-br from-[#FFD700] via-[#FF8A00] to-[#804000] p-1.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] border-4 border-[#FFE5B4]/50 overflow-hidden"
            animate={isMiningActive ? { rotateY: [0, 180, 360] } : { rotateY: 0 }}
            transition={isMiningActive ? { repeat: Infinity, duration: 4, ease: 'linear' } : { duration: 0.4 }}
          >
            <svg viewBox="0 0 1625 1625" className="w-[90%] h-[90%] object-contain">
              <defs>
                <linearGradient id="fallbackGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF9D2" />
                  <stop offset="50%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#FF8A00" />
                </linearGradient>
              </defs>
              <circle cx="812.5" cy="812.5" r="700" stroke="url(#fallbackGold)" strokeWidth="24" fill="none" opacity="0.85" />
              <g transform="translate(812.5, 812.5) scale(1.15) translate(-812.5, -812.5)">
                <path d="M812.5 320 L1180 687.5 L812.5 1055 L445 687.5 Z" fill="none" stroke="url(#fallbackGold)" strokeWidth="48" strokeLinejoin="round" />
                <path d="M660 510 L880 510 L660 730 L880 730 M660 620 L840 620" fill="none" stroke="url(#fallbackGold)" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M880 510 L1020 510 M880 620 L980 620 M880 510 L880 860" fill="none" stroke="url(#fallbackGold)" strokeWidth="56" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </svg>
          </motion.div>
        </div>
      )}
    </div>
  );
};
