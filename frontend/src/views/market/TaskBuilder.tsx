import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Plus, Trash2, ImagePlus, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  PLATFORMS, PLATFORM_ACTIONS, calculateTaskCost, createMarketTask,
  type CreateTaskPayload,
} from '../../lib/marketService';
import { type TelegramUser } from '../../lib/telegramUser';

interface TaskBuilderProps {
  onClose: () => void;
  telegramUser: TelegramUser | null;
  efcBalance: number;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onCreated: () => void;
}

const TOTAL_STEPS = 6; // Condensed into 6 smart steps

const INPUT_FIELD_OPTIONS = [
  { id: 'telegram_username', label: 'Telegram Username', icon: '✈️' },
  { id: 'x_username', label: 'X Username', icon: '𝕏' },
  { id: 'wallet_address', label: 'Wallet Address', icon: '💳' },
  { id: 'email', label: 'Email', icon: '✉️' },
  { id: 'uid', label: 'User ID / UID', icon: '🔑' },
  { id: 'tx_hash', label: 'Transaction Hash', icon: '🔗' },
  { id: 'screenshot', label: 'Screenshot Upload', icon: '📷' },
  { id: 'custom', label: 'Custom Field', icon: '✏️' },
];

const VERIFICATION_TYPES = [
  { id: 'automatic', label: 'Automatic', desc: 'Verified via API instantly', icon: '⚡', color: '#00FF88' },
  { id: 'manual', label: 'Manual Review', desc: 'Admin reviews screenshots', icon: '👁️', color: '#FFC857' },
  { id: 'hybrid', label: 'Hybrid', desc: 'Auto + manual fallback', icon: '🔀', color: '#B388FF' },
];

const AUDIENCE_TYPES = [
  { id: 'everyone', label: 'Everyone', icon: '🌐' },
  { id: 'premium', label: 'Premium Only', icon: '⭐' },
  { id: 'level', label: 'By Level', icon: '🎯' },
  { id: 'country', label: 'By Country', icon: '🗺️' },
];

interface TaskForm {
  platform: string;
  action: string;
  targetUrl: string;
  title: string;
  description: string;
  instructions: string;
  checklist: string[];
  inputFields: string[];
  reward: number;
  workerLimit: number;
  dailyLimit: number;
  cooldownHours: number;
  expiryDays: number;
  verificationType: 'automatic' | 'manual' | 'hybrid';
  audienceType: string;
  minLevel: number;
  minBalance: number;
}

const DEFAULT_FORM: TaskForm = {
  platform: '',
  action: '',
  targetUrl: '',
  title: '',
  description: '',
  instructions: '',
  checklist: [],
  inputFields: ['screenshot'],
  reward: 10,
  workerLimit: 50,
  dailyLimit: 0,
  cooldownHours: 0,
  expiryDays: 7,
  verificationType: 'automatic',
  audienceType: 'everyone',
  minLevel: 1,
  minBalance: 0,
};

export const TaskBuilder: React.FC<TaskBuilderProps> = ({
  onClose, telegramUser, efcBalance, showToast, onCreated,
}) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<TaskForm>(DEFAULT_FORM);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState(1);

  const update = useCallback(<K extends keyof TaskForm>(key: K, value: TaskForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

  const actions = PLATFORM_ACTIONS[form.platform] || [];
  const cost = form.reward && form.workerLimit
    ? calculateTaskCost(form.reward, form.workerLimit, form.verificationType, form.expiryDays)
    : null;

  const canAfford = cost ? efcBalance >= cost.escrowTotal : true;

  const goNext = () => {
    if (step < TOTAL_STEPS) { setDirection(1); setStep(s => s + 1); }
  };
  const goPrev = () => {
    if (step > 1) { setDirection(-1); setStep(s => s - 1); }
  };

  const stepValid = () => {
    switch (step) {
      case 1: return !!form.platform && !!form.action;
      case 2: return !!form.targetUrl.trim() && !!form.title.trim();
      case 3: return !!form.description.trim() && !!form.instructions.trim();
      case 4: return form.reward >= 2 && form.workerLimit >= 1;
      case 5: return !!form.verificationType;
      case 6: return true;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (!telegramUser) return showToast('Not logged in', 'error');
    if (!canAfford) return showToast('Insufficient EFC balance', 'error');

    setSubmitting(true);
    const payload: CreateTaskPayload = {
      telegramId: telegramUser.id,
      platform: form.platform,
      action: form.action,
      targetUrl: form.targetUrl,
      title: form.title,
      description: form.description,
      instructions: form.instructions,
      exampleImages: [],
      checklist: form.checklist,
      inputFields: form.inputFields,
      reward: form.reward,
      workerLimit: form.workerLimit,
      dailyLimit: form.dailyLimit || 0,
      cooldownHours: form.cooldownHours || 0,
      expiryDays: form.expiryDays,
      audience: {
        type: form.audienceType as CreateTaskPayload['audience']['type'],
        minLevel: form.minLevel,
        minBalance: form.minBalance,
      },
      verificationType: form.verificationType,
    };

    const result = await createMarketTask(payload);
    setSubmitting(false);

    if (result.ok) {
      showToast('🎉 Task created! Pending review.', 'success');
      onCreated();
      onClose();
    } else {
      showToast(result.error || 'Failed to create task', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(5,8,22,0.98)', backdropFilter: 'blur(20px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="w-8 h-8 rounded-2xl bg-white/6 flex items-center justify-center cursor-pointer">
            <X size={16} className="text-slate-400" />
          </button>
          <div>
            <h2 className="text-sm font-black text-white">Create Task</h2>
            <p className="text-[9px] text-slate-500">Step {step} of {TOTAL_STEPS}</p>
          </div>
        </div>
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i + 1 === step ? 20 : 6,
                height: 6,
                background: i + 1 <= step
                  ? 'linear-gradient(90deg, #FF8A00, #FFD700)'
                  : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* ── Step 1: Platform + Action ─────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-black text-white mb-1">Choose Platform</h3>
                  <p className="text-[10px] text-slate-500 mb-4">Where should workers complete the task?</p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {PLATFORMS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { update('platform', p.id); update('action', ''); }}
                        className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-[16px] cursor-pointer transition-all"
                        style={{
                          background: form.platform === p.id ? `${p.color}20` : 'rgba(255,255,255,0.04)',
                          border: form.platform === p.id ? `1.5px solid ${p.color}60` : '1px solid rgba(255,255,255,0.08)',
                          boxShadow: form.platform === p.id ? `0 0 16px ${p.color}20` : 'none',
                        }}
                      >
                        <span className="text-xl leading-none">{p.icon}</span>
                        <span className="text-[9px] font-bold" style={{ color: form.platform === p.id ? p.color : '#64748b' }}>
                          {p.id}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {form.platform && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Action</p>
                    <div className="space-y-2">
                      {actions.map(a => (
                        <button
                          key={a.label}
                          onClick={() => update('action', a.label)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-[16px] cursor-pointer transition-all"
                          style={{
                            background: form.action === a.label ? 'rgba(255,138,0,0.14)' : 'rgba(255,255,255,0.04)',
                            border: form.action === a.label ? '1px solid rgba(255,138,0,0.5)' : '1px solid rgba(255,255,255,0.07)',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{a.icon}</span>
                            <span className="text-xs font-bold" style={{ color: form.action === a.label ? '#FF8A00' : '#cbd5e1' }}>
                              {a.label}
                            </span>
                          </div>
                          <span className="text-[9px] font-bold text-slate-500">from {a.baseReward} EFC</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── Step 2: Target + Title ────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-white mb-1">Target & Title</h3>
                  <p className="text-[10px] text-slate-500 mb-4">Where should workers go? Give your task a clear name.</p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Target URL / Username
                  </label>
                  <input
                    type="text"
                    value={form.targetUrl}
                    onChange={e => update('targetUrl', e.target.value)}
                    placeholder={form.platform === 'X' ? 'https://x.com/EliteForceOFC' : form.platform === 'Telegram' ? 'https://t.me/channel' : 'https://...'}
                    className="w-full px-4 py-3 rounded-[16px] text-sm text-white placeholder-slate-600 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Task Title <span className="text-slate-600 normal-case font-normal">(shown on Market card)</span>
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => update('title', e.target.value)}
                    placeholder="e.g. Follow @EliteForceOFC on X"
                    maxLength={60}
                    className="w-full px-4 py-3 rounded-[16px] text-sm text-white placeholder-slate-600 focus:outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                  <div className="text-right text-[9px] text-slate-600 mt-1">{form.title.length}/60</div>
                </div>
              </div>
            )}

            {/* ── Step 3: Description + Instructions + Checklist ────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-white mb-1">Task Details</h3>
                  <p className="text-[10px] text-slate-500 mb-4">Tell workers exactly what to do.</p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                    placeholder="Short description shown on the task card..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-[16px] text-sm text-white placeholder-slate-600 focus:outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Instructions <span className="text-slate-600 normal-case font-normal">(detailed steps for workers)</span>
                  </label>
                  <textarea
                    value={form.instructions}
                    onChange={e => update('instructions', e.target.value)}
                    placeholder="1. Open the link&#10;2. Follow the account&#10;3. Take a screenshot&#10;4. Submit as proof"
                    rows={5}
                    className="w-full px-4 py-3 rounded-[16px] text-sm text-white placeholder-slate-600 focus:outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                {/* Checklist */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Steps Checklist <span className="text-slate-600 normal-case font-normal">(optional)</span>
                  </label>
                  <div className="space-y-2 mb-2">
                    {form.checklist.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-[12px]"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <span className="text-[9px] font-black text-[#FF8A00] w-4">{idx + 1}</span>
                        <span className="text-xs text-slate-300 flex-1">{item}</span>
                        <button onClick={() => update('checklist', form.checklist.filter((_, i) => i !== idx))}
                          className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newChecklistItem}
                      onChange={e => setNewChecklistItem(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newChecklistItem.trim()) {
                          update('checklist', [...form.checklist, newChecklistItem.trim()]);
                          setNewChecklistItem('');
                        }
                      }}
                      placeholder="Add step... (Enter to add)"
                      className="flex-1 px-3 py-2.5 rounded-[12px] text-xs text-white placeholder-slate-600 focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <button
                      onClick={() => {
                        if (newChecklistItem.trim()) {
                          update('checklist', [...form.checklist, newChecklistItem.trim()]);
                          setNewChecklistItem('');
                        }
                      }}
                      className="px-3 py-2.5 rounded-[12px] cursor-pointer"
                      style={{ background: 'rgba(255,138,0,0.15)', border: '1px solid rgba(255,138,0,0.3)' }}
                    >
                      <Plus size={14} className="text-[#FF8A00]" />
                    </button>
                  </div>
                </div>

                {/* Input fields required */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Required from Worker
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INPUT_FIELD_OPTIONS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => {
                          const has = form.inputFields.includes(f.id);
                          update('inputFields', has ? form.inputFields.filter(x => x !== f.id) : [...form.inputFields, f.id]);
                        }}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[10px] font-bold cursor-pointer transition-all"
                        style={{
                          background: form.inputFields.includes(f.id) ? 'rgba(255,138,0,0.15)' : 'rgba(255,255,255,0.04)',
                          border: form.inputFields.includes(f.id) ? '1px solid rgba(255,138,0,0.4)' : '1px solid rgba(255,255,255,0.07)',
                          color: form.inputFields.includes(f.id) ? '#FF8A00' : '#64748b',
                        }}
                      >
                        <span>{f.icon}</span>
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Example images placeholder */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Example Images <span className="text-slate-600 normal-case font-normal">(optional, up to 5)</span>
                  </label>
                  <button
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-[16px] cursor-pointer transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px dashed rgba(255,255,255,0.12)' }}
                  >
                    <ImagePlus size={16} className="text-slate-500" />
                    <span className="text-[11px] font-semibold text-slate-500">Add example screenshots</span>
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 4: Reward + Workers + Budget ────────────────────────── */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-white mb-1">Reward & Budget</h3>
                  <p className="text-[10px] text-slate-500 mb-4">Set how much each worker earns and how many you need.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      Reward / Worker (EFC)
                    </label>
                    <input
                      type="number"
                      min={2}
                      value={form.reward}
                      onChange={e => update('reward', Math.max(2, Number(e.target.value)))}
                      className="w-full px-4 py-3 rounded-[16px] text-sm font-bold text-[#FFD700] focus:outline-none text-center"
                      style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      How Many Workers
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.workerLimit}
                      onChange={e => update('workerLimit', Math.max(1, Number(e.target.value)))}
                      className="w-full px-4 py-3 rounded-[16px] text-sm font-bold text-white focus:outline-none text-center"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      Daily Limit (0 = no limit)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.dailyLimit}
                      onChange={e => update('dailyLimit', Math.max(0, Number(e.target.value)))}
                      className="w-full px-4 py-3 rounded-[16px] text-sm text-white focus:outline-none text-center"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                      Expires (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.expiryDays}
                      onChange={e => update('expiryDays', Math.max(1, Math.min(30, Number(e.target.value))))}
                      className="w-full px-4 py-3 rounded-[16px] text-sm text-white focus:outline-none text-center"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>

                {/* Cost breakdown */}
                {cost && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[20px] p-4 space-y-2"
                    style={{
                      background: canAfford ? 'rgba(255,215,0,0.06)' : 'rgba(255,77,109,0.08)',
                      border: canAfford ? '1px solid rgba(255,215,0,0.2)' : '1px solid rgba(255,77,109,0.3)',
                    }}
                  >
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Reward Pool ({form.reward} × {form.workerLimit})</span>
                      <span className="font-bold text-white">{cost.rewardPool.toFixed(1)} EFC</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Platform Fee (25%)</span>
                      <span className="font-bold text-slate-300">{cost.platformFee.toFixed(1)} EFC</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Verification Fee</span>
                      <span className="font-bold text-slate-300">{cost.verificationFee.toFixed(1)} EFC</span>
                    </div>
                    <div className="h-px bg-white/8 my-1" />
                    <div className="flex justify-between text-[12px]">
                      <span className="font-black text-white">Total Escrow</span>
                      <span className="font-black text-[#FFD700]">{cost.escrowTotal.toFixed(1)} EFC</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-400">Your Balance</span>
                      <span className={`font-bold ${canAfford ? 'text-[#00FF88]' : 'text-[#FF4D6D]'}`}>
                        {efcBalance.toFixed(1)} EFC
                      </span>
                    </div>
                    {!canAfford && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <AlertTriangle size={12} className="text-[#FF4D6D]" />
                        <span className="text-[10px] font-bold text-[#FF4D6D]">
                          Insufficient balance. Need {(cost.escrowTotal - efcBalance).toFixed(1)} more EFC.
                        </span>
                      </div>
                    )}
                    <p className="text-[9px] text-slate-600 pt-1 leading-relaxed">
                      Unused slots are refunded in full (reward + fee) if the task expires or you cancel.
                    </p>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── Step 5: Verification ──────────────────────────────────────── */}
            {step === 5 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-white mb-1">Verification Method</h3>
                  <p className="text-[10px] text-slate-500 mb-4">How do we confirm workers completed the task?</p>
                </div>

                <div className="space-y-3">
                  {VERIFICATION_TYPES.map(v => (
                    <button
                      key={v.id}
                      onClick={() => update('verificationType', v.id as TaskForm['verificationType'])}
                      className="w-full flex items-center gap-4 p-4 rounded-[18px] cursor-pointer transition-all text-left"
                      style={{
                        background: form.verificationType === v.id ? `${v.color}12` : 'rgba(255,255,255,0.04)',
                        border: form.verificationType === v.id ? `1.5px solid ${v.color}55` : '1px solid rgba(255,255,255,0.08)',
                        boxShadow: form.verificationType === v.id ? `0 0 16px ${v.color}15` : 'none',
                      }}
                    >
                      <span className="text-2xl">{v.icon}</span>
                      <div className="flex-1">
                        <div className="text-sm font-bold" style={{ color: form.verificationType === v.id ? v.color : '#cbd5e1' }}>
                          {v.label}
                        </div>
                        <div className="text-[10px] text-slate-500">{v.desc}</div>
                      </div>
                      {form.verificationType === v.id && (
                        <CheckCircle2 size={16} style={{ color: v.color }} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 6: Audience + Review ──────────────────────────────────── */}
            {step === 6 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-white mb-1">Audience & Review</h3>
                  <p className="text-[10px] text-slate-500 mb-4">Who can complete your task?</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {AUDIENCE_TYPES.map(a => (
                    <button
                      key={a.id}
                      onClick={() => update('audienceType', a.id)}
                      className="flex items-center gap-2 p-3.5 rounded-[16px] cursor-pointer transition-all"
                      style={{
                        background: form.audienceType === a.id ? 'rgba(255,138,0,0.14)' : 'rgba(255,255,255,0.04)',
                        border: form.audienceType === a.id ? '1.5px solid rgba(255,138,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      <span className="text-base">{a.icon}</span>
                      <span className="text-[11px] font-bold" style={{ color: form.audienceType === a.id ? '#FF8A00' : '#64748b' }}>
                        {a.label}
                      </span>
                    </button>
                  ))}
                </div>

                {form.audienceType === 'level' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Minimum Level</label>
                    <input type="number" min={1} max={100} value={form.minLevel}
                      onChange={e => update('minLevel', Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-[16px] text-sm text-white focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                )}

                {/* Final summary */}
                <div className="rounded-[20px] p-4 space-y-2.5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Summary</p>
                  {[
                    ['Platform', `${form.platform} · ${form.action}`],
                    ['Title', form.title],
                    ['Reward', `${form.reward} EFC × ${form.workerLimit} workers`],
                    ['Expires', `${form.expiryDays} days`],
                    ['Verification', form.verificationType],
                    ['Audience', form.audienceType],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-[11px]">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-bold text-white text-right max-w-[60%] truncate">{value}</span>
                    </div>
                  ))}
                  {cost && (
                    <>
                      <div className="h-px bg-white/8" />
                      <div className="flex justify-between text-[12px]">
                        <span className="font-black text-white">Total Escrow</span>
                        <span className="font-black text-[#FFD700]">{cost.escrowTotal.toFixed(1)} EFC</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Moderation notice */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-[14px]"
                  style={{ background: 'rgba(255,200,87,0.08)', border: '1px solid rgba(255,200,87,0.2)' }}>
                  <AlertTriangle size={13} className="text-[#FFC857] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Tasks are reviewed before going live. Violations (harassment, fake accounts, adult content) will be rejected and may result in account suspension.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Buttons */}
      <div className="px-5 pb-6 pt-3 shrink-0 flex gap-3"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {step > 1 && (
          <button
            onClick={goPrev}
            className="w-11 h-11 rounded-[14px] flex items-center justify-center cursor-pointer shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <ChevronLeft size={18} className="text-slate-400" />
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button
            onClick={goNext}
            disabled={!stepValid()}
            className="flex-1 h-11 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{
              background: stepValid()
                ? 'linear-gradient(135deg, #FF8A00, #FFD700)'
                : 'rgba(255,255,255,0.06)',
              boxShadow: stepValid() ? '0 0 20px rgba(255,138,0,0.3)' : 'none',
              color: stepValid() ? 'white' : '#475569',
            }}
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting || !canAfford}
            className="flex-1 h-11 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{
              background: !canAfford
                ? 'rgba(255,77,109,0.15)'
                : 'linear-gradient(135deg, #FF8A00, #FFD700)',
              border: !canAfford ? '1px solid rgba(255,77,109,0.4)' : 'none',
              boxShadow: canAfford && !submitting ? '0 0 24px rgba(255,138,0,0.4)' : 'none',
              color: canAfford ? 'white' : '#FF4D6D',
            }}
          >
            {submitting ? (
              <><Loader2 size={15} className="animate-spin" /> Creating Task...</>
            ) : !canAfford ? (
              'Insufficient Balance'
            ) : (
              '✨ Create Task'
            )}
          </button>
        )}
      </div>
    </div>
  );
};
