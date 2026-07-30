import React, { useState, useMemo } from 'react';
import {
  X, Check, AlertTriangle, Loader2, ShieldCheck,
} from 'lucide-react';
import {
  PLATFORMS, PLATFORM_ACTIONS, createMarketTask,
  type CreateTaskPayload,
} from '../../lib/marketService';
import { type TelegramUser } from '../../lib/telegramUser';
import { PlatformIcon, ActionIcon, getPlatformColor } from './components/PlatformIcons';

interface TaskBuilderProps {
  onClose: () => void;
  telegramUser: TelegramUser | null;
  efcBalance: number;
  setEfcBalance?: React.Dispatch<React.SetStateAction<number>>;
  usdtBalance?: number;
  setUsdtBalance?: React.Dispatch<React.SetStateAction<number>>;
  showToast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  onCreated: () => void;
}

export const TaskBuilder: React.FC<TaskBuilderProps> = ({
  onClose, telegramUser, efcBalance, setEfcBalance, usdtBalance = 0, setUsdtBalance, showToast, onCreated,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<string>('X');
  const [selectedActions, setSelectedActions] = useState<Record<string, boolean>>({ Like: true });
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [customTitle, setCustomTitle] = useState<string>('');
  const [customDescription, setCustomDescription] = useState<string>('');
  const [customNoteToReviewers, setCustomNoteToReviewers] = useState<string>('');
  const rewardCurrency = 'USDT' as const;
  const [rewardPerEach, setRewardPerEach] = useState<number | string>(0.05);
  const [quantity, setQuantity] = useState<number | string>(10);
  const [expiresDays, setExpiresDays] = useState<number | string>(7);
  const [minTier, setMinTier] = useState<'anyone' | 'bronze' | 'silver' | 'gold'>('anyone');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [startPaused, setStartPaused] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Available actions for selected platform
  const currentPlatformActions = PLATFORM_ACTIONS[selectedPlatform] || PLATFORM_ACTIONS['Custom'] || [];

  const toggleAction = (label: string) => {
    setSelectedActions(prev => ({
      ...prev,
      [label]: !prev[label],
    }));
  };

  // Memoized Escrow Calculations for fast UI responses
  const {
    currencySymbol,
    rewardEach,
    howMany,
    baseSubtotal,
    serviceFee,
    tierCost,
    verificationCost,
    reviewFee,
    totalEscrowRequired,
    balanceAfter,
    isInsufficientBalance,
    isUsdt,
  } = useMemo(() => {
    const isUsdt = rewardCurrency === 'USDT';
    const currencySymbol = isUsdt ? 'USDT' : 'EFC';
    const rewardEach = isUsdt ? Math.max(0.01, Number(rewardPerEach) || 0.01) : Math.max(1, Number(rewardPerEach) || 1);
    const howMany = Math.max(1, Number(quantity) || 1);
    const baseSubtotal = isUsdt ? Number((rewardEach * howMany).toFixed(3)) : rewardEach * howMany;
    const serviceFee = isUsdt ? Number((baseSubtotal * 0.25).toFixed(3)) : Math.round(baseSubtotal * 0.25 * 10) / 10;
    const tierCost = minTier === 'silver' ? (isUsdt ? 0.01 * howMany : 1 * howMany) : minTier === 'gold' ? (isUsdt ? 0.02 * howMany : 2 * howMany) : 0;
    const verificationCost = verifiedOnly ? (isUsdt ? 0.015 * howMany : 1.5 * howMany) : 0;
    const reviewFee = selectedPlatform === 'Custom' ? (isUsdt ? 0.2 : 10) : 0;

    const totalEscrowRequired = isUsdt
      ? Number((baseSubtotal + serviceFee + tierCost + verificationCost + reviewFee).toFixed(3))
      : Math.ceil(baseSubtotal + serviceFee + tierCost + verificationCost + reviewFee);

    const availableBalance = isUsdt ? usdtBalance : efcBalance;
    const balanceAfter = Number((availableBalance - totalEscrowRequired).toFixed(3));
    const isInsufficientBalance = balanceAfter < 0;

    return {
      currencySymbol,
      rewardEach,
      howMany,
      baseSubtotal,
      serviceFee,
      tierCost,
      verificationCost,
      reviewFee,
      totalEscrowRequired,
      balanceAfter,
      isInsufficientBalance,
      isUsdt,
    };
  }, [rewardCurrency, rewardPerEach, quantity, minTier, verifiedOnly, selectedPlatform, usdtBalance, efcBalance]);

  const handleSubmit = () => {
    if (!telegramUser) {
      showToast('Please open in Telegram to create tasks.', 'warning');
      return;
    }

    const activeActions = Object.keys(selectedActions).filter(k => selectedActions[k]);
    if (activeActions.length === 0) {
      showToast('Please select at least one action.', 'warning');
      return;
    }

    if (selectedPlatform !== 'Custom' && !targetUrl.trim()) {
      showToast('Please enter a target URL for your task.', 'warning');
      return;
    }

    if (selectedPlatform === 'Custom' && !customTitle.trim()) {
      showToast('Please enter a short title for your custom task.', 'warning');
      return;
    }

    if (isInsufficientBalance) {
      const availableBalance = isUsdt ? usdtBalance : efcBalance;
      showToast(`Insufficient balance. Needed: ${totalEscrowRequired} ${currencySymbol}, Available: ${availableBalance} ${currencySymbol}`, 'error');
      return;
    }

    // Set loading immediately to paint button state on main thread without blocking INP
    setSubmitting(true);

    setTimeout(async () => {
      try {
        const actionLabel = activeActions.join(', ');
        const finalTitle =
          selectedPlatform === 'Custom'
            ? customTitle.trim()
            : `${selectedPlatform.toUpperCase()} ${actionLabel} Campaign`;

        const finalDescription =
          selectedPlatform === 'Custom'
            ? customDescription.trim()
            : `Complete ${actionLabel} on ${targetUrl.trim()}`;

        const payload: CreateTaskPayload = {
          telegramId: telegramUser.id,
          platform: selectedPlatform,
          action: actionLabel,
          targetUrl: targetUrl.trim() || 'https://telegram.org',
          title: finalTitle,
          description: finalDescription || `Complete ${actionLabel} task`,
          instructions: customNoteToReviewers.trim(),
          exampleImages: [],
          checklist: [],
          inputFields: ['screenshot'],
          reward: rewardEach,
          rewardCurrency: rewardCurrency,
          workerLimit: howMany,
          dailyLimit: 0,
          cooldownHours: 0,
          expiryDays: Math.max(1, Number(expiresDays) || 1),
          audience: {
            type: minTier === 'anyone' ? 'everyone' : 'level',
            minLevel: minTier === 'bronze' ? 2 : minTier === 'silver' ? 5 : minTier === 'gold' ? 10 : 1,
          },
          verificationType: 'manual',
          verifiedOnly,
        };

        const result = await createMarketTask(payload);

        if (result.ok) {
          if (isUsdt && setUsdtBalance) {
            setUsdtBalance(prev => Math.max(0, Number((prev - totalEscrowRequired).toFixed(3))));
          } else if (!isUsdt && setEfcBalance) {
            setEfcBalance(prev => Math.max(0, Math.round(prev - totalEscrowRequired)));
          }
          showToast(`🎉 Task Created & ${totalEscrowRequired} ${currencySymbol} escrowed! Pending review.`, 'success');
          onCreated();
          onClose();
        } else {
          showToast(result.error || 'Failed to create task.', 'error');
        }
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : 'Error creating task', 'error');
      } finally {
        setSubmitting(false);
      }
    }, 0);
  };

  const inputStyle: React.CSSProperties = {
    background: '#121212',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
  };

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col h-full max-h-screen overflow-hidden bg-[#0D0E12] select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/10 shrink-0 bg-[#16171B]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Create Task Campaign</h2>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-[#FF8A00]/20 text-[#FF8A00] border border-[#FF8A00]/30">
            PRO
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Single-Screen Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-4 pb-32 space-y-4 scrollbar-thin">
        {/* Info Banner */}
        <div className="p-3.5 rounded-2xl bg-[#16171B] border border-white/10 text-xs text-slate-300 leading-relaxed font-medium">
          Fund a task from your balance and real users complete it, verified like any sponsored task. A <span className="text-[#FF8A00] font-bold">25% fee</span> applies per completed action, plus verification costs where shown.
        </div>

        {/* PLATFORM SELECTOR */}
        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">PLATFORM</span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap">
            {PLATFORMS.map(p => {
              const isSel = selectedPlatform === p.id;
              const color = getPlatformColor(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlatform(p.id);
                    setSelectedActions({ [PLATFORM_ACTIONS[p.id]?.[0]?.label || 'Do task']: true });
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-2 shrink-0 ${
                    isSel
                      ? 'bg-white text-black border-white shadow-md font-extrabold scale-105'
                      : 'bg-[#16171B] text-slate-300 border-white/10 hover:border-white/20'
                  }`}
                >
                  <PlatformIcon platformId={p.id} size={15} color={isSel ? '#000000' : color} />
                  <span>{p.id}</span>
                  {isSel && <Check size={12} strokeWidth={3} className="text-black ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ACTION SELECTOR */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">ACTION</span>
          </div>
          <p className="text-[10px] text-slate-500">Tick several to order them all on one post.</p>

          <div className="grid grid-cols-2 gap-2">
            {currentPlatformActions.map(act => {
              const checked = !!selectedActions[act.label];
              return (
                <button
                  key={act.label}
                  type="button"
                  onClick={() => toggleAction(act.label)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    checked
                      ? 'bg-[#FF8A00]/15 border-[#FF8A00] text-white font-bold shadow-md'
                      : 'bg-[#16171B] border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-4 h-4 rounded border flex items-center justify-center text-[9px] shrink-0 ${checked ? 'bg-[#FF8A00] border-[#FF8A00] text-black font-black' : 'border-white/30'}`}>
                      {checked ? '✓' : ''}
                    </span>
                    <ActionIcon action={act.label} size={14} color={checked ? '#FF8A00' : '#94a3b8'} />
                    <span className="text-xs font-bold text-white truncate">{act.label}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">from {act.baseReward}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TARGET LINK INPUT */}
        {selectedPlatform !== 'Custom' && (
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">TARGET LINK</span>
            <input
              type="url"
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              placeholder={`https://${selectedPlatform.toLowerCase()}.com/...`}
              className="w-full h-11 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF8A00] font-mono transition-all"
              style={inputStyle}
            />
          </div>
        )}

        {/* CUSTOM MISSION EXTRA FIELDS */}
        {selectedPlatform === 'Custom' && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">TARGET LINK (OPTIONAL)</span>
              <input
                type="url"
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://..."
                className="w-full h-11 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF8A00] font-mono"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">TASK TITLE</span>
              <input
                type="text"
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="e.g. Test WebApp & Send Feedback"
                className="w-full h-11 rounded-xl px-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF8A00]"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">WHAT SHOULD WORKERS DO?</span>
              <textarea
                rows={3}
                value={customDescription}
                onChange={e => setCustomDescription(e.target.value)}
                placeholder="Describe exact steps. e.g. Open link, read post, reply with feedback. Upload screenshot proof."
                className="w-full rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF8A00] resize-none"
                style={inputStyle}
              />
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">NOTE TO REVIEWERS (OPTIONAL)</span>
              <textarea
                rows={2}
                value={customNoteToReviewers}
                onChange={e => setCustomNoteToReviewers(e.target.value)}
                placeholder="e.g. A valid screenshot shows the dashboard with a green checkmark"
                className="w-full rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none focus:border-[#FF8A00] resize-none"
                style={inputStyle}
              />
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#16171B] border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={startPaused}
                onChange={e => setStartPaused(e.target.checked)}
                className="w-4 h-4 rounded accent-[#FF8A00]"
              />
              <span className="text-xs font-bold text-white">Start paused after approval</span>
            </label>
          </div>
        )}

        {/* REWARD CURRENCY BANNER (USDT BEP-20 ONLY) */}
        <div className="space-y-1.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">PAYMENT CURRENCY</span>
            <span className="text-[9px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">BEP-20 Supported</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">💵</span>
              <div>
                <span className="text-xs font-bold text-emerald-400 block">USDT (BEP-20)</span>
                <span className="text-[9px] text-slate-400">Creators fund using USDT. Workers earn EFC Points.</span>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">Mandatory</span>
          </div>
        </div>

        {/* REWARD, WORKER LIMIT & EXPIRES GRID */}
        <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-white/5">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">REWARD / EACH</span>
            <div className="relative">
              <input
                type="number"
                step={isUsdt ? "0.01" : "1"}
                min={isUsdt ? 0.01 : 1}
                value={rewardPerEach}
                onChange={e => setRewardPerEach(e.target.value)}
                className="w-full h-11 rounded-xl pl-3 pr-10 text-xs text-white font-mono outline-none focus:border-[#FF8A00]"
                style={inputStyle}
              />
              <span className="absolute right-2 top-3.5 text-[8px] font-bold text-slate-400">{currencySymbol}</span>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">HOW MANY</span>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full h-11 rounded-xl px-3 text-xs text-white font-mono outline-none focus:border-[#FF8A00]"
              style={inputStyle}
            />
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">EXPIRES (DAYS)</span>
            <input
              type="number"
              min={1}
              max={90}
              value={expiresDays}
              onChange={e => setExpiresDays(e.target.value)}
              className="w-full h-11 rounded-xl px-3 text-xs text-white font-mono outline-none focus:border-[#FF8A00]"
              style={inputStyle}
            />
          </div>
        </div>

        {/* MINIMUM USER TIER SELECTOR */}
        <div className="space-y-1.5 pt-2 border-t border-white/5">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">MINIMUM USER TIER</span>
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'anyone', label: 'Anyone', fee: '+0' },
              { id: 'bronze', label: 'Bronze+', fee: '+0' },
              { id: 'silver', label: 'Silver+', fee: isUsdt ? '+$0.01/ea' : '+1/ea' },
              { id: 'gold', label: 'Gold+', fee: isUsdt ? '+$0.02/ea' : '+2/ea' },
            ].map(tier => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setMinTier(tier.id as any)}
                className={`p-2 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  minTier === tier.id
                    ? 'bg-[#FF8A00]/20 border-[#FF8A00] text-white font-bold shadow-sm'
                    : 'bg-[#16171B] border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <span className="text-[10px]">{tier.label}</span>
                <span className="text-[8px] font-mono text-slate-500">{tier.fee}</span>
              </button>
            ))}
          </div>
        </div>

        {/* REQUIRE VERIFIED USERS CHECKBOX */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-[#16171B] border border-white/10 cursor-pointer">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={e => setVerifiedOnly(e.target.checked)}
              className="w-4 h-4 rounded accent-[#FF8A00]"
            />
            <div>
              <span className="text-xs font-bold text-white block">Require Verified Miners</span>
              <span className="text-[9px] text-slate-400">Only users with completed verification can work</span>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold text-[#FF8A00]">{isUsdt ? '+$0.015 USDT/ea' : '+1.5 EFC/ea'}</span>
        </label>

        {/* COST BREAKDOWN CARD */}
        <div className="p-4 rounded-xl bg-[#121212] border border-white/10 space-y-2 font-mono text-xs">
          <div className="flex justify-between text-slate-400">
            <span>{rewardEach} {currencySymbol} × {howMany} workers</span>
            <span className="text-white font-bold">{baseSubtotal} {currencySymbol}</span>
          </div>

          <div className="flex justify-between text-slate-400">
            <span>Service fee (25%)</span>
            <span>{serviceFee} {currencySymbol}</span>
          </div>

          {tierCost > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Tier requirement cost</span>
              <span>+{tierCost} {currencySymbol}</span>
            </div>
          )}

          {verificationCost > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Verification cost</span>
              <span>+{verificationCost} {currencySymbol}</span>
            </div>
          )}

          {reviewFee > 0 && (
            <div className="flex justify-between text-slate-400">
              <span>Review fee (one-time)</span>
              <span>+{reviewFee} {currencySymbol}</span>
            </div>
          )}

          <div className="w-full h-[1px] bg-white/10 my-1" />

          <div className="flex justify-between text-sm font-black">
            <span className="text-white">Total escrowed</span>
            <span className={isUsdt ? "text-emerald-400" : "text-[#FF8A00]"}>{totalEscrowRequired} {currencySymbol}</span>
          </div>

          <div className="flex justify-between text-[10px] pt-0.5">
            <span className="text-slate-400">Balance after task</span>
            <span className={isInsufficientBalance ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
              {balanceAfter} {currencySymbol}
            </span>
          </div>
        </div>

        {/* Moderation Note */}
        <div className="p-3 rounded-xl bg-[#16171B] border border-white/10 flex flex-col gap-1 text-[11px] text-slate-300">
          <span className="font-bold text-white flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#FF8A00]" /> Reviewed before going live
          </span>
          <p className="text-slate-400 leading-relaxed text-[10px]">
            Custom tasks are checked by a moderator first. Not allowed: wallets, seed phrases, private keys, signing transactions, fake reviews, harassment.
          </p>
        </div>
      </div>

      {/* Footer / Submit CTA */}
      <div className="p-4 pb-24 border-t border-white/10 bg-[#16171B] shrink-0 z-20 shadow-[0_-10px_25px_rgba(0,0,0,0.8)]">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className={`w-full h-12 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg ${
            isInsufficientBalance
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30'
              : 'bg-[#FF8A00] hover:bg-[#FF8A00]/90 text-white shadow-[#FF8A00]/25'
          }`}
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Escrowing & Creating...
            </>
          ) : isInsufficientBalance ? (
            <>
              <AlertTriangle size={16} /> Insufficient Balance ({balanceAfter} {currencySymbol})
            </>
          ) : (
            `Fund Escrow & Create Task (${totalEscrowRequired} ${currencySymbol})`
          )}
        </button>
      </div>
    </div>
  );
};
