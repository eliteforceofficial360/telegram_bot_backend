import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Upload, Headset, ShieldCheck, ChevronLeft, CheckCheck, Clock, Sparkles, MessageSquare } from 'lucide-react';
import {
  sendUserSupportMessage,
  subscribeToUserSupportMessages,
  markChatAsReadByUser,
  type SupportChatMessage,
} from '../lib/supportService';
import { uploadFile } from '../lib/uploadService';

interface SupportProps {
  userTelegramId: number;
  userName: string;
  userPhotoUrl: string;
  botApiUrl?: string;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onBack?: () => void;
}

const QUICK_INQUIRIES = [
  '💬 General Support',
  '💸 Withdrawal Payout',
  '✅ Mission Task Help',
  '🔐 Account Security',
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
    if (!text.trim() || sending) return;

    setSending(true);
    setInputText('');

    const ok = await sendUserSupportMessage(
      userTelegramId,
      userName || `User ${userTelegramId}`,
      userPhotoUrl || '',
      text
    );

    setSending(false);
    if (!ok) {
      showToast('Failed to send message. Please check connection.', 'error');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploadingImg(true);
    showToast('Uploading image attachment...', 'info');

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
          res.secureUrl
        );
        showToast('Image sent to support!', 'success');
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
    <div className="flex flex-col h-[calc(100vh-210px)] max-h-[720px] min-h-[420px] max-w-2xl mx-auto w-full rounded-[28px] overflow-hidden bg-[#0A0D14] border border-white/10 shadow-2xl relative mb-24 md:mb-0">
      {/* Support Top Navigation Header */}
      <div className="px-3.5 py-3 border-b border-white/10 bg-[#0E121B] flex items-center justify-between shrink-0 relative z-20">
        <div className="flex items-center gap-2.5">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00E5FF]/30 to-[#0088FF]/10 border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.3)] shrink-0">
            <Headset size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-black text-white tracking-wide">Elite Force Support</h2>
              <span className="flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
              <ShieldCheck size={10} className="text-cyan-400" />
              Customer Service Agent (24/7)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[9.5px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl">
          <Sparkles size={11} className="text-[#00E5FF]" /> Instant
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#080B12] scrollbar-thin scrollbar-thumb-white/10 relative">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-6 px-4 space-y-3 my-auto">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00E5FF]/20 to-[#FF8A00]/10 border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.2)]">
              <MessageSquare size={28} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white tracking-wide">How can we help you today?</h3>
              <p className="text-[10.5px] text-slate-400 max-w-xs mt-1 leading-relaxed">
                Type your inquiry below or tap a quick category to start chatting with support!
              </p>
            </div>

            {/* Quick Inquiries Grid */}
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm pt-2">
              {QUICK_INQUIRIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSendMessage(q)}
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-[#00E5FF]/10 border border-white/8 hover:border-[#00E5FF]/30 text-left text-[10.5px] font-bold text-slate-200 hover:text-[#00E5FF] transition-all cursor-pointer flex items-center justify-between"
                >
                  <span>{q}</span>
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
                {/* Sender badge */}
                <span className="text-[8.5px] font-mono text-slate-500 mb-1 px-1">
                  {isUser ? userName || 'You' : '🛡️ Elite Force Support'}
                </span>

                <div
                  className={`max-w-[88%] rounded-2xl p-3 shadow-md relative text-xs leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-[#00E5FF] to-[#0088FF] text-black rounded-tr-xs font-semibold shadow-[0_4px_15px_rgba(0,229,255,0.2)]'
                      : 'bg-[#141A28] border border-white/10 text-slate-100 rounded-tl-xs shadow-md'
                  }`}
                >
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-black/20 bg-black/40">
                      <img
                        src={msg.imageUrl}
                        alt="Attachment"
                        className="max-h-56 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="whitespace-pre-wrap break-words font-sans">{msg.text}</div>

                  {/* Timestamp & read mark */}
                  <div
                    className={`flex items-center gap-1 justify-end text-[8px] font-mono mt-1 ${
                      isUser ? 'text-black/70 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Clock size={8} />
                    <span>{formatTime(msg.createdAt)}</span>
                    {isUser && <CheckCheck size={10} className="text-black/80 ml-0.5" />}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions bar if messages exist */}
      {messages.length > 0 && (
        <div className="px-3 py-1.5 bg-[#0E121B] border-t border-white/5 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
          {QUICK_INQUIRIES.map((q) => (
            <button
              key={q}
              onClick={() => handleSendMessage(q)}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-[#00E5FF]/15 border border-white/10 text-[9.5px] text-slate-300 hover:text-[#00E5FF] shrink-0 transition-all cursor-pointer font-medium"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input controls — Elevated above bottom bar */}
      <div className="p-2.5 bg-[#0E121B] border-t border-white/10 shrink-0 relative z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <label className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer shrink-0">
            <Upload size={15} />
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
            className="flex-1 h-9 px-3 rounded-xl bg-white/[0.05] border border-white/12 text-xs text-white placeholder-slate-500 outline-none focus:border-[#00E5FF] transition-all"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending || uploadingImg}
            className="h-9 px-3.5 rounded-xl text-black font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition-all shrink-0"
            style={{
              background: 'linear-gradient(135deg, #00E5FF 0%, #00B4D8 100%)',
              boxShadow: '0 0 15px rgba(0, 229, 255, 0.3)',
            }}
          >
            <Send size={13} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
