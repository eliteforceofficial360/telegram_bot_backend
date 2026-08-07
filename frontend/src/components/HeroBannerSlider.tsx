import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AdminSettings } from '../lib/adminSettingsService';

interface HeroBannerSliderProps {
  adminSettings: AdminSettings;
  fallbackUrl?: string;
  defaultTitle?: string;
  heightClass?: string;
}

export const HeroBannerSlider: React.FC<HeroBannerSliderProps> = ({
  adminSettings,
  fallbackUrl = '/coin-logo.jpg',
  defaultTitle = '',
  heightClass = 'h-[136px] min-h-[136px]',
}) => {
  const validBanners = (adminSettings?.heroBanners || []).filter((b) => b && b.imageUrl);

  // Check if fallbackUrl is a custom uploaded banner (not a default asset path like /coin-logo.jpg or /coin.jpg)
  const isCustomFallback =
    fallbackUrl &&
    !fallbackUrl.startsWith('/coin') &&
    !fallbackUrl.includes('coin-logo') &&
    fallbackUrl.trim().length > 0;

  const activeBanners = validBanners.length > 0
    ? validBanners
    : isCustomFallback
      ? [{ id: 'custom_fallback', imageUrl: fallbackUrl, title: defaultTitle }]
      : [];

  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex >= activeBanners.length) {
      setCurrentIndex(0);
    }
  }, [activeBanners.length, currentIndex]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeBanners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [activeBanners.length]);

  if (activeBanners.length === 0) return null;

  const currentBanner = activeBanners[currentIndex] || activeBanners[0];

  return (
    <div
      className={`relative w-full ${heightClass} rounded-[24px] overflow-hidden border border-white/12 shadow-[0_15px_35px_rgba(0,0,0,0.6)] bg-[#090D1F] group select-none shrink-0`}
      style={{ contain: 'layout paint' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentBanner?.id || currentIndex}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          onClick={() => {
            const link = currentBanner?.linkUrl;
            if (link) {
              const tg = (window as any).Telegram?.WebApp;
              if (tg?.openTelegramLink && link.includes('t.me/')) tg.openTelegramLink(link);
              else window.open(link, '_blank');
            }
          }}
          className={`absolute inset-0 w-full h-full ${currentBanner?.linkUrl ? 'cursor-pointer' : ''}`}
        >
          {currentBanner?.imageUrl?.toLowerCase().includes('.mp4') ||
          currentBanner?.imageUrl?.toLowerCase().includes('.webm') ||
          currentBanner?.imageUrl?.toLowerCase().includes('.mov') ||
          currentBanner?.imageUrl?.toLowerCase().startsWith('data:video/') ? (
            <video
              src={currentBanner?.imageUrl}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentBanner?.imageUrl || fallbackUrl}
              alt={currentBanner?.title || 'Hero Banner'}
              className="w-full h-full object-cover"
              loading="eager"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          {currentBanner?.title && (
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-white font-bold text-sm drop-shadow-md truncate">
                {currentBanner.title}
              </p>
            </div>
          )}
          {activeBanners.length > 1 && (
            <div className="absolute bottom-2.5 right-3 flex items-center gap-1.5 z-10 bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
              {activeBanners.map((_, idx) => (
                <div
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    idx === currentIndex ? 'w-5 bg-[#00E5FF]' : 'w-1.5 bg-white/40 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
