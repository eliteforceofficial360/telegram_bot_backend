import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Upload, Headset, ShieldCheck, ChevronLeft, CheckCheck, Clock } from 'lucide-react';
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
  '💬 General Support Request',
  '💸 Withdrawal & Payout Issue',
  '✅ Mission / Task Verification',
  '🔐 Account & Security Help',
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
    <div className="flex flex-col h-[calc(100vh-80px)] md:h-[85vh] max-w-2xl mx-auto w-full rounded-3xl overflow-hidden bg-[#0A0D14] border border-white/10 shadow-2xl relative">
      {/* Support Top Navigation Header */}
      <div className="p-4 border-b border-white/10 bg-[#0E121B] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#FF8A00] to-[#FFB347] p-0.5 flex items-center justify-center shadow-lg shadow-[#FF8A00]/20">
            <div className="w-full h-full rounded-[14px] bg-[#0E121B] flex items-center justify-center text-[#FF8A00]">
              <Headset size={20} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-white">Elite Force Live Support</h2>
              <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
              <ShieldCheck size={11} className="text-cyan-400" />
              Official Customer Service Agent (24/7)
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#080B12] scrollbar-thin scrollbar-thumb-white/10">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4 space-y-4 my-auto">
            <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF8A00]">
              <Headset size={32} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">How can we help you today?</h3>
              <p className="text-xs text-slate-400 max-w-xs mt-1">
                Type your inquiry below or select a quick question. Our support team is online and ready to assist!
              </p>
            </div>

            {/* Quick Inquiries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md pt-2">
              {QUICK_INQUIRIES.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSendMessage(q)}
                  className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-[#FF8A00]/10 border border-white/5 hover:border-[#FF8A00]/30 text-left text-xs font-bold text-slate-300 hover:text-[#FF8A00] transition-all cursor-pointer"
                >
                  {q}
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Sender badge */}
                <span className="text-[9px] font-mono text-slate-500 mb-1 px-1">
                  {isUser ? userName || 'You' : '🛡️ Elite Force Support'}
                </span>

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 shadow-md relative text-xs leading-relaxed ${
                    isUser
                      ? 'bg-gradient-to-r from-[#FF8A00] to-[#FF9E2C] text-black rounded-tr-xs font-medium'
                      : 'bg-[#151C2C] border border-cyan-500/20 text-slate-100 rounded-tl-xs shadow-cyan-500/5'
                  }`}
                >
                  {msg.imageUrl && (
                    <div className="mb-2 rounded-xl overflow-hidden border border-black/20 bg-black/40">
                      <img
                        src={msg.imageUrl}
                        alt="Attachment"
                        className="max-h-60 w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="whitespace-pre-wrap break-words font-sans">{msg.text}</div>

                  {/* Timestamp & read mark */}
                  <div
                    className={`flex items-center gap-1 justify-end text-[8.5px] font-mono mt-1.5 ${
                      isUser ? 'text-black/60 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    <Clock size={9} />
                    <span>{formatTime(msg.createdAt)}</span>
                    {isUser && <CheckCheck size={11} className="text-black/70 ml-0.5" />}
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
        <div className="px-3 py-2 bg-[#0E121B] border-t border-white/5 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          {QUICK_INQUIRIES.map((q) => (
            <button
              key={q}
              onClick={() => handleSendMessage(q)}
              className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-[#FF8A00]/20 border border-white/10 text-[10px] text-slate-300 hover:text-white shrink-0 transition-all cursor-pointer"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input controls */}
      <div className="p-3 bg-[#0E121B] border-t border-white/10 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <label className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 transition-all cursor-pointer shrink-0">
            <Upload size={16} />
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
            placeholder="Type your message to live support..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending || uploadingImg}
            className="flex-1 h-10 px-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF8A00] transition-all"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || sending || uploadingImg}
            className="h-10 px-4 rounded-xl bg-gradient-to-r from-[#FF8A00] to-[#FFB347] text-black font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md disabled:opacity-40 hover:brightness-110 active:scale-[0.98] transition-all shrink-0"
          >
            <Send size={14} />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
