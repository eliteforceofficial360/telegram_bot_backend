import React, { useEffect, useRef } from 'react';

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
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMiningActive) {
      video.currentTime = 0;
      video.play().catch((err) => console.log('Video play error:', err));
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [isMiningActive]);

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

      {/* Video Container - Perfect Circular Clip */}
      <div className="w-[240px] h-[240px] rounded-full overflow-hidden relative z-10 bg-black flex items-center justify-center shadow-[0_0_30px_rgba(255,138,0,0.3)] border border-[#FFD700]/20">
        <video
          ref={videoRef}
          src="/mining-coin-3d.mp4"
          loop
          muted
          playsInline
          autoPlay={isMiningActive}
          className="w-full h-full object-cover rounded-full"
        />
      </div>
    </div>
  );
};
