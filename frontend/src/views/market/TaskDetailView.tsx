import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink, ShieldCheck, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { type MarketTask, startTask, submitTaskProof } from '../../lib/marketService';
import { type TelegramUser } from '../../lib/telegramUser';

interface TaskDetailViewProps {
  task: MarketTask;
  onClose: () => void;
  telegramUser: TelegramUser | null;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onSubmitted?: () => void;
}

export const TaskDetailView: React.FC<TaskDetailViewProps> = ({
  task, onClose, telegramUser, showToast, onSubmitted,
}) => {
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states for proof
  const [proofText, setProofText] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [checkedList, setCheckedList] = useState<Record<number, boolean>>({});

  const allChecklistDone = task.checklist.length === 0 || task.checklist.every((_, idx) => !!checkedList[idx]);

  const handleStart = async () => {
    if (!telegramUser) return showToast('Please log in to start tasks', 'error');
    setStarting(true);
    const res = await startTask(task.id, telegramUser.id);
    setStarting(false);

    if (res.ok) {
      setStarted(true);
      showToast('📌 Task started! Complete the steps and submit proof.', 'info');
    } else {
      showToast(res.error || 'Could not start task', 'error');
    }
  };

  const handleSubmitProof = async () => {
    if (!telegramUser) return;
    if (!allChecklistDone) return showToast('Please complete all items on the checklist', 'warning');

    setSubmitting(true);
    const res = await submitTaskProof(task.id, telegramUser.id, {
      proofUrl,
      proofText,
      inputValues,
    });
    setSubmitting(false);

    if (res.ok) {
      showToast('🎉 Proof submitted successfully!', 'success');
      if (onSubmitted) onSubmitted();
      onClose();
    } else {
      showToast(res.error || 'Failed to submit proof', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(5,8,22,0.98)', backdropFilter: 'blur(20px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <button onClick={onClose} className="w-8 h-8 rounded-2xl bg-white/6 flex items-center justify-center cursor-pointer">
          <X size={16} className="text-slate-400" />
        </button>
        <span className="text-[10px] font-black tracking-widest text-[#FFD700] uppercase px-3 py-1 rounded-full bg-[#FFD700]/10 border border-[#FFD700]/20">
          +{task.reward} EFC REWARD
        </span>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-5">
        {/* Title Card */}
        <div className="p-5 rounded-[24px] relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,138,0,0.12) 0%, rgba(10,14,30,0.95) 100%)',
            border: '1px solid rgba(255,138,0,0.3)',
            boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
          }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-[#FF8A00] uppercase tracking-wider">{task.platform} · {task.action}</span>
            <span className="text-[9px] font-bold text-slate-500">• {task.remainingSlots} slots remaining</span>
          </div>
          <h2 className="text-lg font-black text-white mb-2 leading-snug">{task.title}</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">{task.description}</p>

          <a
            href={task.targetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[14px] text-xs font-bold text-white transition-all cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #00E5FF, #0088FF)',
              boxShadow: '0 0 15px rgba(0,229,255,0.3)',
            }}
          >
            Open Task Target <ExternalLink size={14} />
          </a>
        </div>

        {/* Instructions */}
        <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/8 space-y-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck size={14} className="text-[#00FF88]" /> What Should You Do?
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-mono text-[11px]">
            {task.instructions}
          </p>
        </div>

        {/* Checklist */}
        {task.checklist && task.checklist.length > 0 && (
          <div className="p-4 rounded-[20px] bg-white/[0.03] border border-white/8 space-y-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Step Checklist</h3>
            <div className="space-y-2">
              {task.checklist.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setCheckedList(prev => ({ ...prev, [idx]: !prev[idx] }))}
                  className="w-full flex items-center gap-3 p-3 rounded-[14px] text-left cursor-pointer transition-all"
                  style={{
                    background: checkedList[idx] ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)',
                    border: checkedList[idx] ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                    checkedList[idx] ? 'bg-[#00FF88] text-black' : 'border border-slate-600'
                  }`}>
                    {checkedList[idx] && <CheckCircle2 size={14} />}
                  </div>
                  <span className={`text-xs font-medium ${checkedList[idx] ? 'text-white line-through opacity-70' : 'text-slate-300'}`}>
                    {item}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Proof Submission Section (If Started) */}
        {started && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-[24px] bg-[#FF8A00]/10 border border-[#FF8A00]/30 space-y-4"
          >
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Sparkles size={16} className="text-[#FF8A00]" /> Submit Your Proof Details
            </h3>

            {/* If task requires input fields or screenshot */}
            {(!task.inputFields || task.inputFields.length === 0) ? (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  Proof Screenshot / Image URL
                </label>
                <input
                  type="text"
                  value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                  placeholder="https://imgur.com/... or paste screenshot link"
                  className="w-full px-4 py-3 rounded-[16px] text-xs text-white placeholder-slate-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            ) : (
              (task.inputFields || ['screenshot']).map(fieldKey => {
                const label = fieldKey.replace(/_/g, ' ').toUpperCase();
                const isScreenshot = fieldKey.toLowerCase().includes('screenshot');
                return (
                  <div key={fieldKey} className="space-y-1.5">
                    <label className="text-[10px] font-black text-[#FFD700] uppercase tracking-widest block">
                      {label} <span className="text-rose-400">*</span>
                    </label>
                    {isScreenshot ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={proofUrl}
                          onChange={e => setProofUrl(e.target.value)}
                          placeholder="Paste screenshot URL (https://...)"
                          className="w-full px-4 py-3 rounded-[16px] text-xs text-white placeholder-slate-600 focus:outline-none"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                        />
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={inputValues[fieldKey] !== undefined ? inputValues[fieldKey] : (fieldKey === 'telegram_username' ? (telegramUser?.username ? `@${telegramUser.username}` : '') : fieldKey === 'uid' ? String(telegramUser?.id || '') : '')}
                        onChange={e => setInputValues(p => ({ ...p, [fieldKey]: e.target.value }))}
                        placeholder={`Enter your ${fieldKey.replace(/_/g, ' ')}...`}
                        className="w-full px-4 py-3 rounded-[16px] text-xs text-white placeholder-slate-600 focus:outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                    )}
                  </div>
                );
              })
            )}

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                Additional Comments / Proof Notes (Optional)
              </label>
              <textarea
                value={proofText}
                onChange={e => setProofText(e.target.value)}
                placeholder="Type any extra information for reviewer..."
                rows={3}
                className="w-full px-4 py-3 rounded-[16px] text-xs text-white placeholder-slate-600 focus:outline-none resize-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom Fixed Action Button */}
      <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#050816] via-[#050816]/90 to-transparent shrink-0 max-w-[430px] mx-auto z-50">
        {telegramUser?.id === task.creatorTelegramId ? (
          <div className="w-full h-12 rounded-[18px] text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 flex items-center justify-center gap-2">
            <span>🛡️</span> You created this task. Creator self-completion is disabled.
          </div>
        ) : !started ? (
          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full h-12 rounded-[18px] text-sm font-black text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{
              background: 'linear-gradient(135deg, #FF8A00, #FFD700)',
              boxShadow: '0 0 24px rgba(255,138,0,0.4)',
            }}
          >
            {starting ? <Loader2 size={18} className="animate-spin" /> : '🚀 Start Task'}
          </button>
        ) : (
          <button
            onClick={handleSubmitProof}
            disabled={submitting}
            className="w-full h-12 rounded-[18px] text-sm font-black text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{
              background: 'linear-gradient(135deg, #00FF88, #00E5FF)',
              boxShadow: '0 0 24px rgba(0,255,136,0.3)',
              color: '#050816',
            }}
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : '✅ Confirm & Submit Proof'}
          </button>
        )}
      </div>
    </div>
  );
};
