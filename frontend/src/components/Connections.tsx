import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X as CloseIcon } from 'lucide-react';
import { type TelegramUser } from '../lib/telegramUser';
import { type FirestoreUser, saveSocialConnection, removeSocialConnection, type SocialConnections } from '../lib/userService';
import { type AdminSettings } from '../lib/adminSettingsService';

interface ConnectionsProps {
  telegramUser: TelegramUser | null;
  dbUser: FirestoreUser | null;
  adminSettings: AdminSettings;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

type PlatformType = 'x' | 'discord' | 'tiktok' | 'instagram' | 'youtube' | 'reddit';

interface PlatformConfig {
  id: PlatformType;
  name: string;
  isOauth: boolean;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  inputPlaceholder: string;
  subtitle: string;
}

export const Connections = ({
  telegramUser,
  dbUser,
  adminSettings,
  showToast,
}: ConnectionsProps) => {
  const [activeModal, setActiveModal] = useState<PlatformType | null>(null);
  const [handleInput, setHandleInput] = useState('');
  const [saving, setSaving] = useState(false);

  const socialConnections: SocialConnections = dbUser?.socialConnections || {};

  const platforms: PlatformConfig[] = [
    {
      id: 'x',
      name: 'X',
      isOauth: true,
      color: '#FFFFFF',
      bgColor: '#000000',
      icon: (
        <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      inputPlaceholder: '@yourusername or x.com/yourusername',
      subtitle: 'Your X @handle or profile link',
    },
    {
      id: 'discord',
      name: 'Discord',
      isOauth: true,
      color: '#5865F2',
      bgColor: '#5865F2',
      icon: (
        <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028z" />
        </svg>
      ),
      inputPlaceholder: 'username or username#0000',
      subtitle: 'Your Discord username or ID',
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      isOauth: false,
      color: '#000000',
      bgColor: '#000000',
      icon: (
        <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.57-1.32 1.54-1.31 2.54.02.94.53 1.83 1.34 2.33.85.54 1.95.61 2.85.2.98-.43 1.67-1.37 1.79-2.43.04-3.27.02-6.55.03-9.82z" />
        </svg>
      ),
      inputPlaceholder: '@yourchannel or tiktok.com/@...',
      subtitle: 'Your channel link or @handle',
    },
    {
      id: 'instagram',
      name: 'Instagram',
      isOauth: false,
      color: '#E1306C',
      bgColor: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
      icon: (
        <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
      inputPlaceholder: '@yourprofile or instagram.com/...',
      subtitle: 'Your profile link or @handle',
    },
    {
      id: 'youtube',
      name: 'YouTube',
      isOauth: false,
      color: '#FF0000',
      bgColor: '#FF0000',
      icon: (
        <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      ),
      inputPlaceholder: '@yourchannel or youtube.com/@...',
      subtitle: 'Your channel link or @handle',
    },
    {
      id: 'reddit',
      name: 'Reddit',
      isOauth: false,
      color: '#FF4500',
      bgColor: '#FF4500',
      icon: (
        <svg className="w-5 h-5 fill-current text-white" viewBox="0 0 24 24">
          <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.196-.491.936 0 1.696.76 1.696 1.697 0 .638-.352 1.192-.871 1.485.016.166.026.334.026.503 0 2.56-2.977 4.636-6.649 4.636-3.67 0-6.648-2.076-6.648-4.636 0-.166.01-.334.026-.5-.523-.294-.877-.848-.877-1.487 0-.936.76-1.696 1.696-1.696.467 0 .888.182 1.196.49 1.194-.855 2.85-1.417 4.673-1.488l.942-4.41 3.253.684a1.246 1.246 0 0 1 1.168-.788zm-7.669 8.243c-.563 0-1.02.457-1.02 1.02 0 .562.457 1.018 1.02 1.018.562 0 1.018-.456 1.018-1.018 0-.563-.456-1.02-1.018-1.02zm5.318 0c-.563 0-1.019.457-1.019 1.02 0 .562.456 1.018 1.019 1.018.563 0 1.02-.456 1.02-1.018 0-.563-.457-1.02-1.02-1.02zm-5.041 3.655a.213.213 0 0 0-.15.063.213.213 0 0 0 0 .301c.78.78 2.046.78 2.827 0a.213.213 0 0 0 0-.301.213.213 0 0 0-.302 0c-.614.615-1.609.615-2.223 0a.214.214 0 0 0-.152-.063z" />
        </svg>
      ),
      inputPlaceholder: 'u/yourusername or reddit.com/user/...',
      subtitle: 'Your reddit username or profile link',
    },
  ];

  const openExternalUrl = (url: string) => {
    try {
      if ((window as any).Telegram?.WebApp?.openLink) {
        (window as any).Telegram.WebApp.openLink(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(url, '_blank');
    }
  };

  const getOAuthUrl = (platId: PlatformType): string => {
    if (platId === 'x') {
      const clientId = adminSettings.xClientId?.trim() || 'TTJzVW9MZEFlYXRHRmZTMHR6Si06MTpjaQ';
      const redirectUri = encodeURIComponent(window.location.origin);
      const scope = encodeURIComponent('tweet.read users.read follows.read like.read offline.access');
      return `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=x_auth&code_challenge=challenge&code_challenge_method=plain`;
    }
    if (platId === 'discord') {
      const clientId = adminSettings.discordClientId?.trim();
      const baseAuthUrl = adminSettings.discordAuthUrl?.trim();
      if (baseAuthUrl && baseAuthUrl.length > 30 && !baseAuthUrl.endsWith('=')) return baseAuthUrl;
      if (!clientId) return '';
      return `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&scope=identify`;
    }
    return '';
  };

  const handleOpenConnectModal = (plat: PlatformConfig) => {
    if (!telegramUser) {
      showToast('Please open in Telegram to link your social accounts.', 'warning');
      return;
    }

    setHandleInput('');
    setActiveModal(plat.id);

    if (plat.isOauth) {
      const oauthUrl = getOAuthUrl(plat.id);
      if (oauthUrl) {
        openExternalUrl(oauthUrl);
        showToast(`Opening ${plat.name} OAuth 2.0 authorization...`, 'info');
      }
    }
  };

  const handleSaveConnection = async () => {
    if (!telegramUser || !activeModal) return;

    const finalValue = handleInput.trim();

    if (!finalValue) {
      showToast('Please enter a valid username, handle or link.', 'warning');
      return;
    }

    setSaving(true);
    const success = await saveSocialConnection(telegramUser.id, activeModal, finalValue);
    setSaving(false);

    if (success) {
      showToast(`✅ Successfully linked ${activeModal.toUpperCase()} account!`, 'success');
      setActiveModal(null);
    } else {
      showToast('Failed to save connection. Try again.', 'error');
    }
  };

  const handleDisconnect = async (platId: PlatformType) => {
    if (!telegramUser) return;
    setSaving(true);
    const success = await removeSocialConnection(telegramUser.id, platId);
    setSaving(false);

    if (success) {
      showToast(`Disconnected ${platId.toUpperCase()} account.`, 'info');
    } else {
      showToast('Failed to disconnect account.', 'error');
    }
  };

  const currentModalPlat = platforms.find((p) => p.id === activeModal);

  return (
    <div className="w-full">
      {/* ── CONNECTIONS PANEL ── */}
      <div className="glass-panel p-5 rounded-[24px] border border-white/10 flex flex-col gap-4 relative overflow-hidden bg-[#16171B] shadow-xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#E5A338]">
            CONNECTIONS
          </h3>
          <span className="text-[10px] text-slate-500 font-bold">
            Link social accounts
          </span>
        </div>

        <div className="flex flex-col divide-y divide-white/5">
          {platforms.map((plat) => {
            const conn = socialConnections[plat.id];
            const isConnected = !!conn?.connected;
            const handleText = conn?.handle || '';

            return (
              <div key={plat.id} className="flex items-center justify-between py-3.5 first:pt-1 last:pb-1">
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-md"
                    style={{ background: plat.bgColor }}
                  >
                    {plat.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-tight">
                      {plat.name}
                    </h4>
                    <p className="text-xs mt-0.5 font-medium">
                      {isConnected ? (
                        <span className="text-[#E5A338] font-semibold">
                          {handleText.startsWith('@') || handleText.startsWith('u/') ? handleText : `@${handleText}`}
                        </span>
                      ) : (
                        <span className="text-slate-400">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  {isConnected ? (
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#E5A338]/20 border border-[#E5A338]/50 flex items-center justify-center text-[#E5A338]">
                        <Check size={10} />
                      </span>
                      <button
                        onClick={() => handleDisconnect(plat.id)}
                        disabled={saving}
                        className="text-xs font-semibold text-slate-300 hover:text-white underline underline-offset-2 cursor-pointer transition-all disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenConnectModal(plat)}
                      className="h-8 px-5 rounded-full bg-[#E5A338] hover:bg-[#E5A338]/90 text-black font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MODALS ── */}
      <AnimatePresence>
        {activeModal && currentModalPlat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 15 }}
              className="bg-[#1C1C1E] border border-white/10 rounded-[26px] p-6 max-w-sm w-full shadow-2xl flex flex-col gap-5 relative overflow-hidden"
            >
              <button
                onClick={() => setActiveModal(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-all cursor-pointer p-1"
              >
                <CloseIcon size={18} />
              </button>

              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-md"
                  style={{ background: currentModalPlat.bgColor }}
                >
                  {currentModalPlat.icon}
                </div>
                <h3 className="text-lg font-extrabold text-white">
                  Link your {currentModalPlat.name}
                </h3>
              </div>

              <div className="flex flex-col gap-4">
                {currentModalPlat.isOauth && (
                  <div className="flex flex-col gap-2 border-b border-white/10 pb-4">
                    <p className="text-xs text-slate-300 font-medium">
                      Authenticate with {currentModalPlat.name} OAuth 2.0:
                    </p>
                    <button
                      onClick={() => {
                        const url = getOAuthUrl(currentModalPlat.id);
                        if (url) {
                          openExternalUrl(url);
                        } else {
                          showToast(`OAuth Client ID not configured for ${currentModalPlat.name}. Enter @handle below.`, 'warning');
                        }
                      }}
                      className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span className="shrink-0">{currentModalPlat.icon}</span>
                      <span>Authorize with {currentModalPlat.name}</span>
                    </button>
                  </div>
                )}

                <div>
                  <label className="text-xs text-slate-300 font-semibold block mb-1.5">
                    {currentModalPlat.isOauth ? 'Or enter your @handle / username manually:' : currentModalPlat.subtitle}
                  </label>
                  <input
                    type="text"
                    placeholder={currentModalPlat.inputPlaceholder}
                    value={handleInput}
                    onChange={(e) => setHandleInput(e.target.value)}
                    className="w-full h-11 rounded-xl bg-[#121212] border border-white/10 px-4 text-xs text-white placeholder-slate-500 outline-none focus:border-[#E5A338] transition-all font-mono"
                  />
                </div>

                <button
                  onClick={handleSaveConnection}
                  disabled={saving}
                  className="w-full h-11 rounded-xl bg-[#E5A338] text-black font-extrabold text-xs shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 mt-1"
                >
                  {saving ? 'Linking...' : 'Save Connection'}
                </button>

                <button
                  onClick={() => setActiveModal(null)}
                  className="text-xs font-bold text-slate-400 hover:text-white text-center cursor-pointer transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
