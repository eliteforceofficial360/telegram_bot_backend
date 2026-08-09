import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet as WalletIcon, Clock, ShieldCheck, Lock, CheckCircle, ShieldAlert, X, Edit3, Save, RefreshCw, Copy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { type AdminSettings } from '../lib/adminSettingsService';
import { HeroBannerSlider } from '../components/HeroBannerSlider';
import { UsdtIcon } from '../components/UsdtIcon';
import { showRewardedAd } from '../lib/monetag';
import {
  submitWithdrawRequest, updateWalletAddress, subscribeToUser, updateUserDatabaseValues,
  getUserTodayWithdrawalAmount, getUserTodayWithdrawalTokens, type FirestoreUser,
  submitDepositRequest, subscribeToUserDepositRequests, type DepositRecord,
} from '../lib/userService';
import type { TelegramUser } from '../lib/telegramUser';

interface WalletProps {
  efcBalance: number;
  setEfcBalance: React.Dispatch<React.SetStateAction<number>>;
  eforceTokens: number;
  setEforceTokens: React.Dispatch<React.SetStateAction<number>>;
  usdtBalance: number;
  setUsdtBalance: React.Dispatch<React.SetStateAction<number>>;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  telegramUser: TelegramUser | null;
  adminSettings: AdminSettings;
}

export const Wallet: React.FC<WalletProps> = ({
  efcBalance,
  setEfcBalance,
  eforceTokens,
  setEforceTokens,
  usdtBalance,
  setUsdtBalance,
  showToast,
  telegramUser,
  adminSettings,
}) => {
  const [dbUser, setDbUser] = useState<FirestoreUser | null>(null);
  const settings = adminSettings;

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);

  const [walletInput, setWalletInput] = useState('');
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('0.20');
  const [withdrawAsset, setWithdrawAsset] = useState<'usdt' | 'token'>('usdt');

  // Local swap & deposit form state
  const [swapInputPoints, setSwapInputPoints] = useState('1000');
  const [depositAmountUsdt, setDepositAmountUsdt] = useState('5');
  const [depositTxHash, setDepositTxHash] = useState('');
  const [submittingDeposit, setSubmittingDeposit] = useState(false);
  const [userDeposits, setUserDeposits] = useState<DepositRecord[]>([]);

  // Subscribe to real-time user database state
  useEffect(() => {
    if (!telegramUser) return;
    const unsub = subscribeToUser(telegramUser.id, (user) => {
      if (user) {
        setDbUser(user);
        setWalletInput(user.walletAddress || '');
      }
    });
    return unsub;
  }, [telegramUser]);

  useEffect(() => {
    if (!telegramUser) return;
    const unsub = subscribeToUserDepositRequests(telegramUser.id, (list) => {
      setUserDeposits(list);
    });
    return unsub;
  }, [telegramUser]);

  // Address validation: BEP-20 (Ethereum format)
  const validateBep20 = (address: string): boolean => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const handleSaveAddress = async () => {
    if (!telegramUser) return;
    if (!validateBep20(walletInput)) {
      showToast('Invalid BEP-20 address. Must start with 0x followed by 40 hex characters.', 'error');
      return;
    }
    if (settings.adEnabled) {
      try {
        showToast('Loading sponsored video...', 'info');
        await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
      } catch (err: any) {
        showToast(err.message || 'Ad dismissed. Complete the ad to save address!', 'error');
        return;
      }
    }
    setSavingAddress(true);
    const success = await updateWalletAddress(telegramUser.id, walletInput);
    setSavingAddress(false);
    if (success) {
      setIsEditingAddress(false);
      showToast('BEP-20 wallet address saved successfully!', 'success');
    } else {
      showToast('Failed to save wallet address.', 'error');
    }
  };

  const handleWithdrawClick = async (asset: 'usdt' | 'token') => {
    if (!settings.withdrawOpen) {
      showToast('Withdrawals are currently closed by administrators.', 'error');
      return;
    }
    const minRefs = settings.withdrawMinReferrals;
    const currentRefs = dbUser?.referrals || 0;
    
    if (settings.withdrawRequireReferrals && currentRefs < minRefs) {
      setShowWarningModal(true);
      return;
    }

    if (!dbUser?.walletAddress) {
      showToast('Please save your BEP-20 wallet address first!', 'warning');
      return;
    }

    if (settings.adEnabled) {
      try {
        showToast('Loading sponsored video...', 'info');
        await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
      } catch (err: any) {
        showToast(err.message || 'Ad dismissed. Complete the ad to open withdrawals!', 'error');
        return;
      }
    }

    setWithdrawAsset(asset);
    setWithdrawAmount(asset === 'usdt' ? usdtBalance.toFixed(2) : eforceTokens.toFixed(3));
    setShowWithdrawModal(true);
    setIsVerifying(false);
    setIsSuccess(false);
  };

  const handleConfirmWithdraw = async () => {
    setIsVerifying(true);
    if (settings.adEnabled) {
      try {
        showToast('Loading sponsored video...', 'info');
        await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
      } catch (err: any) {
        setIsVerifying(false);
        showToast(err.message || 'Ad dismissed. Complete the ad to confirm withdrawal!', 'error');
        return;
      }
    }
    try {
        const amountNum = parseFloat(withdrawAmount);
        const minWithdrawUsdt = settings.withdrawMinAmount;

        if (withdrawAsset === 'usdt') {
          if (isNaN(amountNum) || amountNum < minWithdrawUsdt) {
            setIsVerifying(false);
            showToast(`Minimum withdrawal is $${minWithdrawUsdt} USDT.`, 'error');
            return;
          }
          if (usdtBalance < amountNum) {
            setIsVerifying(false);
            showToast('Insufficient USDT balance.', 'error');
            return;
          }
        } else {
          const minWithdrawTokens = settings.withdrawMinTokenAmount ?? (minWithdrawUsdt / (settings.eforceTokenValue || 0.05));
          if (isNaN(amountNum) || amountNum < minWithdrawTokens) {
            setIsVerifying(false);
            showToast(`Minimum withdrawal is ${minWithdrawTokens.toFixed(1)} EForce.`, 'error');
            return;
          }
          if (eforceTokens < amountNum) {
            setIsVerifying(false);
            showToast('Insufficient EForce Token balance.', 'error');
            return;
          }
        }

        if (!telegramUser || !dbUser) {
          setIsVerifying(false);
          showToast('User state not verified.', 'error');
          return;
        }

        // Daily limit validation
        if (withdrawAsset === 'usdt') {
          const todayWithdrawn = await getUserTodayWithdrawalAmount(telegramUser.id);
          if (todayWithdrawn + amountNum > settings.dailyWithdrawLimit) {
            setIsVerifying(false);
            showToast(`Exceeds daily USDT withdrawal limit of $${settings.dailyWithdrawLimit.toFixed(2)} USDT. Remaining: $${Math.max(0, settings.dailyWithdrawLimit - todayWithdrawn).toFixed(2)} USDT`, 'warning');
            return;
          }
        } else {
          const todayWithdrawnTokens = await getUserTodayWithdrawalTokens(telegramUser.id);
          const limit = settings.dailyTokenWithdrawLimit ?? 1000;
          if (todayWithdrawnTokens + amountNum > limit) {
            setIsVerifying(false);
            showToast(`Exceeds daily Token withdrawal limit of ${limit.toLocaleString()} EForce. Remaining: ${(Math.max(0, limit - todayWithdrawnTokens)).toFixed(3)} EForce`, 'warning');
            return;
          }
        }

        const res = await submitWithdrawRequest(
          telegramUser.id,
          telegramUser.username || `user_${telegramUser.id}`,
          dbUser.walletAddress,
          amountNum,
          withdrawAsset
        );

        setIsVerifying(false);

        if (res.success) {
          setIsSuccess(true);
          if (withdrawAsset === 'usdt') {
            const newWalletBalance = Math.max(0, usdtBalance - amountNum);
            setUsdtBalance(newWalletBalance);
            showToast(`Withdrawal request of $${amountNum} USDT submitted!`, 'success');
          } else {
            const newTokenBalance = Math.max(0, eforceTokens - amountNum);
            setEforceTokens(newTokenBalance);
            showToast(`Withdrawal request of ${amountNum.toFixed(3)} EForce Token submitted!`, 'success');
          }
          confetti({ particleCount: 20, spread: 45, origin: { y: 0.6 }, ticks: 80, disableForReducedMotion: true, colors: ['#00FF88', '#00E5FF', '#ffffff'] });
          setTimeout(() => { setShowWithdrawModal(false); }, 2200);
        } else {
          showToast(res.reason || 'Failed to submit withdrawal.', 'error');
        }
      } catch {
        setIsVerifying(false);
        showToast('Network error. Please try again.', 'error');
      }
  };

  // EForce Swap Handler
  const handleSwap = () => {
    const pointsNum = parseInt(swapInputPoints);
    const swapRate = settings.swapRate || 1000;
    if (isNaN(pointsNum) || pointsNum <= 0) {
      showToast('Please enter a valid amount of points.', 'error');
      return;
    }
    if (efcBalance < pointsNum) {
      showToast('Insufficient EFC Points balance.', 'error');
      return;
    }

    const tokensToReceive = pointsNum / swapRate;
    const newPoints = efcBalance - pointsNum;
    const newTokens = eforceTokens + tokensToReceive;

    setEfcBalance(newPoints);
    setEforceTokens(newTokens);

    if (telegramUser) {
      updateUserDatabaseValues(telegramUser.id, {
        points: newPoints,
        tokens: newTokens
      }).catch(() => {});
    }

    showToast(`Swapped ${pointsNum} EFC Points for ${tokensToReceive} EForce Token!`, 'success');
    setShowSwapModal(false);

    confetti({
      particleCount: 20,
      spread: 45,
      ticks: 80,
      disableForReducedMotion: true,
      colors: ['#00E5FF', '#B388FF']
    });
  };

  const swapRate = settings.swapRate || 1000;
  const withdrawMinReferrals = settings.withdrawMinReferrals;
  const currentRefs = dbUser?.referrals || 0;

  return (
    <div className="flex flex-col gap-5 pb-28">
      {/* View Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Wallet</h1>
          <p className="text-xs text-slate-400 mt-1">Manage points swap and check token balances.</p>
        </div>
      </div>

      {/* Dynamic Multi-Banner Slider (or fallback to Wallet Banner) */}
      <HeroBannerSlider
        adminSettings={settings}
        fallbackUrl={settings.walletBannerUrl || '/coin.jpg'}
        defaultTitle="Wallet & Payouts"
        heightClass="h-32 min-h-[128px]"
      />

      {/* Hero Wallet Card */}
      <div className="glass-panel p-6 rounded-[24px] border-white/6 relative overflow-hidden flex flex-col justify-between shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-accent-cyan/5 rounded-full filter blur-xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent-purple/5 rounded-full filter blur-xl"></div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/8 flex items-center justify-center text-slate-300">
              <WalletIcon size={16} />
            </div>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">BEP-20 Custody Wallet</span>
          </div>
          <span className="text-[9px] font-black text-accent-cyan tracking-widest uppercase bg-accent-cyan/10 px-2 py-1 rounded border border-accent-cyan/20">
            BSC Network Only
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4">
          <div>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-semibold mb-0.5">EFC Points</span>
            <span className="text-sm font-extrabold text-white font-display">{efcBalance.toLocaleString()}</span>
            <span className="text-[8px] text-slate-500 block mt-0.5 font-bold">
              {swapRate} Points = 1 EForce Token
            </span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-semibold mb-0.5">EForce Token</span>
            <span className="text-sm font-semibold text-accent-purple flex items-center gap-1 font-display mb-0.5">
              <Clock size={11} /> {eforceTokens.toLocaleString()}
            </span>
            <span className="text-[8px] text-slate-400 block font-bold">
              Utility Asset
            </span>
          </div>
        </div>
      </div>

      {/* Referral Commission Earnings */}
      {(() => {
        const affiliateCount = dbUser?.referralCount ?? dbUser?.referrals ?? 0;
        const ratePerAffiliate = adminSettings.referralRewardUsdt !== undefined ? adminSettings.referralRewardUsdt : 0.05;
        const earnedFromRefs = Number((affiliateCount * ratePerAffiliate).toFixed(2));

        return (
          <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-2"
            style={{ background: 'rgba(255,138,0,0.04)', border: '1px solid rgba(255,138,0,0.12)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                  style={{ background: 'rgba(255,138,0,0.12)', border: '1px solid rgba(255,138,0,0.2)' }}>
                  💰
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Referral Commission</span>
                  <span className="text-[9px] text-slate-400">${ratePerAffiliate.toFixed(2)} USDT per affiliate</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-black text-[#FF8A00]">
                  ${earnedFromRefs.toFixed(2)}
                </div>
                <div className="text-[9px] text-slate-400">{affiliateCount} affiliate{affiliateCount !== 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="w-full h-px bg-white/5 my-0.5" />
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Total USDT Balance:</span>
              <span className="text-accent-success font-bold flex items-center gap-1.5"><UsdtIcon size={13} />${usdtBalance.toFixed(2)} USDT</span>
            </div>
          </div>
        );
      })()}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex flex-col gap-3">
        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">BEP-20 Wallet Address</span>
        {dbUser?.walletAddress && !isEditingAddress ? (
          <div className="flex items-center justify-between bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
            <span className="text-xs text-slate-300 font-mono truncate mr-2">{dbUser.walletAddress}</span>
            <button
              onClick={() => setIsEditingAddress(true)}
              className="shrink-0 p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white cursor-pointer"
            >
              <Edit3 size={12} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Enter BEP-20 wallet address (0x...)"
              value={walletInput}
              onChange={(e) => setWalletInput(e.target.value)}
              className="bg-[#12182D] border border-white/8 text-slate-300 text-xs font-mono rounded-lg px-2.5 py-1.5 focus:border-accent-cyan outline-none w-full"
            />
            <div className="flex gap-2">
              {dbUser?.walletAddress && (
                <button
                  onClick={() => setIsEditingAddress(false)}
                  className="flex-1 h-8 rounded-lg border border-white/10 text-slate-400 text-[10px] font-bold"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSaveAddress}
                disabled={savingAddress}
                className="flex-1 h-8 rounded-lg bg-[#FF8A00] text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
              >
                {savingAddress ? 'Saving...' : <><Save size={10} /> Save Address</>}
              </button>
            </div>
          </div>
        )}
      </div>



      {/* BEP-20 Deposit Portal Banner */}
      <div className="glass-panel p-4 rounded-[22px] border-white/6 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, rgba(0,255,136,0.08), rgba(0,229,255,0.05))', border: '1px solid rgba(0,255,136,0.2)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
            style={{ background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)', color: '#00FF88' }}>
            📥
          </div>
          <div>
            <div className="text-xs font-black text-white flex items-center gap-1.5">
              Deposit BEP-20 (USDT)
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-[#00FF88]/20 text-[#00FF88] border border-[#00FF88]/30">BSC</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Fund your balance to create campaigns & mine ({settings.bep20DepositRate || 100} EFC per $1 USDT)
            </div>
          </div>
        </div>
        <button
          onClick={async () => {
            if (settings.adEnabled && settings.monetagZoneId) {
              try {
                showToast('Loading sponsored video...', 'info');
                const adSuccess = await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
                if (!adSuccess) {
                  showToast('Ad skipped. Complete the ad to open the deposit page!', 'warning');
                  return;
                }
              } catch (err: any) {
                showToast(err.message || 'Ad skipped. Complete the ad to access deposit!', 'error');
                return;
              }
            }
            setShowDepositModal(true);
          }}
          className="h-9 px-4 rounded-xl text-xs font-black text-black cursor-pointer transition-all shadow-lg hover:brightness-110 shrink-0"
          style={{ background: 'linear-gradient(135deg, #00FF88, #00E5FF)' }}
        >
          Deposit
        </button>
      </div>

      {/* Swap & Withdraw Portal */}
      <div className="glass-panel p-5 rounded-[24px] border-white/6 flex flex-col gap-4">
        
        {/* Swap Exchange Section */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Swap Portal</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400">Swap Status:</span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                settings.swapOpen 
                  ? 'bg-accent-success/15 border-accent-success/20 text-accent-success' 
                  : 'bg-accent-danger/15 border-accent-danger/20 text-accent-danger'
              }`}>
                {settings.swapOpen ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>

          {settings.swapOpen ? (
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                Convert your mined EFC Points to EForce Token instantly. Current Conversion rate is <span className="text-accent-cyan font-bold">{swapRate} Points = 1 EForce Token</span>.
              </p>
              <button
                onClick={async () => {
                  if (settings.adEnabled) {
                    try {
                      showToast('Loading sponsored video...', 'info');
                      await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
                    } catch (err: any) {
                      showToast(err.message || 'Ad dismissed. Complete the ad to configure swap!', 'error');
                      return;
                    }
                  }
                  setShowSwapModal(true);
                }}
                className="h-10 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                Configure Swap Exchange
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center flex flex-col gap-1.5">
              <Lock className="text-slate-500 mx-auto" size={16} />
              <span className="text-xs font-bold text-slate-400">Conversion Swapping Closed</span>
              <p className="text-[10px] text-slate-500">The swap gateway is currently locked by ecosystem administrators.</p>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-white/5 w-full" />

        {/* Dual Withdraw Portal Section */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Withdraw Portal</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-slate-400">Status:</span>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                settings.withdrawOpen 
                  ? 'bg-accent-success/15 border-accent-success/20 text-accent-success' 
                  : 'bg-accent-danger/15 border-accent-danger/20 text-accent-danger'
              }`}>
                {settings.withdrawOpen ? 'Open' : 'Closed'}
              </span>
            </div>
          </div>

          {settings.withdrawOpen ? (
            <div className="flex flex-col gap-3">
              {/* Balances Display */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 flex flex-col gap-0.5">
                  <div className="flex items-center gap-1">
                    <UsdtIcon size={12} />
                    <span className="text-[8px] text-slate-500 uppercase font-semibold">Withdrawable USDT</span>
                  </div>
                  <span className="text-xs font-extrabold text-accent-success font-mono">${usdtBalance.toFixed(2)} USDT</span>
                  <div className="flex flex-col text-[8px] text-slate-500 font-medium leading-tight mt-0.5">
                    <span>Min: ${settings.withdrawMinAmount}</span>
                    <span>Daily Limit: ${settings.dailyWithdrawLimit.toFixed(2)}</span>
                  </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2 flex flex-col gap-0.5">
                  <span className="text-[8px] text-slate-500 uppercase font-semibold">Withdrawable EForce</span>
                  <span className="text-xs font-extrabold text-accent-purple font-mono">{eforceTokens.toFixed(3)} EForce</span>
                  <div className="flex flex-col text-[8px] text-slate-500 font-medium leading-tight mt-0.5">
                    <span>Min: {(settings.withdrawMinTokenAmount ?? (settings.withdrawMinAmount / (settings.eforceTokenValue || 0.05))).toFixed(1)} EForce</span>
                    <span>Daily Limit: {(settings.dailyTokenWithdrawLimit ?? 1000).toLocaleString()} EForce</span>
                  </div>
                </div>
              </div>

              {/* Requirement Alert Banner */}
              <div className="flex justify-between items-center bg-white/[0.015] border border-white/5 rounded-xl px-3.5 py-2">
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Requirement</span>
                <span className={`text-[9px] font-bold ${settings.withdrawRequireReferrals && currentRefs < withdrawMinReferrals ? 'text-accent-danger' : 'text-accent-success'}`}>
                  {settings.withdrawRequireReferrals ? `Affiliates: ${currentRefs}/${withdrawMinReferrals}` : 'No Referral Requirements'}
                </span>
              </div>
              
              <p className="text-[10px] text-slate-400 leading-relaxed font-normal">
                Withdraw commissions to your BEP-20 address. {settings.withdrawRequireReferrals && <>Requires <span className="text-accent-purple font-bold">{withdrawMinReferrals} valid affiliates</span> to unlock.</>}
              </p>
              
              {/* Dual Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={() => handleWithdrawClick('usdt')}
                  className="h-10 rounded-xl bg-gradient-to-r from-[#FF8A00] to-[#E52E71] text-white text-[11px] font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UsdtIcon size={15} />
                  Withdraw USDT
                </button>
                <button
                  onClick={() => handleWithdrawClick('token')}
                  className="h-10 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-[11px] font-black shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  Withdraw EForce Token
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center flex flex-col gap-1.5">
              <Lock className="text-slate-500 mx-auto" size={16} />
              <span className="text-xs font-bold text-slate-400">Withdrawals Locked</span>
              <p className="text-[10px] text-slate-500">USDT and Token withdrawals are temporarily locked by ecosystem administrators.</p>
            </div>
          )}
        </div>

      </div>

      {/* EForce Swap Modal */}
      <AnimatePresence>
        {showSwapModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 rounded-[28px] border-white/8 w-full max-w-[340px] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white">EFC Points → EForce Token Swap</h3>
                <button onClick={() => setShowSwapModal(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={16} /></button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Points to Swap</span>
                  <input
                    type="number"
                    value={swapInputPoints}
                    onChange={(e) => setSwapInputPoints(e.target.value)}
                    className="w-full bg-[#12182D] border border-white/8 text-slate-300 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:border-accent-cyan outline-none"
                  />
                  <span className="text-[9px] text-slate-500">Available: {efcBalance.toLocaleString()} Points</span>
                </div>

                <div className="w-full h-[1px] bg-white/5" />

                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">You will receive</span>
                  <span className="text-sm font-black text-accent-cyan">
                    {(parseInt(swapInputPoints) / swapRate || 0).toLocaleString()} EForce Token
                  </span>
                </div>

                <button
                  onClick={handleSwap}
                  className="h-10 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Confirm Convert Swap
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Withdrawal Blocked Warning Modal */}
      <AnimatePresence>
        {showWarningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-panel p-6 rounded-[28px] border-white/8 w-full max-w-[340px] text-center shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
            >
              <div className="w-12 h-12 rounded-full bg-accent-danger/15 border border-accent-danger/25 text-accent-danger flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(255,77,109,0.15)]">
                <ShieldAlert size={22} />
              </div>

              <h3 className="text-base font-bold text-white mb-2">Milestone Required</h3>
              <p className="text-xs text-slate-400 leading-relaxed mb-5">
                To prevent Sybil attacks and unlock cryptocurrency withdrawals, you must recruit at least <span className="text-accent-purple font-bold">{withdrawMinReferrals} valid affiliates</span>. Current valid count: {currentRefs}.
              </p>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setShowWarningModal(false)}
                  className="h-10 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  Return
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PIN Withdrawal Modal */}
      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-50 flex items-end bg-[#040810]/90 backdrop-blur-xl">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full glass-panel border-t border-white/10 rounded-t-[28px] p-6 pb-28 shadow-[0_-15px_50px_rgba(0,0,0,0.5)] max-h-[85vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="text-accent-success" size={16} />
                  Authorize Withdrawal
                </h3>
                <button
                  onClick={() => setShowWithdrawModal(false)}
                  className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 bg-white/5 rounded-lg border border-white/6 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="mb-4">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Select Asset to Withdraw</span>
                <div className="grid grid-cols-2 gap-2 mb-3.5">
                  <button
                    onClick={() => {
                      setWithdrawAsset('usdt');
                      setWithdrawAmount(usdtBalance.toFixed(2));
                    }}
                    type="button"
                    className={`h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      withdrawAsset === 'usdt'
                        ? 'bg-accent-success/10 border-accent-success text-accent-success'
                        : 'bg-white/5 border-white/8 text-slate-400'
                    }`}
                  >
                    <UsdtIcon size={14} /> USDT (${usdtBalance.toFixed(2)})
                  </button>
                  <button
                    onClick={() => {
                      setWithdrawAsset('token');
                      setWithdrawAmount(eforceTokens.toFixed(3));
                    }}
                    type="button"
                    className={`h-9 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      withdrawAsset === 'token'
                        ? 'bg-accent-purple/10 border-accent-purple text-accent-purple'
                        : 'bg-white/5 border-white/8 text-slate-400'
                    }`}
                  >
                    EForce Token ({eforceTokens.toFixed(3)})
                  </button>
                </div>

                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1.5">Configure Amount</span>
                <div className="flex gap-2 items-center">
                  <div className="flex-1 flex items-center bg-white/5 border border-white/7 rounded-xl p-2.5">
                    <input
                      type="text"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-transparent border-none outline-none text-sm font-bold text-white w-full"
                    />
                    <span className={`text-xs font-bold shrink-0 ${withdrawAsset === 'usdt' ? 'text-accent-success' : 'text-accent-purple'}`}>
                      {withdrawAsset === 'usdt' ? 'USDT' : 'EForce'}
                    </span>
                  </div>
                  <div className="flex flex-col text-[10px] text-slate-500 leading-none gap-1 pr-1">
                    <span>Max: {withdrawAsset === 'usdt' ? `$${usdtBalance.toFixed(2)}` : `${eforceTokens.toFixed(3)} EForce`}</span>
                    <span className="text-accent-cyan cursor-pointer font-bold" onClick={() => setWithdrawAmount(withdrawAsset === 'usdt' ? usdtBalance.toFixed(2) : eforceTokens.toFixed(3))}>Set Max</span>
                  </div>
                </div>
                {/* Admin Limits Summary Box */}
                <div className="mt-2.5 p-2.5 bg-white/[0.02] border border-white/6 rounded-xl flex justify-between items-center text-[10px]">
                  <div className="flex flex-col gap-0.5 text-left">
                    <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Admin Withdraw Limits</span>
                    <span className="text-slate-300">
                      Min: <strong className="text-white">{withdrawAsset === 'usdt' ? `$${settings.withdrawMinAmount} USDT` : `${(settings.withdrawMinTokenAmount ?? (settings.withdrawMinAmount / (settings.eforceTokenValue || 0.05))).toFixed(1)} EForce`}</strong>
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-slate-400 font-semibold uppercase text-[8px] tracking-wider">Daily Max</span>
                    <span className="text-slate-300">
                      Limit: <strong className="text-white">{withdrawAsset === 'usdt' ? `$${settings.dailyWithdrawLimit.toFixed(2)} USDT` : `${(settings.dailyTokenWithdrawLimit ?? 1000).toLocaleString()} EForce`}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Confirm button area */}
              <div className="flex flex-col gap-3 mt-2">
                <AnimatePresence mode="wait">
                  {isSuccess ? (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-2 py-4">
                      <CheckCircle size={44} className="text-accent-success drop-shadow-[0_0_12px_rgba(0,255,136,0.6)]" />
                      <span className="text-sm font-bold text-accent-success">Request Submitted!</span>
                    </motion.div>
                  ) : (
                    <motion.button key="confirm" onClick={handleConfirmWithdraw} disabled={isVerifying}
                      whileTap={{ scale: 0.97 }}
                      className="w-full h-14 rounded-2xl text-sm font-black text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 transition-all"
                      style={{
                        background: 'linear-gradient(135deg, #FF8A00, #E52E71)',
                        boxShadow: '0 0 32px rgba(255,138,0,0.4), 0 8px 24px rgba(229,46,113,0.3)'
                      }}
                    >
                      {isVerifying
                        ? <><RefreshCw size={18} className="animate-spin" /> Processing…</>
                        : <><ShieldCheck size={18} /> Confirm Withdrawal</>}
                    </motion.button>
                  )}
                </AnimatePresence>

                <div className="rounded-xl px-4 py-3 flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Asset</span>
                    <span className="font-bold text-white">{withdrawAsset === 'usdt' ? 'USDT (BEP-20)' : 'EForce Token'}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-bold" style={{ color: withdrawAsset === 'usdt' ? '#4ADE80' : '#B388FF' }}>
                      {withdrawAmount} {withdrawAsset === 'usdt' ? 'USDT' : 'EForce'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Destination</span>
                    <span className="font-mono text-[9px] text-slate-400">{dbUser?.walletAddress?.slice(0, 8)}…{dbUser?.walletAddress?.slice(-6)}</span>
                  </div>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── BEP-20 DEPOSIT MODAL ── */}
      <AnimatePresence>
        {showDepositModal && (
          <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] p-5 sm:p-6 bg-[#0D1220] border border-white/12 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl scrollbar-thin pb-12 sm:pb-6"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/30 flex items-center justify-center text-[#00FF88]">
                    📥
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">Deposit BEP-20 (USDT)</h3>
                    <p className="text-[9px] text-slate-400">BNB Smart Chain (BEP-20 Network)</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDepositModal(false)}
                  className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Instructions */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold">Network:</span>
                  <span className="font-extrabold text-[#00FF88]">BNB Smart Chain (BEP-20)</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  {settings.bep20DepositInstructions || 'Send USDT (BEP-20 Network) to the address below, then submit your transaction hash (TxHash). Your USDT balance will be credited upon verification.'}
                </p>
              </div>

              {/* Deposit Address Area */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                  Admin BEP-20 Deposit Wallet Address
                </label>
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-black/50 border border-white/10">
                  <span className="text-xs font-mono text-cyan-400 truncate flex-1 select-all">
                    {settings.bep20DepositAddress || '0x0000000000000000000000000000000000000000'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (settings.bep20DepositAddress) {
                        navigator.clipboard.writeText(settings.bep20DepositAddress);
                        showToast('Deposit address copied to clipboard!', 'success');
                      } else {
                        showToast('No deposit address set by admin.', 'warning');
                      }
                    }}
                    className="h-8 px-3 rounded-xl bg-[#00FF88]/20 text-[#00FF88] border border-[#00FF88]/30 text-xs font-extrabold flex items-center gap-1 cursor-pointer hover:bg-[#00FF88]/30 transition-all shrink-0"
                  >
                    <Copy size={12} /> Copy
                  </button>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Amount Deposited ($ USDT)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={depositAmountUsdt}
                    onChange={(e) => setDepositAmountUsdt(e.target.value)}
                    placeholder="Enter amount (e.g. 10)"
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs text-white bg-white/5 border border-white/10 outline-none focus:border-[#00FF88]"
                  />
                </div>

                <div>
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    BEP-20 Transaction Hash (TxHash / 0x...)
                  </label>
                  <input
                    type="text"
                    value={depositTxHash}
                    onChange={(e) => setDepositTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-3.5 py-2.5 rounded-xl text-xs text-white font-mono bg-white/5 border border-white/10 outline-none focus:border-[#00FF88]"
                  />
                </div>

                {/* Calculation Preview */}
                <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between items-center text-slate-400">
                    <span>USDT Deposited:</span>
                    <span className="font-bold text-white">${Math.max(0, Number(depositAmountUsdt) || 0).toFixed(2)} USDT</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400">
                    <span>Wallet USDT Credit:</span>
                    <span className="font-bold text-emerald-400">+${Math.max(0, Number(depositAmountUsdt) || 0).toFixed(2)} USDT</span>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    if (!telegramUser) return;
                    const amountNum = parseFloat(depositAmountUsdt);
                    const minAmount = settings.bep20DepositMinAmount || 1.0;
                    if (isNaN(amountNum) || amountNum < minAmount) {
                      showToast(`Minimum deposit is $${minAmount} USDT.`, 'warning');
                      return;
                    }
                    if (!depositTxHash.trim().startsWith('0x') || depositTxHash.trim().length < 20) {
                      showToast('Please enter a valid BEP-20 Transaction Hash (starting with 0x).', 'error');
                      return;
                    }

                    // Step 1: Rewarded Ad
                    if (settings.adEnabled && settings.monetagZoneId) {
                      try {
                        showToast('Loading sponsored video...', 'info');
                        const adSuccess = await showRewardedAd(settings.monetagZoneId, settings.monetagDirectLink);
                        if (!adSuccess) {
                          showToast('Ad skipped. You must watch the complete ad to submit deposit verification.', 'warning');
                          return;
                        }
                      } catch (err: any) {
                        showToast(err.message || 'Ad failed/skipped.', 'error');
                        return;
                      }
                    }

                    // Step 2: Submit Deposit Request
                    setSubmittingDeposit(true);
                    const rate = settings.bep20DepositRate || 100;
                    const efcGranted = Math.round(amountNum * rate);

                    const res = await submitDepositRequest(
                      telegramUser.id,
                      telegramUser.username || `user_${telegramUser.id}`,
                      amountNum,
                      depositTxHash.trim(),
                      efcGranted
                    );
                    setSubmittingDeposit(false);

                    if (res.success) {
                      showToast('🎉 Deposit request submitted! Admin will verify your TxHash.', 'success');
                      setDepositTxHash('');
                      confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 } });
                    } else {
                      showToast(res.reason || 'Failed to submit deposit request.', 'error');
                    }
                  }}
                  disabled={submittingDeposit}
                  className="w-full py-3 rounded-2xl text-xs font-black text-black cursor-pointer transition-all shadow-lg flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #00FF88, #00E5FF)' }}
                >
                  {submittingDeposit ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  Submit Deposit Verification Request
                </button>
              </div>

              {/* Deposit History */}
              <div className="pt-2 border-t border-white/8 space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">
                  Your Deposit History ({userDeposits.length})
                </span>
                {userDeposits.length === 0 ? (
                  <div className="text-[10px] text-slate-500 font-mono text-center py-2">No deposits submitted yet.</div>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                    {userDeposits.map(d => (
                      <div key={d.id} className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-[10px] font-mono">
                        <div>
                          <div className="font-bold text-white">+${d.amountUsdt} USDT ({d.efcGranted} EFC)</div>
                          <div className="text-[8px] text-slate-500 truncate max-w-[160px]">{d.txHash}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                          d.status === 'Approved' ? 'bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30' :
                          d.status === 'Rejected' ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' :
                          'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          {d.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
