import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

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

    // ── Scene ────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0, 4.8);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1); // solid black background
    renderer.shadowMap.enabled = false;

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    // ── Canvas Texture: EF Gold Coin Face ────────────────────
    const makeFaceTexture = () => {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 512;
      const ctx = c.getContext('2d')!;
      const cx = 256, cy = 256;

      // Deep gold radial base
      const bg = ctx.createRadialGradient(cx - 50, cy - 60, 20, cx, cy, 255);
      bg.addColorStop(0,   '#FFE566');
      bg.addColorStop(0.35,'#FFA800');
      bg.addColorStop(0.70,'#B86800');
      bg.addColorStop(1,   '#7A3E00');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(cx, cy, 252, 0, Math.PI * 2); ctx.fill();

      // Outer black ring border
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(cx, cy, 248, 0, Math.PI * 2); ctx.stroke();

      // Thin milled groove ring
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 18;
      ctx.beginPath(); ctx.arc(cx, cy, 225, 0, Math.PI * 2); ctx.stroke();

      // Inner gold bevel ring
      const bev = ctx.createLinearGradient(cx - 225, cy, cx + 225, cy);
      bev.addColorStop(0,   '#FF9A00');
      bev.addColorStop(0.5, '#FFD060');
      bev.addColorStop(1,   '#B86800');
      ctx.strokeStyle = bev;
      ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(cx, cy, 225, 0, Math.PI * 2); ctx.stroke();

      // Specular highlight (top-left)
      const hi = ctx.createRadialGradient(cx - 80, cy - 90, 10, cx, cy, 230);
      hi.addColorStop(0,   'rgba(255,255,210,0.65)');
      hi.addColorStop(0.45,'rgba(255,230,100,0.10)');
      hi.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.fillStyle = hi;
      ctx.beginPath(); ctx.arc(cx, cy, 250, 0, Math.PI * 2); ctx.fill();

      // ── Diamond outline ──────────────────────────────────────
      const D = 138;
      ctx.save();
      ctx.strokeStyle = 'rgba(10,8,0,0.85)';
      ctx.lineWidth = 16;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx,     cy - D);
      ctx.lineTo(cx + D, cy);
      ctx.lineTo(cx,     cy + D);
      ctx.lineTo(cx - D, cy);
      ctx.closePath();
      ctx.stroke();
      // gold fill inside diamond
      const dFill = ctx.createRadialGradient(cx - 20, cy - 20, 10, cx, cy, D);
      dFill.addColorStop(0, 'rgba(255,230,100,0.18)');
      dFill.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dFill;
      ctx.fill();
      // bright diamond rim
      ctx.strokeStyle = 'rgba(255,245,180,0.88)';
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.restore();

      // ── EF Monogram ──────────────────────────────────────────
      const draw = (fn: () => void, color: string, width: number) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        fn();
        ctx.stroke();
        ctx.restore();
      };

      // Shadow layer
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 10;

      // 'E' – dark outline
      draw(() => {
        ctx.beginPath(); ctx.moveTo(cx-74,cy-62); ctx.lineTo(cx-74,cy+62);
        ctx.moveTo(cx-74,cy-62); ctx.lineTo(cx-12,cy-62);
        ctx.moveTo(cx-74,cy);    ctx.lineTo(cx-20,cy);
        ctx.moveTo(cx-74,cy+62); ctx.lineTo(cx-12,cy+62);
      }, 'rgba(0,0,0,0.7)', 22);

      // 'F' – dark outline
      draw(() => {
        ctx.beginPath(); ctx.moveTo(cx+8,cy-62);  ctx.lineTo(cx+8,cy+62);
        ctx.moveTo(cx+8,cy-62);  ctx.lineTo(cx+70,cy-62);
        ctx.moveTo(cx+8,cy);     ctx.lineTo(cx+55,cy);
      }, 'rgba(0,0,0,0.7)', 22);

      ctx.shadowBlur = 0;

      // 'E' – bright gold
      draw(() => {
        ctx.beginPath(); ctx.moveTo(cx-74,cy-62); ctx.lineTo(cx-74,cy+62);
        ctx.moveTo(cx-74,cy-62); ctx.lineTo(cx-12,cy-62);
        ctx.moveTo(cx-74,cy);    ctx.lineTo(cx-20,cy);
        ctx.moveTo(cx-74,cy+62); ctx.lineTo(cx-12,cy+62);
      }, 'rgba(255,248,200,0.97)', 13);

      // 'F' – bright gold
      draw(() => {
        ctx.beginPath(); ctx.moveTo(cx+8,cy-62);  ctx.lineTo(cx+8,cy+62);
        ctx.moveTo(cx+8,cy-62);  ctx.lineTo(cx+70,cy-62);
        ctx.moveTo(cx+8,cy);     ctx.lineTo(cx+55,cy);
      }, 'rgba(255,248,200,0.97)', 13);

      return new THREE.CanvasTexture(c);
    };

    // Back face texture (plain dark gold)
    const makeBackTexture = () => {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 256;
      const ctx = c.getContext('2d')!;
      const cx = 128, cy = 128;
      const g = ctx.createRadialGradient(cx, cy - 40, 10, cx, cy, 128);
      g.addColorStop(0, '#C07000');
      g.addColorStop(1, '#6A3800');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 127, 0, Math.PI * 2); ctx.fill();
      return new THREE.CanvasTexture(c);
    };

    // ── Coin Geometry ────────────────────────────────────────
    const coinGroup = new THREE.Group();

    // Front face
    const frontGeo = new THREE.CircleGeometry(1.55, 128);
    const frontMesh = new THREE.Mesh(frontGeo, new THREE.MeshStandardMaterial({
      map: makeFaceTexture(),
      metalness: 0.65,
      roughness: 0.28,
    }));
    frontMesh.position.z = 0.14;
    coinGroup.add(frontMesh);

    // Back face
    const backGeo = new THREE.CircleGeometry(1.55, 128);
    const backMesh = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({
      map: makeBackTexture(),
      metalness: 0.8,
      roughness: 0.35,
    }));
    backMesh.rotation.y = Math.PI;
    backMesh.position.z = -0.14;
    coinGroup.add(backMesh);

    // Edge (clean cylinder, no spiky boxes)
    const edgeGeo = new THREE.CylinderGeometry(1.55, 1.55, 0.28, 128, 1, true);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xA05800,
      metalness: 0.92,
      roughness: 0.30,
    });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    edgeMesh.rotation.x = Math.PI / 2;
    coinGroup.add(edgeMesh);

    scene.add(coinGroup);

    // ── Lights ───────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 1.5));

    const key = new THREE.DirectionalLight(0xffe090, 4.0);
    key.position.set(3, 4, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xff9900, 2.0);
    fill.position.set(-4, -2, 2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(0, 0, -5);
    scene.add(rim);

    const ptLight = new THREE.PointLight(0xffcc00, 3.0, 12);
    ptLight.position.set(0, 2, 3);
    scene.add(ptLight);

    // ── Animation ────────────────────────────────────────────
    let reqId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (isMiningRef.current) {
        // Active: rotate + gentle float
        coinGroup.rotation.y += 0.022;
        coinGroup.rotation.x = Math.sin(t * 1.2) * 0.06;
        coinGroup.position.y = Math.sin(t * 2.0) * 0.06;
      } else {
        // Idle: smoothly return to rest
        coinGroup.rotation.y = THREE.MathUtils.lerp(coinGroup.rotation.y, 0, 0.05);
        coinGroup.rotation.x = THREE.MathUtils.lerp(coinGroup.rotation.x, 0, 0.05);
        coinGroup.position.y = THREE.MathUtils.lerp(coinGroup.position.y, 0, 0.05);
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
      {/* Glow ring only when mining/completed */}
      {(isMiningActive || isMiningCompleted) && (
        <>
          <div className={`absolute inset-[-18px] rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
            isMiningActive ? 'bg-[#FF8A00]/40 animate-pulse' : 'bg-[#FFD700]/50 animate-pulse'
          }`} />
          <div className={`absolute inset-[-4px] rounded-full blur-lg pointer-events-none transition-all duration-700 ${
            isMiningActive ? 'bg-[#FFD700]/30' : 'bg-[#FFD700]/40'
          }`} />
        </>
      )}

      {/* Three.js canvas — black bg, no overflow */}
      <div
        ref={mountRef}
        className="w-[240px] h-[240px] rounded-full overflow-hidden relative z-10 pointer-events-none"
      />
    </div>
  );
};
