import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Plus,
  CheckCircle2, Loader2,
} from 'lucide-react';
import {
  PLATFORMS, PLATFORM_ACTIONS, calculateTaskCost, createMarketTask,
  type CreateTaskPayload,
} from '../../lib/marketService';
import { type TelegramUser } from '../../lib/telegramUser';
import { PlatformIcon, ActionIcon } from './components/PlatformIcons';

interface TaskBuilderProps {
  onClose: () => void;
  telegramUser: TelegramUser | null;
  efcBalance: number;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onCreated: () => void;
}

const TOTAL_STEPS = 3;

// Actions that support multi-select (checkboxes)
const MULTI_SELECT_ACTIONS: Record<string, string[]> = {
  X: ['Like', 'Repost', 'Bookmark', 'Reply', 'Views (20/1k)'],
  Instagram: ['Like', 'Comment', 'Share Story', 'Reel View'],
  YouTube: ['Like Video', 'Comment', 'Watch Video'],
  TikTok: ['Like Video', 'Comment', 'Share'],
  Reddit: ['Upvote Post', 'Comment'],
  Discord: ['React to Message', 'Send Message'],
};

const INPUT_FIELD_OPTIONS = [
  { id: 'screenshot', label: 'Screenshot', icon: '📷' },
  { id: 'telegram_username', label: 'Telegram Username', icon: '✈️' },
  { id: 'x_username', label: 'X (Twitter) Username', icon: '𝕏' },
  { id: 'wallet_address', label: 'Wallet Address', icon: '💳' },
  { id: 'email', label: 'Email Address', icon: '✉️' },
  { id: 'uid', label: 'User ID / UID', icon: '🔑' },
  { id: 'tx_hash', label: 'Transaction Hash', icon: '🔗' },
];

interface ActionConfig {
  actionLabel: string;
  url?: string;
  minChars?: number;
  requiredKeywords?: string;
  minWatchSeconds?: number;
}

interface TaskForm {
  platform: string;
  actions: string[];         // multi-select actions
  actionConfigs: Record<string, ActionConfig>; // per-action dynamic inputs
  targetUrl: string;
  title: string;
  description: string;        // "what should workers do"
  noteToReviewers: string;    // private note visible only to reviewers
  checklist: string[];
  inputFields: string[];
  exampleImages: string[];
  reward: number;
  workerLimit: number;
  expiryDays: number;
  startPaused: boolean;
  verificationType: 'automatic' | 'manual' | 'hybrid';
  audienceType: string;
  minLevel: number;
}

const DEFAULT_FORM: TaskForm = {
  platform: '',
  actions: [],
  actionConfigs: {},
  targetUrl: '',
  title: '',
  description: '',
  noteToReviewers: '',
  checklist: [],
  inputFields: ['screenshot'],
  exampleImages: [],
  reward: 10,
  workerLimit: 10,
  expiryDays: 7,
  startPaused: false,
  verificationType: 'manual',
  audienceType: 'everyone',
  minLevel: 1,
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

  const updateActionConfig = (actionLabel: string, field: keyof ActionConfig, val: any) => {
    setForm(prev => ({
      ...prev,
      actionConfigs: {
        ...prev.actionConfigs,
        [actionLabel]: {
          ...(prev.actionConfigs[actionLabel] || { actionLabel }),
          [field]: val,
        },
      },
    }));
  };

  const allActions = PLATFORM_ACTIONS[form.platform] || [];
  const multiActions = allActions.filter(a =>
    (MULTI_SELECT_ACTIONS[form.platform] || []).includes(a.label)
  );
  const singleActions = allActions.filter(a =>
    !(MULTI_SELECT_ACTIONS[form.platform] || []).includes(a.label)
  );

  const cost = form.reward && form.workerLimit
    ? calculateTaskCost(form.reward, form.workerLimit, form.verificationType, form.expiryDays)
    : null;
  const deficit = cost ? Math.max(0, cost.escrowTotal - efcBalance) : 0;
  const canAfford = deficit === 0;

  const toggleAction = (label: string) => {
    const inMulti = (MULTI_SELECT_ACTIONS[form.platform] || []).includes(label);
    if (inMulti) {
      const has = form.actions.includes(label);
      const nextActions = has ? form.actions.filter(a => a !== label) : [...form.actions, label];
      update('actions', nextActions);
    } else {
      const multi = form.actions.filter(a => (MULTI_SELECT_ACTIONS[form.platform] || []).includes(a));
      const alreadySelected = form.actions.includes(label);
      update('actions', alreadySelected ? multi : [...multi, label]);
    }
  };

  const goNext = () => { if (step < TOTAL_STEPS) { setDirection(1); setStep(s => s + 1); } };
  const goPrev = () => { if (step > 1) { setDirection(-1); setStep(s => s - 1); } };

  const stepValid = () => {
    switch (step) {
      case 1: return !!form.platform && form.actions.length > 0;
      case 2: return !!form.targetUrl.trim() && !!form.title.trim() && !!form.description.trim();
      case 3: return form.reward >= 2 && form.workerLimit >= 1;
      default: return true;
    }
  };

  const handleSubmit = async () => {
    if (!telegramUser) return showToast('Not logged in', 'error');
    if (!canAfford) return showToast('Insufficient EFC balance', 'error');
    if (form.actions.length === 0) return showToast('Please select at least one action', 'warning');

    setSubmitting(true);
    const payload: CreateTaskPayload = {
      telegramId: telegramUser.id,
      platform: form.platform,
      action: form.actions.join(', '),
      targetUrl: form.targetUrl,
      title: form.title,
      description: form.description,
      instructions: form.noteToReviewers || '',
      exampleImages: form.exampleImages,
      checklist: form.checklist,
      inputFields: form.inputFields,
      reward: form.reward,
      workerLimit: form.workerLimit,
      dailyLimit: 0,
      cooldownHours: 0,
      expiryDays: form.expiryDays,
      audience: { type: form.audienceType as CreateTaskPayload['audience']['type'], minLevel: form.minLevel },
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

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#fff',
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0A0D1A' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0 border-b border-white/[0.06]">
        <button onClick={onClose} className="w-8 h-8 rounded-2xl bg-white/6 flex items-center justify-center cursor-pointer">
          <X size={16} className="text-slate-400" />
        </button>
        {/* Step dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i + 1 === step ? 22 : 6, height: 6,
                background: i + 1 <= step
                  ? 'linear-gradient(90deg, #FF8A00, #FFD700)'
                  : 'rgba(255,255,255,0.1)',
              }}
            />
          ))}
        </div>
        <div className="w-8" />
      </div>

      {/* Info banner */}
      <div className="mx-4 mt-3 p-3 rounded-2xl text-[10px] text-slate-400 leading-relaxed" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        Fund a task from your balance and real users complete it, verified like any sponsored task. A <span className="text-[#FF8A00] font-bold">25% fee</span> applies per completed action, plus verification costs where shown.
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 mt-3">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -28 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-5"
          >

            {/* ── STEP 1: Platform + Action ──────────────────────────────────── */}
            {step === 1 && (
              <>
                {/* Platform */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2.5">Platform</p>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { update('platform', p.id); update('actions', []); }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-[20px] text-xs font-bold cursor-pointer transition-all"
                        style={{
                          background: form.platform === p.id ? `${p.color}20` : 'rgba(255,255,255,0.05)',
                          border: form.platform === p.id ? `1.5px solid ${p.color}70` : '1px solid rgba(255,255,255,0.1)',
                          color: form.platform === p.id ? p.color : '#64748b',
                        }}
                      >
                        <PlatformIcon platformId={p.id} size={15} color={form.platform === p.id ? p.color : '#64748b'} />
                        {p.id}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                {form.platform && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Action</p>

                    {/* Multi-select actions (checkboxes) */}
                    {multiActions.length > 0 && (
                      <div className="space-y-1">
                        {multiActions.length > 1 && (
                          <p className="text-[9px] text-slate-600 mb-2">Tick several to order them all on one post.</p>
                        )}
                        {multiActions.map(a => {
                          const checked = form.actions.includes(a.label);
                          return (
                            <button
                              key={a.label}
                              onClick={() => toggleAction(a.label)}
                              className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px] cursor-pointer transition-all text-left"
                              style={{
                                background: checked ? 'rgba(255,138,0,0.1)' : 'rgba(255,255,255,0.03)',
                                border: checked ? '1px solid rgba(255,138,0,0.4)' : '1px solid rgba(255,255,255,0.07)',
                              }}
                            >
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-[#FF8A00] border-[#FF8A00]' : 'border-slate-600'}`}>
                                {checked && <CheckCircle2 size={13} className="text-black" />}
                              </div>
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <ActionIcon action={a.label} size={15} color={checked ? '#FF8A00' : '#64748b'} />
                                <span className="text-sm font-bold" style={{ color: checked ? '#FF8A00' : '#cbd5e1' }}>
                                  {a.label}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500 shrink-0">from {a.baseReward}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Single-select actions */}
                    {singleActions.length > 0 && (
                      <div>
                        {multiActions.length > 0 && (
                          <p className="text-[9px] text-slate-500 mb-2 mt-1">Or pick one:</p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {singleActions.map(a => {
                            const selected = form.actions.includes(a.label);
                            return (
                              <button
                                key={a.label}
                                onClick={() => toggleAction(a.label)}
                                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[20px] text-xs font-bold cursor-pointer transition-all"
                                style={{
                                  background: selected ? 'rgba(255,138,0,0.15)' : 'rgba(255,255,255,0.04)',
                                  border: selected ? '1.5px solid rgba(255,138,0,0.55)' : '1px solid rgba(255,255,255,0.1)',
                                  color: selected ? '#FF8A00' : '#64748b',
                                }}
                              >
                                <ActionIcon action={a.label} size={13} color={selected ? '#FF8A00' : '#64748b'} />
                                {a.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </>
            )}

            {/* ── STEP 2: Task Details + Dynamic Actions Config ───────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Main Target URL */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Primary Target URL</p>
                  <input
                    type="text"
                    value={form.targetUrl}
                    onChange={e => update('targetUrl', e.target.value)}
                    placeholder={
                      form.platform === 'X' ? 'https://x.com/EliteForceOFC' :
                      form.platform === 'Telegram' ? 'https://t.me/YourChannel' :
                      form.platform === 'Instagram' ? 'https://instagram.com/yourprofile' :
                      'https://...'
                    }
                    className="w-full px-4 py-3 rounded-[16px] text-sm placeholder-slate-600 focus:outline-none"
                    style={inputStyle}
                  />
                </div>

                {/* Per-Action Dynamic Configuration Cards */}
                {form.actions.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Action Configurations ({form.actions.length} Selected)
                    </p>

                    {form.actions.map(actionLabel => {
                      const config = form.actionConfigs[actionLabel] || {};
                      const isReply = actionLabel.toLowerCase().includes('reply') || actionLabel.toLowerCase().includes('comment');
                      const isWatch = actionLabel.toLowerCase().includes('watch');

                      return (
                        <div key={actionLabel} className="p-3.5 rounded-[18px] space-y-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,138,0,0.25)' }}>
                          <div className="flex items-center gap-2">
                            <ActionIcon action={actionLabel} size={15} color="#FF8A00" />
                            <span className="text-xs font-black text-[#FF8A00]">{actionLabel}</span>
                          </div>

                          {/* URL input */}
                          <input
                            type="text"
                            value={config.url || form.targetUrl}
                            onChange={e => updateActionConfig(actionLabel, 'url', e.target.value)}
                            placeholder={`Specific URL for ${actionLabel}...`}
                            className="w-full px-3 py-2 rounded-[12px] text-xs placeholder-slate-600 focus:outline-none"
                            style={inputStyle}
                          />

                          {/* Extra fields for reply/comment */}
                          {isReply && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block mb-1">Min Characters</label>
                                <input
                                  type="number"
                                  min={5}
                                  value={config.minChars || 20}
                                  onChange={e => updateActionConfig(actionLabel, 'minChars', Number(e.target.value))}
                                  className="w-full px-3 py-2 rounded-[10px] text-xs font-bold focus:outline-none text-white"
                                  style={inputStyle}
                                />
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 block mb-1">Required Keywords</label>
                                <input
                                  type="text"
                                  value={config.requiredKeywords || ''}
                                  onChange={e => updateActionConfig(actionLabel, 'requiredKeywords', e.target.value)}
                                  placeholder="#GOMINE, @Elite..."
                                  className="w-full px-3 py-2 rounded-[10px] text-xs focus:outline-none text-white"
                                  style={inputStyle}
                                />
                              </div>
                            </div>
                          )}

                          {/* Extra fields for Watch Video */}
                          {isWatch && (
                            <div className="pt-1">
                              <label className="text-[9px] font-bold text-slate-500 block mb-1">Min Watch Seconds</label>
                              <input
                                type="number"
                                min={10}
                                value={config.minWatchSeconds || 60}
                                onChange={e => updateActionConfig(actionLabel, 'minWatchSeconds', Number(e.target.value))}
                                className="w-full px-3 py-2 rounded-[10px] text-xs font-bold focus:outline-none text-white"
                                style={inputStyle}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Task Title */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Task Title</p>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => update('title', e.target.value)}
                    placeholder="Short title, e.g. Sign up on Invent"
                    maxLength={60}
                    className="w-full px-4 py-3 rounded-[16px] text-sm placeholder-slate-600 focus:outline-none"
                    style={inputStyle}
                  />
                  <div className="text-right text-[9px] text-slate-600 mt-1">{form.title.length}/60</div>
                </div>

                {/* What should workers do */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">What should workers do?</p>
                  <textarea
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                    placeholder={"Describe the exact steps. e.g.\nOpen the link, read the post, and reply with\nyour honest feedback. Take a screenshot of\nyour reply as proof."}
                    rows={4}
                    className="w-full px-4 py-3 rounded-[16px] text-sm placeholder-slate-600 focus:outline-none resize-none"
                    style={inputStyle}
                  />
                </div>

                {/* Steps Checklist */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Steps Checklist <span className="normal-case font-normal text-slate-600">(Optional)</span></p>

                  {form.checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1.5 px-3 py-2 rounded-[12px]"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-[#FF8A00] shrink-0 border border-[#FF8A00]/40">{idx + 1}</span>
                      <span className="text-xs text-slate-300 flex-1">{item}</span>
                      <button onClick={() => update('checklist', form.checklist.filter((_, i) => i !== idx))}
                        className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer shrink-0">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      setNewChecklistItem('');
                      update('checklist', [...form.checklist, '']);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[12px] text-xs font-bold cursor-pointer transition-all mt-1"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)', color: '#64748b' }}
                  >
                    <Plus size={13} /> + Add step
                  </button>
                  {form.checklist.length > 0 && form.checklist[form.checklist.length - 1] === '' && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        autoFocus
                        value={newChecklistItem}
                        onChange={e => setNewChecklistItem(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newChecklistItem.trim()) {
                            const updated = [...form.checklist];
                            updated[updated.length - 1] = newChecklistItem.trim();
                            update('checklist', updated);
                            setNewChecklistItem('');
                          }
                        }}
                        placeholder="Describe step... (Enter to add)"
                        className="flex-1 px-3 py-2 rounded-[10px] text-xs placeholder-slate-600 focus:outline-none"
                        style={inputStyle}
                      />
                      <button
                        onClick={() => {
                          if (newChecklistItem.trim()) {
                            const updated = [...form.checklist];
                            updated[updated.length - 1] = newChecklistItem.trim();
                            update('checklist', updated);
                            setNewChecklistItem('');
                          }
                        }}
                        className="px-3 py-2 rounded-[10px] cursor-pointer text-xs font-bold"
                        style={{ background: 'rgba(255,138,0,0.15)', border: '1px solid rgba(255,138,0,0.3)', color: '#FF8A00' }}
                      >Add</button>
                    </div>
                  )}
                </div>

                {/* Input Fields Picker */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Input Fields Required from Workers</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {INPUT_FIELD_OPTIONS.map(o => {
                      const selected = form.inputFields.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => {
                            const has = form.inputFields.includes(o.id);
                            update('inputFields', has ? form.inputFields.filter(f => f !== o.id) : [...form.inputFields, o.id]);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] text-xs font-bold cursor-pointer transition-all"
                          style={{
                            background: selected ? 'rgba(255,138,0,0.15)' : 'rgba(255,255,255,0.04)',
                            border: selected ? '1.5px solid rgba(255,138,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                            color: selected ? '#FF8A00' : '#64748b',
                          }}
                        >
                          <span>{o.icon}</span><span>{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Note to reviewers */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Note to Reviewers <span className="normal-case font-normal text-slate-600">(Optional)</span></p>
                  <textarea
                    value={form.noteToReviewers}
                    onChange={e => update('noteToReviewers', e.target.value)}
                    placeholder="e.g. A valid screenshot shows the dashboard with a green checkmark"
                    rows={3}
                    className="w-full px-4 py-3 rounded-[16px] text-xs placeholder-slate-600 focus:outline-none resize-none"
                    style={inputStyle}
                  />
                  <p className="text-[9px] text-slate-600 mt-1">🔒 Only visible to screenshot reviewers.</p>
                </div>
              </div>
            )}

            {/* ── STEP 3: Reward, Capacity & Itemized Escrow Summary Card ────── */}
            {step === 3 && (
              <div className="space-y-4">
                {/* Reward / Each (MIN 10) | How Many | Expires */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-[16px] text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">REWARD / EACH</p>
                    <p className="text-[8px] text-slate-600 mb-1">(MIN 10)</p>
                    <input
                      type="number"
                      min={10}
                      value={form.reward}
                      onChange={e => update('reward', Math.max(10, Number(e.target.value)))}
                      className="w-full text-center text-sm font-black text-[#FF8A00] bg-transparent focus:outline-none"
                    />
                    <span className="text-[9px] font-bold text-slate-500">GOMINE</span>
                  </div>

                  <div className="p-3 rounded-[16px] text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">HOW MANY</p>
                    <p className="text-[8px] text-transparent mb-1">-</p>
                    <input
                      type="number"
                      min={1}
                      value={form.workerLimit}
                      onChange={e => update('workerLimit', Math.max(1, Number(e.target.value)))}
                      className="w-full text-center text-sm font-black text-white bg-transparent focus:outline-none"
                    />
                    <span className="text-[9px] font-bold text-slate-500">Workers</span>
                  </div>

                  <div className="p-3 rounded-[16px] text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">EXPIRES (DAYS)</p>
                    <p className="text-[8px] text-transparent mb-1">-</p>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.expiryDays}
                      onChange={e => update('expiryDays', Math.max(1, Math.min(30, Number(e.target.value))))}
                      className="w-full text-center text-sm font-black text-white bg-transparent focus:outline-none"
                    />
                    <span className="text-[9px] font-bold text-slate-500">Days</span>
                  </div>
                </div>

                {/* Who can do this task */}
                <div className="flex items-center justify-between p-3.5 rounded-[16px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span className="text-xs font-bold text-slate-300">Who can do this task</span>
                  <select
                    value={form.audienceType}
                    onChange={e => update('audienceType', e.target.value)}
                    className="bg-transparent text-xs font-bold text-[#FF8A00] focus:outline-none cursor-pointer text-right"
                  >
                    <option value="everyone" className="bg-slate-900">Anyone</option>
                    <option value="premium" className="bg-slate-900">Premium Only</option>
                    <option value="level" className="bg-slate-900">Level 5+</option>
                  </select>
                </div>

                {/* Itemized Cost Summary Card (Matches Reference Screenshot 2) */}
                {cost && (
                  <div className="p-4 rounded-[20px] space-y-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">{form.reward} GOMINE × {form.workerLimit}</span>
                      <span className="font-bold text-white">{cost.rewardPool.toFixed(0)} GOMINE</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Service fee (25%)</span>
                      <span className="font-bold text-slate-300">{cost.platformFee.toFixed(0)} GOMINE</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Verification × {form.workerLimit}</span>
                      <span className="font-bold text-slate-300">{cost.verificationFee.toFixed(0)} GOMINE</span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Review fee (one-time)</span>
                      <span className="font-bold text-slate-300">{cost.reviewFee.toFixed(0)} GOMINE</span>
                    </div>

                    <div className="h-px bg-white/10 my-2" />

                    <div className="flex justify-between items-center text-sm">
                      <span className="font-black text-white">Total escrowed</span>
                      <span className="font-black text-white">{cost.escrowTotal.toFixed(0)} GOMINE</span>
                    </div>

                    {/* Balance & Deficit */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-[#FF8A00] underline">
                        {canAfford ? 'Available Balance' : 'Insufficient - top up'}
                      </span>
                      <span className={`font-black ${canAfford ? 'text-[#00FF88]' : 'text-[#FF8A00]'}`}>
                        {canAfford ? `${efcBalance.toFixed(0)} GOMINE` : `-${deficit.toFixed(0)} GOMINE`}
                      </span>
                    </div>

                    <p className="text-[9px] text-slate-500 pt-1 leading-relaxed">
                      Unfinished units are refunded in full (reward + fee + verification) if the task expires or you cancel.
                    </p>
                  </div>
                )}

                {/* Moderation policy summary */}
                <div className="p-3.5 rounded-[16px]" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-xs font-black text-white mb-1">Reviewed before going live</p>
                  <p className="text-[9px] text-slate-400 leading-relaxed">
                    Custom tasks are checked by a moderator first. Not allowed: anything involving wallets, seed phrases, or signing transactions; sending money; paid or fake reviews; mass-reporting; creating accounts or adult content.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer / Submit or Top Up */}
      <div className="px-4 pb-6 pt-3 shrink-0 flex gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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
              background: stepValid() ? 'linear-gradient(135deg, #FF8A00, #FFD700)' : 'rgba(255,255,255,0.06)',
              color: stepValid() ? 'white' : '#475569',
            }}
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : !canAfford ? (
          <button
            onClick={() => showToast(`Deposit at least ${deficit.toFixed(0)} GOMINE to fund this task.`, 'warning')}
            className="flex-1 h-11 rounded-[14px] text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{
              background: 'rgba(255,138,0,0.15)',
              border: '1.5px solid #FF8A00',
              color: '#FF8A00',
            }}
          >
            Top up ↗
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-11 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer transition-all"
            style={{
              background: 'linear-gradient(135deg, #FF8A00, #FFD700)',
              boxShadow: '0 0 24px rgba(255,138,0,0.4)',
            }}
          >
            {submitting ? (
              <><Loader2 size={15} className="animate-spin" /> Creating Task...</>
            ) : (
              '✨ Create Task'
            )}
          </button>
        )}
      </div>
    </div>
  );
};
