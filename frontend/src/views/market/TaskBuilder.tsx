import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Plus, ImagePlus,
  AlertTriangle, CheckCircle2, Loader2,
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

interface TaskForm {
  platform: string;
  actions: string[];         // multi-select actions
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
  const [newCustomField, setNewCustomField] = useState('');
  const [showCustomField, setShowCustomField] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState(1);

  const update = useCallback(<K extends keyof TaskForm>(key: K, value: TaskForm[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  }, []);

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
  const canAfford = cost ? efcBalance >= cost.escrowTotal : true;

  const toggleAction = (label: string) => {
    const inMulti = (MULTI_SELECT_ACTIONS[form.platform] || []).includes(label);
    if (inMulti) {
      // toggle multi-select
      const has = form.actions.includes(label);
      update('actions', has ? form.actions.filter(a => a !== label) : [...form.actions, label]);
    } else {
      // single-select: replace any single actions with this one (keep multi)
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

                    {/* If only single actions exist (no multi) */}
                    {multiActions.length === 0 && singleActions.length === 0 && allActions.length > 0 && (
                      <div className="space-y-1.5">
                        {allActions.map(a => {
                          const selected = form.actions.includes(a.label);
                          return (
                            <button
                              key={a.label}
                              onClick={() => update('actions', [a.label])}
                              className="w-full flex items-center justify-between px-4 py-3 rounded-[16px] cursor-pointer transition-all"
                              style={{
                                background: selected ? 'rgba(255,138,0,0.12)' : 'rgba(255,255,255,0.04)',
                                border: selected ? '1px solid rgba(255,138,0,0.45)' : '1px solid rgba(255,255,255,0.07)',
                              }}
                            >
                              <div className="flex items-center gap-2.5">
                                <ActionIcon action={a.label} size={15} color={selected ? '#FF8A00' : '#64748b'} />
                                <span className="text-sm font-bold" style={{ color: selected ? '#FF8A00' : '#cbd5e1' }}>{a.label}</span>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">from {a.baseReward}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </>
            )}

            {/* ── STEP 2: Task Details ────────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Target URL */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Target</p>
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

                {/* Task Title */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Task Title</p>
                  <p className="text-[9px] text-slate-600 mb-2">A clear, short name for the task, shown on the Market card and in messages.</p>
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
                  <p className="text-[9px] text-slate-600 mb-2">Describe the exact steps. e.g. Open the link, read the post, and reply with your honest feedback. Take a screenshot of your reply as proof.</p>
                  <textarea
                    value={form.description}
                    onChange={e => update('description', e.target.value)}
                    placeholder={"Describe the exact steps. e.g.\nOpen the link, read the post, and reply with\nyour honest feedback. Take a screenshot of\nyour reply as proof."}
                    rows={4}
                    className="w-full px-4 py-3 rounded-[16px] text-sm placeholder-slate-600 focus:outline-none resize-none"
                    style={inputStyle}
                  />
                  <p className="text-[9px] text-slate-600 mt-1">Be specific. Workers see this and upload a screenshot of what they did.</p>
                </div>

                {/* Example Screenshots */}
                <div>
                  <button
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-[16px] cursor-pointer transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1.5px dashed rgba(255,255,255,0.12)' }}
                  >
                    <ImagePlus size={15} className="text-slate-500" />
                    <span className="text-[11px] font-semibold text-slate-500">Add example screenshots (optional, up to 3)</span>
                  </button>
                  <p className="text-[9px] text-slate-600 mt-1">Optional. Shown to workers and reviewers as an example of a valid submission.</p>
                </div>

                {/* Steps Checklist */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Steps Checklist <span className="normal-case font-normal text-slate-600">(Optional)</span></p>
                  <p className="text-[9px] text-slate-600 mb-2">Add the steps a worker must complete, in order. They tick each one off and can't submit until every box is checked.</p>

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
                          if (e.key === 'Escape') {
                            update('checklist', form.checklist.slice(0, -1));
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
                          } else {
                            update('checklist', form.checklist.slice(0, -1));
                          }
                        }}
                        className="px-3 py-2 rounded-[10px] cursor-pointer text-xs font-bold"
                        style={{ background: 'rgba(255,138,0,0.15)', border: '1px solid rgba(255,138,0,0.3)', color: '#FF8A00' }}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>

                {/* Input Fields */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Input Fields <span className="normal-case font-normal text-slate-600">(Optional)</span></p>
                  <p className="text-[9px] text-slate-600 mb-2">Fields the worker fills in when submitting (e.g. their UID or email). The values appear on the proof for you to review.</p>

                  {form.inputFields.map((field, idx) => {
                    const opt = INPUT_FIELD_OPTIONS.find(o => o.id === field);
                    return (
                      <div key={idx} className="flex items-center gap-2 mb-1.5 px-3 py-2.5 rounded-[12px]"
                        style={{ background: 'rgba(255,138,0,0.08)', border: '1px solid rgba(255,138,0,0.2)' }}>
                        <span className="text-sm">{opt?.icon || '📋'}</span>
                        <span className="text-xs font-bold text-[#FF8A00] flex-1">{opt?.label || field}</span>
                        <button onClick={() => update('inputFields', form.inputFields.filter((_, i) => i !== idx))}
                          className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer">
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Field picker */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {INPUT_FIELD_OPTIONS.filter(o => !form.inputFields.includes(o.id)).map(o => (
                      <button
                        key={o.id}
                        onClick={() => update('inputFields', [...form.inputFields, o.id])}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[10px] font-bold cursor-pointer transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
                      >
                        <span>{o.icon}</span><span>{o.label}</span>
                      </button>
                    ))}
                    {/* Custom field */}
                    {!showCustomField ? (
                      <button
                        onClick={() => setShowCustomField(true)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-[10px] font-bold cursor-pointer transition-all"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}
                      >
                        <Plus size={11} /> + Add field
                      </button>
                    ) : (
                      <div className="flex gap-2 w-full mt-1">
                        <input
                          autoFocus
                          type="text"
                          value={newCustomField}
                          onChange={e => setNewCustomField(e.target.value)}
                          placeholder="Custom field name..."
                          className="flex-1 px-3 py-1.5 rounded-[10px] text-xs placeholder-slate-600 focus:outline-none"
                          style={inputStyle}
                        />
                        <button
                          onClick={() => {
                            if (newCustomField.trim()) {
                              update('inputFields', [...form.inputFields, newCustomField.trim()]);
                              setNewCustomField('');
                            }
                            setShowCustomField(false);
                          }}
                          className="px-3 py-1.5 rounded-[10px] text-xs font-bold cursor-pointer"
                          style={{ background: 'rgba(255,138,0,0.15)', border: '1px solid rgba(255,138,0,0.3)', color: '#FF8A00' }}
                        >Add</button>
                      </div>
                    )}
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
                  <p className="text-[9px] text-slate-600 mt-1">🔒 Only visible to screenshot reviewers. Tell them how to recognize a valid submission — workers never see this.</p>
                </div>

                {/* Start paused toggle */}
                <button
                  onClick={() => update('startPaused', !form.startPaused)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-[16px] cursor-pointer transition-all"
                  style={{
                    background: form.startPaused ? 'rgba(255,138,0,0.1)' : 'rgba(255,255,255,0.04)',
                    border: form.startPaused ? '1px solid rgba(255,138,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${form.startPaused ? 'bg-[#FF8A00] border-[#FF8A00]' : 'border-slate-600'}`}>
                    {form.startPaused && <CheckCircle2 size={13} className="text-black" />}
                  </div>
                  <span className="text-xs font-bold" style={{ color: form.startPaused ? '#FF8A00' : '#94a3b8' }}>
                    Start paused after approval
                  </span>
                </button>

                {/* Reviewed before going live */}
                <div className="p-4 rounded-[16px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-xs font-black text-white mb-2">Reviewed before going live</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Custom tasks are checked by a moderator first. Not allowed: anything involving wallets, seed phrases, or signing transactions; sending money; paid or fake reviews and ratings; mass-reporting or harassment; creating accounts or impersonation; adult or illegal content. Violations are rejected and may suspend your account.
                  </p>
                </div>
              </div>
            )}

            {/* ── STEP 3: Reward + Workers + Expiry + Submit ─────────────────── */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-black text-white mb-1">Reward & Budget</h3>
                  <p className="text-[10px] text-slate-500 mb-4">Set how much each worker earns and your total capacity.</p>
                </div>

                {/* Reward / Each — How Many — Expires */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 text-center">Reward / Each</p>
                    <div className="text-center mb-1 text-[8px] text-slate-600">(Min 10)</div>
                    <div className="relative">
                      <input
                        type="number"
                        min={2}
                        value={form.reward}
                        onChange={e => update('reward', Math.max(2, Number(e.target.value)))}
                        className="w-full px-3 py-3 rounded-[14px] text-sm font-black text-center text-[#FF8A00] focus:outline-none"
                        style={{ background: 'rgba(255,138,0,0.1)', border: '1px solid rgba(255,138,0,0.3)' }}
                      />
                      <div className="text-center text-[9px] text-slate-600 mt-1">GOMINE</div>
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 text-center">How Many</p>
                    <div className="text-center mb-1 text-[8px] text-transparent">-</div>
                    <input
                      type="number"
                      min={1}
                      value={form.workerLimit}
                      onChange={e => update('workerLimit', Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-3 rounded-[14px] text-sm font-black text-center text-white focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
                    />
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 text-center">Expires (Days)</p>
                    <div className="text-center mb-1 text-[8px] text-transparent">-</div>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={form.expiryDays}
                      onChange={e => update('expiryDays', Math.max(1, Math.min(30, Number(e.target.value))))}
                      className="w-full px-3 py-3 rounded-[14px] text-sm font-black text-center text-white focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)' }}
                    />
                  </div>
                </div>

                {/* Verification */}
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Verification</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'automatic', label: 'Automatic', icon: '⚡', color: '#00FF88' },
                      { id: 'manual', label: 'Manual Review', icon: '👁️', color: '#FFC857' },
                      { id: 'hybrid', label: 'Hybrid', icon: '🔀', color: '#B388FF' },
                    ].map(v => (
                      <button
                        key={v.id}
                        onClick={() => update('verificationType', v.id as TaskForm['verificationType'])}
                        className="flex flex-col items-center gap-1 p-3 rounded-[14px] cursor-pointer transition-all"
                        style={{
                          background: form.verificationType === v.id ? `${v.color}15` : 'rgba(255,255,255,0.04)',
                          border: form.verificationType === v.id ? `1.5px solid ${v.color}60` : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        <span className="text-lg">{v.icon}</span>
                        <span className="text-[9px] font-bold text-center leading-tight" style={{ color: form.verificationType === v.id ? v.color : '#64748b' }}>
                          {v.label}
                        </span>
                      </button>
                    ))}
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
                      <span className={`font-bold ${canAfford ? 'text-[#00FF88]' : 'text-[#FF4D6D]'}`}>{efcBalance.toFixed(1)} EFC</span>
                    </div>
                    {!canAfford && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <AlertTriangle size={12} className="text-[#FF4D6D]" />
                        <span className="text-[10px] font-bold text-[#FF4D6D]">
                          Need {(cost.escrowTotal - efcBalance).toFixed(1)} more EFC.
                        </span>
                      </div>
                    )}
                    <p className="text-[9px] text-slate-600 pt-1 leading-relaxed">
                      Unused slots are refunded in full if the task expires or you cancel.
                    </p>
                  </motion.div>
                )}

                {/* Task summary */}
                <div className="rounded-[18px] p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Summary</p>
                  {[
                    ['Platform', form.platform],
                    ['Action(s)', form.actions.join(', ') || '—'],
                    ['Title', form.title || '—'],
                    ['Expires', `${form.expiryDays} days`],
                    ['Verification', form.verificationType],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between text-[11px]">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-bold text-white text-right max-w-[55%] truncate">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Moderation notice */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-[14px]"
                  style={{ background: 'rgba(255,200,87,0.08)', border: '1px solid rgba(255,200,87,0.2)' }}>
                  <AlertTriangle size={13} className="text-[#FFC857] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Tasks are reviewed before going live. Violations will be rejected and may result in account suspension.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer */}
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
              background: !canAfford ? 'rgba(255,77,109,0.15)' : 'linear-gradient(135deg, #FF8A00, #FFD700)',
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
