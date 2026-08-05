import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Upload, 
  Headset, 
  ShieldCheck, 
  ChevronLeft, 
  CheckCheck, 
  Clock, 
  X, 
  Eye, 
  RefreshCw,
  Sparkles,
  CreditCard,
  Wallet,
  Lock,
  UserCheck,
  ChevronRight,
  Bot
} from 'lucide-react';
import {
  sendUserSupportMessage,
  subscribeToUserSupportMessages,
  markChatAsReadByUser,
  type SupportChatMessage,
} from '../lib/supportService';
import { uploadFile } from '../lib/uploadService';

interface SupportProps {
  userTelegramId: number;
  userName?: string;
  userPhotoUrl?: string;
  botApiUrl?: string;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onBack?: () => void;
}

interface QuickTopic {
  id: string;
  icon: React.ReactNode;
  title: string;
  query: string;
  badge: string;
  color: string;
}

const QUICK_TOPICS: QuickTopic[] = [
  {
    id: 'deposit',
    icon: <CreditCard size={15} className="text-emerald-400" />,
    title: 'How to deposit USDT/EForce?',
    query: 'How to deposit USDT or EForce points into my account?',
    badge: 'Deposit Guide',
    color: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/20 hover:border-emerald-500/50',
  },
  {
    id: 'withdrawal',
    icon: <Wallet size={15} className="text-amber-400" />,
    title: 'Why is my withdrawal pending?',
    query: 'Why is my payout withdrawal pending or taking time to process?',
    badge: 'Payout Help',
    color: 'from-amber-500/10 to-orange-500/5 border-amber-500/20 hover:border-amber-500/50',
  },
  {
    id: 'tasks',
    icon: <Lock size={15} className="text-cyan-400" />,
    title: 'How to complete mandatory tasks?',
    query: 'How do I complete mandatory tasks to unlock withdrawal?',
    badge: 'Tasks Guide',
    color: 'from-cyan-500/10 to-blue-500/5 border-cyan-500/20 hover:border-cyan-500/50',
  },
  {
    id: 'verification',
    icon: <UserCheck size={15} className="text-purple-400" />,
    title: 'Account verification & Ref help',
    query: 'How does account verification and referral tracking work?',
    badge: 'Account & Ref',
    color: 'from-purple-500/10 to-pink-500/5 border-purple-500/20 hover:border-purple-500/50',
  },
];

export const Support: React.FC<SupportProps> = ({
  userTelegramId,
  userName,
  userPhotoUrl,
  botApiUrl = '',
  showToast,
  onBack,
}) => {
  const [messages, setMessages] = useState<SupportChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to real-time chat messages
  useEffect(() => {
    if (!userTelegramId) return;
    markChatAsReadByUser(userTelegramId);
    const unsub = subscribeToUserSupportMessages(userTelegramId, (msgs) => {
      setMessages(msgs);
      markChatAsReadByUser(userTelegramId);
    });
    return unsub;
  }, [userTelegramId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || sending || !userTelegramId) return;

    setSending(true);
    if (!textToSend) setInputText('');

    try {
      const ok = await sendUserSupportMessage(
        userTelegramId,
        userName || `User ${userTelegramId}`,
        userPhotoUrl || '',
        text.trim(),
        undefined,
        botApiUrl
      );
      if (!ok) {
        showToast('Failed to send message. Please check connection.', 'error');
      }
    } catch {
      showToast('Error sending message.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userTelegramId) return;
    e.target.value = '';

    setUploadingImg(true);
    showToast('Uploading screenshot...', 'info');

    try {
      const res = await uploadFile(file, {
        assetKey: `support_${userTelegramId}_${Date.now()}`,
        folder: 'support',
        botApiUrl,
      });

      if (res.secureUrl) {
        await sendUserSupportMessage(
          userTelegramId,
          userName || `User ${userTelegramId}`,
          userPhotoUrl || '',
          '📷 Attached image',
          res.secureUrl,
          botApiUrl
        );
        showToast('Screenshot sent to support!', 'success');
      }
    } catch (err: any) {
      showToast(err?.message || 'Failed to upload image', 'error');
    } finally {
      setUploadingImg(false);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[750px] min-h-[480px] max-w-2xl mx-auto w-full rounded-[30px] overflow-hidden bg-[#070A12] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative mb-20 md:mb-0">
      
      {/* Image Lightbox Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={() => setPreviewImage(null)}
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer z-50"
            >
              <X size={20} />
            </button>
            <img
              src={previewImage}
              alt="Screenshot Preview"
              className="max-w-full max-h-[85vh] object-contain rounded-2xl border border-white/20 shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Support Top Header */}
      <div className="px-4 py-3.5 border-b border-white/10 bg-gradient-to-r from-[#0C101B] via-[#0E1322] to-[#0C101B] flex items-center justify-between shrink-0 relative z-20 shadow-lg">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 hover:bg-white/10"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          
          {/* Animated Agent Avatar */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00E5FF]/25 via-[#0088FF]/15 to-[#A855F7]/15 border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.25)]">
              <Headset size={20} />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#070A12] rounded-full shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black text-white tracking-wide">Elite Force Support</h2>
              <span className="flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Live 24/7
              </span>
            </div>
            <p className="text-[9.5px] text-slate-400 flex items-center gap-1 mt-0.5 font-medium">
              <ShieldCheck size={11} className="text-cyan-400" />
              Customer Service Agent (Online)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/25 px-2.5 py-1 rounded-xl shadow-[0_0_12px_rgba(0,229,255,0.15)]">
          <Clock size={11} /> ~Instant Response
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#060810] scrollbar-thin scrollbar-thumb-white/10 relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-4 px-3 space-y-4 my-auto">
            
            {/* Glowing Bot Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#00E5FF]/20 via-[#0088FF]/15 to-[#A855F7]/20 border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] shadow-[0_0_35px_rgba(0,229,255,0.3)]">
                <Bot size={32} />
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#00E5FF]/20 border border-[#00E5FF]/50 flex items-center justify-center text-[10px]">
                ⚡
              </div>
            </div>

            <div>
              <h3 className="text-base font-black text-white tracking-tight">How can we help you today?</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Type your inquiry or select a quick topic below. Our support agents respond instantly!
              </p>
            </div>

            {/* Quick Inquiry Cards */}
            <div className="w-full max-w-sm pt-2 space-y-2">
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] font-mono font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <Sparkles size={11} className="text-[#00E5FF]" /> FREQUENTLY ASKED TOPICS
                </span>
              </div>

              {QUICK_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => handleSendMessage(topic.query)}
                  className={`w-full text-left p-3 rounded-2xl bg-gradient-to-r ${topic.color} border transition-all flex items-center justify-between group cursor-pointer shadow-sm hover:shadow-md hover:scale-[1.01]`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                      {topic.icon}
                    </div>
                    <div>
                      <span className="text-xs font-extrabold text-white block group-hover:text-[#00E5FF] transition-colors">
                        {topic.title}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono font-medium block">
                        Tap for instant response
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-500 group-hover:text-[#00E5FF] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg: SupportChatMessage) => {
            const isUser = msg.sender === 'user';
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[8.5px] font-mono text-slate-400 mb-1 px-1 flex items-center gap-1">
                  {isUser ? (
                    <>You</>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
                      🛡️ Elite Force Support Agent
                    </>
                  )}
                </span>

                <div
                  className={`max-w-[86%] rounded-2xl p-3.5 shadow-md relative text-xs leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-[#00E5FF] to-[#0099FF] text-black rounded-tr-xs font-bold shadow-[0_4px_20px_rgba(0,229,255,0.25)]'
                      : 'bg-[#121724] border border-[#00E5FF]/20 text-slate-100 rounded-tl-xs shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
                  }`}
                >
                  {msg.imageUrl && (
                    <div
                      onClick={() => setPreviewImage(msg.imageUrl || null)}
                      className="mb-2 rounded-xl overflow-hidden border border-black/20 bg-black/40 cursor-pointer group relative"
                    >
                      <img
                        src={msg.imageUrl}
                        alt="Attachment"
                        className="max-h-56 w-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                        <Eye size={14} /> View Full Image
                      </div>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap break-words font-sans">{msg.text}</div>

                  <div
                    className={`flex items-center gap-1 justify-end text-[8.5px] font-mono mt-1.5 ${
                      isUser ? 'text-black/75 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Clock size={9} />
                    <span>{formatTime(msg.createdAt)}</span>
                    {isUser && <CheckCheck size={11} className="text-black/90 ml-0.5" />}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}

        {/* Uploading Image Loading Bubble */}
        {uploadingImg && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-end"
          >
            <span className="text-[8.5px] font-mono text-[#00E5FF] mb-1 px-1 flex items-center gap-1 font-bold">
              <RefreshCw size={9} className="animate-spin" /> Uploading Screenshot...
            </span>
            <div className="bg-[#00E5FF]/10 border border-[#00E5FF]/30 p-3.5 rounded-2xl text-xs text-[#00E5FF] flex items-center gap-2.5 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              <div className="w-6 h-6 rounded-lg bg-[#00E5FF]/20 flex items-center justify-center shrink-0">
                <RefreshCw size={14} className="animate-spin text-[#00E5FF]" />
              </div>
              <span className="font-semibold text-[11px]">Uploading screenshot & sending to support...</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions bar if messages exist */}
      {messages.length > 0 && (
        <div className="px-3 py-2 bg-[#0A0E18] border-t border-white/5 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          {QUICK_TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSendMessage(t.query)}
              className="px-3 py-1 rounded-full bg-white/5 hover:bg-[#00E5FF]/15 border border-white/10 hover:border-[#00E5FF]/30 text-[9.5px] text-slate-300 hover:text-[#00E5FF] shrink-0 transition-all cursor-pointer font-bold flex items-center gap-1"
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* Modern Floating Input Bar */}
      <div className="p-3 bg-[#0A0E18] border-t border-white/10 shrink-0 relative z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <label className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer shrink-0 disabled:opacity-40 shadow-sm">
            {uploadingImg ? (
              <RefreshCw size={16} className="animate-spin text-[#00E5FF]" />
            ) : (
              <Upload size={16} />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={uploadingImg || sending}
            />
          </label>

          <input
            type="text"
            placeholder="Type your message to support..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending || uploadingImg}
            className="flex-1 h-10 px-4 rounded-2xl bg-white/[0.04] border border-white/12 text-xs text-white placeholder-slate-500 outline-none focus:border-[#00E5FF] focus:bg-white/[0.06] transition-all shadow-inner"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending || uploadingImg}
            className="h-10 px-4 rounded-2xl text-black font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition-all shrink-0"
            style={{
              background: 'linear-gradient(135deg, #00E5FF 0%, #0088FF 100%)',
              boxShadow: '0 0 20px rgba(0, 229, 255, 0.35)',
            }}
          >
            {sending ? <RefreshCw size={14} className="animate-spin text-black" /> : <Send size={14} />}
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
