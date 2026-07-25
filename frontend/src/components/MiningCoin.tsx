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

    // ── Scene, Camera, Renderer ──────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(SIZE, SIZE);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    while (container.firstChild) container.removeChild(container.firstChild);
    container.appendChild(renderer.domElement);

    // ── Gold Canvas Texture (EF Emblem) ────────────────────────────────────
    const makeEmblemTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d')!;
      const cx = 256, cy = 256, r = 230;

      // Deep gold background gradient
      const bg = ctx.createRadialGradient(cx - 40, cy - 50, 30, cx, cy, r);
      bg.addColorStop(0, '#FFE066');
      bg.addColorStop(0.4, '#FFA800');
      bg.addColorStop(0.75, '#C07000');
      bg.addColorStop(1, '#7A4000');
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Outer rim light ring
      ctx.strokeStyle = 'rgba(255,240,180,0.6)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
      ctx.stroke();

      // Dashed inner milled ring
      ctx.save();
      ctx.strokeStyle = 'rgba(255,240,160,0.45)';
      ctx.lineWidth = 5;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.arc(cx, cy, r - 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Specular highlight
      const hiGrad = ctx.createRadialGradient(cx - 60, cy - 70, 10, cx, cy, r);
      hiGrad.addColorStop(0, 'rgba(255,255,220,0.55)');
      hiGrad.addColorStop(0.5, 'rgba(255,220,100,0.10)');
      hiGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hiGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // ── Diamond outline ────────────────────────────────
      const ds = 130;
      ctx.strokeStyle = 'rgba(255,245,200,0.95)';
      ctx.lineWidth = 9;
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,200,50,0.8)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ds);
      ctx.lineTo(cx + ds, cy);
      ctx.lineTo(cx, cy + ds);
      ctx.lineTo(cx - ds, cy);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner diamond ring
      const ds2 = 100;
      ctx.strokeStyle = 'rgba(255,245,200,0.4)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - ds2);
      ctx.lineTo(cx + ds2, cy);
      ctx.lineTo(cx, cy + ds2);
      ctx.lineTo(cx - ds2, cy);
      ctx.closePath();
      ctx.stroke();

      // ── EF Monogram ─────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,245,200,0.98)';
      ctx.lineWidth = 13;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255,200,50,1)';
      ctx.shadowBlur = 14;

      // "E" - left stroke
      ctx.beginPath();
      ctx.moveTo(cx - 68, cy - 60);
      ctx.lineTo(cx - 68, cy + 60);
      ctx.stroke();
      // "E" - top bar
      ctx.beginPath();
      ctx.moveTo(cx - 68, cy - 60);
      ctx.lineTo(cx - 10, cy - 60);
      ctx.stroke();
      // "E" - middle bar
      ctx.beginPath();
      ctx.moveTo(cx - 68, cy);
      ctx.lineTo(cx - 18, cy);
      ctx.stroke();
      // "E" - bottom bar
      ctx.beginPath();
      ctx.moveTo(cx - 68, cy + 60);
      ctx.lineTo(cx - 10, cy + 60);
      ctx.stroke();

      // "F" - vertical
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy - 60);
      ctx.lineTo(cx + 10, cy + 60);
      ctx.stroke();
      // "F" - top bar
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy - 60);
      ctx.lineTo(cx + 65, cy - 60);
      ctx.stroke();
      // "F" - middle bar
      ctx.beginPath();
      ctx.moveTo(cx + 10, cy);
      ctx.lineTo(cx + 50, cy);
      ctx.stroke();

      ctx.shadowBlur = 0;
      return new THREE.CanvasTexture(canvas);
    };

    // ── Coin Body Geometry ───────────────────────────────────────────────────
    const coinGroup = new THREE.Group();

    // Front face disc
    const discGeo = new THREE.CircleGeometry(1.5, 128);
    const discMat = new THREE.MeshStandardMaterial({
      map: makeEmblemTexture(),
      metalness: 0.7,
      roughness: 0.25,
    });
    const frontDisc = new THREE.Mesh(discGeo, discMat);
    frontDisc.position.z = 0.13;
    coinGroup.add(frontDisc);

    // Back face disc
    const backGeo = new THREE.CircleGeometry(1.5, 128);
    const backMat = new THREE.MeshStandardMaterial({
      color: 0xC07000,
      metalness: 0.85,
      roughness: 0.30,
    });
    const backDisc = new THREE.Mesh(backGeo, backMat);
    backDisc.rotation.y = Math.PI;
    backDisc.position.z = -0.13;
    coinGroup.add(backDisc);

    // Edge cylinder
    const edgeGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.26, 128, 1, true);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xB06000,
      metalness: 0.9,
      roughness: 0.35,
    });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    edgeMesh.rotation.x = Math.PI / 2;
    coinGroup.add(edgeMesh);

    // Milled dashes on edge
    for (let i = 0; i < 80; i++) {
      const angle = (i / 80) * Math.PI * 2;
      const dashGeo = new THREE.BoxGeometry(0.025, 0.26, 0.03);
      const dashMat = new THREE.MeshStandardMaterial({ color: 0xFFD060, metalness: 0.9, roughness: 0.2 });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.position.set(Math.cos(angle) * 1.52, 0, Math.sin(angle) * 1.52);
      dash.lookAt(0, 0, 0);
      coinGroup.add(dash);
    }

    scene.add(coinGroup);

    // ── Lights ───────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 1.4));

    const key = new THREE.DirectionalLight(0xffe8a0, 3.5);
    key.position.set(3, 4, 5);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xff9900, 1.8);
    fill.position.set(-4, -2, 2);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 1.2);
    rim.position.set(0, 0, -5);
    scene.add(rim);

    const pointL = new THREE.PointLight(0xffd700, 2.5, 10);
    pointL.position.set(0, 2, 3);
    scene.add(pointL);

    // ── Animation ─────────────────────────────────────────────────────────────
    let reqId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (isMiningRef.current) {
        coinGroup.rotation.y += 0.022;
        coinGroup.rotation.x = Math.sin(t * 1.2) * 0.07;
        coinGroup.position.y = Math.sin(t * 2) * 0.07;
      } else {
        coinGroup.rotation.y = THREE.MathUtils.lerp(coinGroup.rotation.y, 0, 0.06);
        coinGroup.rotation.x = THREE.MathUtils.lerp(coinGroup.rotation.x, 0, 0.06);
        coinGroup.position.y = THREE.MathUtils.lerp(coinGroup.position.y, 0, 0.06);
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
      <div className={`absolute inset-[-16px] rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
        isMiningActive ? 'bg-[#FF8A00]/50 animate-pulse' : isMiningCompleted ? 'bg-[#FFD700]/55 animate-pulse' : 'bg-[#FF8A00]/15'
      }`} />
      <div className={`absolute inset-[-4px] rounded-full blur-xl transition-all duration-700 pointer-events-none ${
        isMiningActive ? 'bg-[#FFD700]/35' : isMiningCompleted ? 'bg-[#FFD700]/40' : 'bg-[#FF8A00]/20'
      }`} />
      {/* 3D Canvas */}
      <div
        ref={mountRef}
        className="w-[240px] h-[240px] relative z-10 pointer-events-none"
      />
    </div>
  );
};
