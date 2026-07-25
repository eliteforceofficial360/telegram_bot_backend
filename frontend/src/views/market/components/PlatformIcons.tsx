import React from 'react';
import {
  Send, MessageSquareMore, Camera, Youtube, Globe,
  HelpCircle, Smartphone, PenLine, Star, Users, Share2,
} from 'lucide-react';

// ── Platform SVG Icons ────────────────────────────────────────────────────────

const XIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const FacebookIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const DiscordIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/>
  </svg>
);

const InstagramIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
);

const TikTokIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
);

const TelegramIcon = ({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

// ── Platform Config with Icon Components ─────────────────────────────────────

export interface PlatformMeta {
  id: string;
  label: string;
  color: string;
  Icon: React.FC<{ size?: number; color?: string }>;
}

export const PLATFORM_META: PlatformMeta[] = [
  { id: 'Telegram',  label: 'Telegram',  color: '#2AABEE', Icon: TelegramIcon },
  { id: 'X',         label: 'X',         color: '#FFFFFF', Icon: XIcon },
  { id: 'Discord',   label: 'Discord',   color: '#5865F2', Icon: DiscordIcon },
  { id: 'Instagram', label: 'Instagram', color: '#E1306C', Icon: InstagramIcon },
  { id: 'TikTok',    label: 'TikTok',    color: '#FF0050', Icon: TikTokIcon },
  { id: 'YouTube',   label: 'YouTube',   color: '#FF0000', Icon: ({ size = 16, color = 'currentColor' }) => <Youtube size={size} color={color} /> },
  { id: 'Facebook',  label: 'Facebook',  color: '#1877F2', Icon: FacebookIcon },
  { id: 'Website',   label: 'Website',   color: '#10B981', Icon: ({ size = 16, color = 'currentColor' }) => <Globe size={size} color={color} /> },
  { id: 'Quiz',      label: 'Quiz',      color: '#8B5CF6', Icon: ({ size = 16, color = 'currentColor' }) => <HelpCircle size={size} color={color} /> },
  { id: 'Apps',      label: 'Apps',      color: '#F59E0B', Icon: ({ size = 16, color = 'currentColor' }) => <Smartphone size={size} color={color} /> },
  { id: 'Custom',    label: 'Custom',    color: '#64748B', Icon: ({ size = 16, color = 'currentColor' }) => <PenLine size={size} color={color} /> },
];

/** Render a platform icon by ID */
export const PlatformIcon: React.FC<{ platformId: string; size?: number; color?: string; className?: string }> = ({
  platformId, size = 16, color, className,
}) => {
  const meta = PLATFORM_META.find(p => p.id === platformId);
  if (!meta) return <Globe size={size} color={color || '#64748b'} className={className} />;
  const resolvedColor = color || meta.color;
  return <meta.Icon size={size} color={resolvedColor} />;
};

/** Get platform color by ID */
export const getPlatformColor = (id: string): string => {
  return PLATFORM_META.find(p => p.id === id)?.color || '#FF8A00';
};

// ── Action Icons ──────────────────────────────────────────────────────────────

export const ACTION_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  'Follow':           ({ size = 14, color = 'currentColor' }) => <Users size={size} color={color} />,
  'Like Post':        ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
  ),
  'Like Video':       ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
  ),
  'Repost':           ({ size = 14, color = 'currentColor' }) => <Share2 size={size} color={color} />,
  'Comment':          ({ size = 14, color = 'currentColor' }) => <MessageSquareMore size={size} color={color} />,
  'Quote Tweet':      ({ size = 14, color = 'currentColor' }) => <PenLine size={size} color={color} />,
  'Join Channel':     ({ size = 14, color = 'currentColor' }) => <Send size={size} color={color} />,
  'Join Group':       ({ size = 14, color = 'currentColor' }) => <Users size={size} color={color} />,
  'Join Bot':         ({ size = 14, color = 'currentColor' }) => <Smartphone size={size} color={color} />,
  'Join Server':      ({ size = 14, color = 'currentColor' }) => <Users size={size} color={color} />,
  'Subscribe':        ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
  ),
  'Watch Video':      ({ size = 14, color = 'currentColor' }) => <Youtube size={size} color={color} />,
  'React to Post':    ({ size = 14, color = 'currentColor' }) => <Star size={size} color={color} />,
  'React to Message': ({ size = 14, color = 'currentColor' }) => <Star size={size} color={color} />,
  'Send Message':     ({ size = 14, color = 'currentColor' }) => <Send size={size} color={color} />,
  'Share Story':      ({ size = 14, color = 'currentColor' }) => <Camera size={size} color={color} />,
  'Share':            ({ size = 14, color = 'currentColor' }) => <Share2 size={size} color={color} />,
  'Share Post':       ({ size = 14, color = 'currentColor' }) => <Share2 size={size} color={color} />,
  'Like Page':        ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.76a2 2 0 001.79-1.11L12 2h0a3.13 3.13 0 013 3.88z"/></svg>
  ),
  'Visit':            ({ size = 14, color = 'currentColor' }) => <Globe size={size} color={color} />,
  'Sign Up':          ({ size = 14, color = 'currentColor' }) => <PenLine size={size} color={color} />,
  'Fill Form':        ({ size = 14, color = 'currentColor' }) => <PenLine size={size} color={color} />,
  'Complete Quiz':    ({ size = 14, color = 'currentColor' }) => <HelpCircle size={size} color={color} />,
  'Download & Install': ({ size = 14, color = 'currentColor' }) => <Smartphone size={size} color={color} />,
  'Register':         ({ size = 14, color = 'currentColor' }) => <PenLine size={size} color={color} />,
  'Do Task':          ({ size = 14, color = 'currentColor' }) => <PenLine size={size} color={color} />,
};

/** Render action icon, fallback to PenLine */
export const ActionIcon: React.FC<{ action: string; size?: number; color?: string }> = ({ action, size = 14, color }) => {
  const Comp = ACTION_ICONS[action];
  if (Comp) return <Comp size={size} color={color} />;
  return <PenLine size={size} color={color || 'currentColor'} />;
};

// ── Input Field Icons ─────────────────────────────────────────────────────────

export const INPUT_FIELD_ICONS: Record<string, React.FC<{ size?: number; color?: string }>> = {
  telegram_username: ({ size = 14, color = 'currentColor' }) => <TelegramIcon size={size} color={color} />,
  x_username:        ({ size = 14, color = 'currentColor' }) => <XIcon size={size} color={color} />,
  wallet_address:    ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5"/></svg>
  ),
  email:             ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>
  ),
  uid:               ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
  ),
  tx_hash:           ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
  ),
  screenshot:        ({ size = 14, color = 'currentColor' }) => <Camera size={size} color={color} />,
  custom:            ({ size = 14, color = 'currentColor' }) => <PenLine size={size} color={color} />,
};
