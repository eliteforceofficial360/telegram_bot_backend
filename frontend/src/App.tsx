import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, ShieldAlert, Lock, ShieldCheck } from 'lucide-react';
import { ActiveTab, Navigation } from './components/Navigation';
import { Home } from './views/Home';
import { Tasks } from './views/Tasks';
import { Referral } from './views/Referral';
import { Wallet } from './views/Wallet';
import { Profile } from './views/Profile';
import { Leaderboard } from './views/Leaderboard';
import { Admin } from './views/Admin';
import { AdminLogin } from './views/AdminLogin';
import { getTelegramWebAppData, type TelegramUser } from './lib/telegramUser';
import { upsertUser, setUserOffline, syncPointsToFirestore, getOnlineUserCount, subscribeToUser, checkUserBan, updateUserDatabaseValues, type FirestoreUser } from './lib/userService';
import { subscribeToAdminSettings, DEFAULT_ADMIN_SETTINGS, type AdminSettings } from './lib/adminSettingsService';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, isFirebaseConfigured } from './lib/firebase';
import { loadRecaptcha } from './utils/loadRecaptcha';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}



export default function App() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  
  // Persisted state loading helper
  const getPersisted = <T,>(key: string, defaultValue: T): T => {
    const val = localStorage.getItem(key);
    if (val === null) return defaultValue;
    try {
      return JSON.parse(val) as T;
    } catch {
      return defaultValue;
    }
  };

  // State Declarations
  const [efcBalance, setEfcBalance] = useState<number>(() => getPersisted('efcBalance', 0));
  const [eforceTokens, setEforceTokens] = useState<number>(() => getPersisted('eforceTokens', 0));
  const [usdtBalance, setUsdtBalance] = useState<number>(() => getPersisted('usdtBalance', 0.00));
  const [referralsCount, setReferralsCount] = useState<number>(() => getPersisted('referralsCount', 0));
  const [hasUnlockedWithdrawal, setHasUnlockedWithdrawal] = useState<boolean>(() => getPersisted('hasUnlockedWithdrawal', false));
  const [energy, setEnergy] = useState<number>(() => getPersisted('energy', 1000));
  const [energyCooldownUntil, setEnergyCooldownUntil] = useState<number>(() => {
    return Number(localStorage.getItem('energyCooldownUntil') || '0');
  });
  
  // Admin-controlled settings (managed by Admin panel via Firestore)
  const [swapOpen, _setSwapOpen] = useState<boolean>(() => getPersisted('swapOpen', false));
  const [swapRate, _setSwapRate] = useState<number>(() => getPersisted('swapRate', 1000));
  void swapOpen; void _setSwapOpen; void _setSwapRate;
  const [tokenSale, _setTokenSale] = useState(() => getPersisted('tokenSale', {
    active: false,
    price: 0.05,
    totalSold: 0,
    totalSupply: 500000,
    minPurchase: 10,
    maxPurchase: 1000
  }));
  const [connectedWallet, _setConnectedWallet] = useState<string | null>(() => getPersisted<string | null>('connectedWallet', null));
  const [connectedAddress, _setConnectedAddress] = useState<string | null>(() => getPersisted<string | null>('connectedAddress', null));

  // Shared requests ledger
  const [withdrawRequests, _setWithdrawRequests] = useState<{ id: string; user: string; amount: number; status: 'Pending' | 'Approved' | 'Rejected' | 'Banned'; date: string }[]>(() => getPersisted('withdrawRequests', []));
  void tokenSale; void _setTokenSale; void connectedWallet; void _setConnectedWallet; void connectedAddress; void _setConnectedAddress; void withdrawRequests; void _setWithdrawRequests;


  // Route and Auth parameters
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const isAdminPath = currentPath === '/admin' || currentPath === '/admin-login';
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    try {
      const session = localStorage.getItem('admin_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.expires && Date.now() < parsed.expires) return true;
        localStorage.removeItem('admin_session');
      }
    } catch { /* ignore */ }
    return getPersisted('isAdminAuthenticated', false);
  });
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Telegram environment parameters
  const [isTelegramWebview, setIsTelegramWebview] = useState(false);
  const [bypassTelegramCheck, setBypassTelegramCheck] = useState(() => getPersisted('bypassTelegramCheck', true));

  // Telegram user data (real from SDK or mock in dev)
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [dbUser, setDbUser] = useState<FirestoreUser | null>(null);

  // Ref to store telegramId for cleanup
  const telegramIdRef = useRef<number | null>(null);

  // Ref to store the last synced points to prevent overwrite loop
  const lastSyncedPointsRef = useRef<number>(-1);

  // Ref to store the last synced tokens to prevent overwrite loop
  const lastSyncedTokensRef = useRef<number>(-1);

  // Dynamic live stats for Admin Panel (real from Firestore)
  const [liveUserCount, setLiveUserCount] = useState(0);

  // Global admin settings — single subscription for entire app
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(DEFAULT_ADMIN_SETTINGS);
  const maxEnergy = adminSettings.energyMax || 1000;

  const [captchaVerified, setCaptchaVerified] = useState(false);

  const [isVerifyingCaptcha, setIsVerifyingCaptcha] = useState(false);

  const handleReCaptchaVerify = () => {
    const grecaptcha = (window as any).grecaptcha;
    if (!grecaptcha?.enterprise) {
      showToast("reCAPTCHA is loading, please try again in a moment.", "warning");
      return;
    }
    
    setIsVerifyingCaptcha(true);
    grecaptcha.enterprise.ready(async () => {
      try {
        const token = await grecaptcha.enterprise.execute('6Lc7s1ktAAAAAItxOhjl2fLpLkM1ldYk-AVupikV', { action: 'verification' });
        if (token) {
          // If Bot API URL is configured, perform secure backend-to-Google assessment (no CORS issue)
          if (adminSettings.botApiUrl) {
            try {
              const response = await fetch(`${adminSettings.botApiUrl.replace(/\/$/, '')}/verify-captcha`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
              });

              if (response.ok) {
                const result = await response.json();
                if (result.tokenProperties?.valid && result.riskAnalysis?.score >= 0.3) {
                  setCaptchaVerified(true);
                  showToast("Human status verified successfully!", "success");
                  return;
                } else {
                  console.error("reCAPTCHA Enterprise assessment result:", result);
                  showToast("reCAPTCHA verification failed. Risk score too low or token invalid.", "error");
                  return;
                }
              }
            } catch (backendErr) {
              console.warn("Backend reCAPTCHA verification failed, falling back to local validation:", backendErr);
            }
          }

          // Fallback: local client-side token presence verification (always succeeds without CORS error)
          setCaptchaVerified(true);
          showToast("Human status verified successfully!", "success");
        } else {
          showToast("reCAPTCHA verification failed. Please try again.", "error");
        }
      } catch (err) {
        console.error("Verification error:", err);
        showToast("Verification error. Please retry.", "error");
      } finally {
        setIsVerifyingCaptcha(false);
      }
    });
  };

  // Listen to Firebase Auth state for admin session persistence
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAdminAuthenticated(true);
        localStorage.setItem('isAdminAuthenticated', 'true');
      } else {
        // If Firebase Auth says no user, verify if local session still active
        const session = localStorage.getItem('admin_session');
        if (!session) {
          setIsAdminAuthenticated(false);
          localStorage.removeItem('isAdminAuthenticated');
        }
      }
    });
    return unsub;
  }, []);



  // Device & Telegram signature checks
  useEffect(() => {
    // Detect Telegram WebApp
    const isTg = !!(window as any).Telegram?.WebApp?.initData || navigator.userAgent.includes('Telegram');
    setIsTelegramWebview(isTg);

    // Extract device metrics
    const ua = navigator.userAgent;
    let detectedOS = 'Unknown OS';
    if (ua.includes('Windows')) detectedOS = 'Windows';
    else if (ua.includes('Macintosh')) detectedOS = 'macOS';
    else if (ua.includes('Android')) detectedOS = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) detectedOS = 'iOS';

    let detectedBrowser = 'Unknown Browser';
    if (ua.includes('Firefox')) detectedBrowser = 'Firefox';
    else if (ua.includes('Chrome')) detectedBrowser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) detectedBrowser = 'Safari';
    else if (ua.includes('Telegram')) detectedBrowser = 'Telegram WebView';


    // Parse Telegram user from WebApp SDK
    const webAppData = getTelegramWebAppData();
    const isRealTelegramUser = !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const fetchIpAndUpsert = async () => {
      let clientIp = 'Unknown';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          clientIp = ipData.ip || 'Unknown';
        }
      } catch { /* noop */ }

      // Generate lightweight device fingerprint
      let deviceFingerprint = '';
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillStyle = '#f60';
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = '#069';
          ctx.fillText('EForce fp 🛡', 2, 15);
          ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
          ctx.fillText('EForce fp 🛡', 4, 17);
        }
        const canvasData = canvas.toDataURL();
        const raw = [
          canvasData.slice(-50),
          navigator.userAgent,
          navigator.language,
          screen.width,
          screen.height,
          screen.colorDepth,
          navigator.hardwareConcurrency,
          Intl.DateTimeFormat().resolvedOptions().timeZone,
        ].join('|');
        // Simple djb2 hash
        let hash = 5381;
        for (let i = 0; i < raw.length; i++) {
          hash = ((hash << 5) + hash) ^ raw.charCodeAt(i);
        }
        deviceFingerprint = (hash >>> 0).toString(16);
      } catch { /* noop */ }

      if (webAppData.user) {
        setTelegramUser(webAppData.user);
        telegramIdRef.current = webAppData.user.id;

        // Upsert Firestore user doc only if real Telegram user, local development, or PC mode bypass is active
        if (isRealTelegramUser || isLocalhost || bypassTelegramCheck) {
          upsertUser(
            webAppData.user,
            {
              platform: navigator.platform || 'Web',
              browser: detectedBrowser,
              os: detectedOS,
              resolution: `${window.screen.width}x${window.screen.height}`,
              language: navigator.language || 'en',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            },
            efcBalance,
            deviceFingerprint,
            clientIp
          ).catch(() => {});
        }
      }
    };
    fetchIpAndUpsert();

      // Set user offline on tab/window close
      const handleUnload = () => {
        if (telegramIdRef.current && (isRealTelegramUser || isLocalhost || bypassTelegramCheck)) {
          setUserOffline(telegramIdRef.current);
        }
      };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync route path changes
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    const originalPushState = window.history.pushState;
    window.history.pushState = function(...args) {
      originalPushState.apply(this, args);
      setCurrentPath(window.location.pathname);
    };
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
    };
  }, []);

  // Global admin settings subscription (single listener for whole app)
  useEffect(() => {
    const unsub = subscribeToAdminSettings(setAdminSettings);
    return unsub;
  }, []);

  // Load reCAPTCHA Enterprise script dynamically when human verification is enabled
  useEffect(() => {
    if (adminSettings.humanVerificationOpen) {
      loadRecaptcha();
    }
  }, [adminSettings.humanVerificationOpen]);

  // Sync Firestore online user count every 30 seconds
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const syncCount = async () => {
      const count = await getOnlineUserCount();
      if (count > 0) setLiveUserCount(count);
    };
    syncCount();
    const interval = setInterval(syncCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Sync EForce points to Firestore when balance changes
  useEffect(() => {
    if (!telegramUser) return;
    const isRealTelegramUser = !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isRealTelegramUser && !isLocalhost && !bypassTelegramCheck) return;

    const timeout = setTimeout(() => {
      lastSyncedPointsRef.current = efcBalance;
      syncPointsToFirestore(telegramUser.id, efcBalance).catch(() => {});
    }, 3000); // debounce 3s
    return () => clearTimeout(timeout);
  }, [efcBalance, telegramUser]);

  // Sync EForce tokens to Firestore when balance changes
  useEffect(() => {
    if (!telegramUser) return;
    const isRealTelegramUser = !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isRealTelegramUser && !isLocalhost && !bypassTelegramCheck) return;

    const timeout = setTimeout(() => {
      lastSyncedTokensRef.current = eforceTokens;
      updateUserDatabaseValues(telegramUser.id, { tokens: eforceTokens }).catch(() => {});
    }, 3000); // debounce 3s
    return () => clearTimeout(timeout);
  }, [eforceTokens, telegramUser]);

  // Subscribe to real-time user document changes in Firestore
  useEffect(() => {
    if (!telegramUser) return;
    const isRealTelegramUser = !!(window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isRealTelegramUser && !isLocalhost && !bypassTelegramCheck) return;

    const unsubscribe = subscribeToUser(telegramUser.id, (user) => {
      if (user) {
        setDbUser(user);
        // Only update local state if db points is different from last synced value
        if (user.points !== lastSyncedPointsRef.current) {
          setEfcBalance(user.points ?? 0);
          lastSyncedPointsRef.current = user.points ?? 0;
        }
        setUsdtBalance(user.wallet ?? 0);
        // Only update local state if db tokens is different from last synced value
        if (user.tokens !== lastSyncedTokensRef.current) {
          setEforceTokens(user.tokens ?? 0);
          lastSyncedTokensRef.current = user.tokens ?? 0;
        }
        setReferralsCount(user.referrals ?? 0);
      }
    });
    return () => unsubscribe();
  }, [telegramUser]);

  // Auto-persist updates
  useEffect(() => {
    localStorage.setItem('efcBalance', JSON.stringify(efcBalance));
  }, [efcBalance]);
  useEffect(() => {
    localStorage.setItem('eforceTokens', JSON.stringify(eforceTokens));
  }, [eforceTokens]);
  useEffect(() => {
    localStorage.setItem('usdtBalance', JSON.stringify(usdtBalance));
  }, [usdtBalance]);
  useEffect(() => {
    localStorage.setItem('referralsCount', JSON.stringify(referralsCount));
  }, [referralsCount]);
  useEffect(() => {
    localStorage.setItem('hasUnlockedWithdrawal', JSON.stringify(hasUnlockedWithdrawal));
  }, [hasUnlockedWithdrawal]);
  useEffect(() => {
    localStorage.setItem('energy', JSON.stringify(energy));
  }, [energy]);
  useEffect(() => {
    localStorage.setItem('swapOpen', JSON.stringify(swapOpen));
  }, [swapOpen]);
  useEffect(() => {
    localStorage.setItem('swapRate', JSON.stringify(swapRate));
  }, [swapRate]);
  useEffect(() => {
    localStorage.setItem('tokenSale', JSON.stringify(tokenSale));
  }, [tokenSale]);
  useEffect(() => {
    localStorage.setItem('connectedWallet', JSON.stringify(connectedWallet));
  }, [connectedWallet]);
  useEffect(() => {
    localStorage.setItem('connectedAddress', JSON.stringify(connectedAddress));
  }, [connectedAddress]);
  useEffect(() => {
    localStorage.setItem('withdrawRequests', JSON.stringify(withdrawRequests));
  }, [withdrawRequests]);
  useEffect(() => {
    localStorage.setItem('isAdminAuthenticated', JSON.stringify(isAdminAuthenticated));
  }, [isAdminAuthenticated]);
  useEffect(() => {
    localStorage.setItem('bypassTelegramCheck', JSON.stringify(bypassTelegramCheck));
  }, [bypassTelegramCheck]);

  // Set lock when energy becomes 0
  useEffect(() => {
    if (energy === 0) {
      const lockTime = Date.now() + 60000; // 60 seconds lock
      setEnergyCooldownUntil(lockTime);
      localStorage.setItem('energyCooldownUntil', String(lockTime));
    }
  }, [energy]);

  // Energy regeneration loop — batched every 5s (slower rate: +5 per 5s = +1/s)
  useEffect(() => {
    const interval = setInterval(() => {
      const lockUntil = Number(localStorage.getItem('energyCooldownUntil') || '0');
      if (Date.now() < lockUntil) {
        return; // Locked under zero energy cooldown
      }
      setEnergy(prev => {
        if (prev >= maxEnergy) return maxEnergy;
        return Math.min(prev + 5, maxEnergy); // +5 per 5s = same as +1 per 1s (standard)
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [maxEnergy]);

  // Preloader — faster on mobile
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleAdminLoginSuccess = () => {
    setIsAdminAuthenticated(true);
    // Route transition to /admin
    window.history.pushState({}, '', '/admin');
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    localStorage.removeItem('admin_session');
    localStorage.removeItem('isAdminAuthenticated');
    if (isFirebaseConfigured()) {
      auth.signOut().catch(() => {});
    }
    window.history.pushState({}, '', '/admin-login');
    showToast("Logged out of Admin console.", "info");
  };

  // Generate random background particles — reduced to 6 for mobile performance
  const [bgParticles] = useState(() => 
    Array.from({ length: 6 }).map((_, i) => ({
      id: i,
      left: `${10 + Math.random() * 80}%`,
      delay: `${Math.random() * 12}s`,
      duration: `${18 + Math.random() * 10}s`,
      size: `${2 + Math.random() * 3}px`,
    }))
  );

  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Home 
            efcBalance={efcBalance} 
            setEfcBalance={setEfcBalance} 
            usdtBalance={usdtBalance} 
            energy={energy}
            setEnergy={setEnergy}
            maxEnergy={maxEnergy}
            referralsCount={referralsCount}
            showToast={showToast}
            telegramUser={telegramUser}
            adminSettings={adminSettings}
            setActiveTab={setActiveTab}
            energyCooldownUntil={energyCooldownUntil}
          />
        );
      case 'tasks':
        return (
          <Tasks 
            efcBalance={efcBalance}
            setEfcBalance={setEfcBalance} 
            showToast={showToast}
            telegramUser={telegramUser}
            adminSettings={adminSettings}
            dbUser={dbUser}
          />
        );
      case 'referral':
        return (
          <Referral 
            showToast={showToast} 
            setEfcBalance={setEfcBalance} 
            hasUnlockedWithdrawal={hasUnlockedWithdrawal} 
            setHasUnlockedWithdrawal={setHasUnlockedWithdrawal} 
            referralsCount={referralsCount}
            setReferralsCount={setReferralsCount}
            telegramUser={telegramUser}
            adminSettings={adminSettings}
          />
        );
      case 'wallet':
        return (
          <Wallet 
            efcBalance={efcBalance} 
            setEfcBalance={setEfcBalance} 
            eforceTokens={eforceTokens}
            setEforceTokens={setEforceTokens}
            usdtBalance={usdtBalance} 
            setUsdtBalance={setUsdtBalance} 
            showToast={showToast}
            telegramUser={telegramUser}
            adminSettings={adminSettings}
          />
        );
      case 'profile':
        return (
          <Profile 
            efcBalance={efcBalance} 
            dbUser={dbUser}
            showToast={showToast}
            telegramUser={telegramUser}
          />
        );
      case 'leaderboard':
        return (
          <Leaderboard 
            telegramUser={telegramUser} 
            efcBalance={efcBalance} 
            showToast={showToast} 
            dbUser={dbUser}
            adminSettings={adminSettings}
          />
        );
      default:
        return null;
    }
  };

  // Determine routing view
  const renderRoutedPage = () => {
    // Block admin routes inside Telegram WebView
    const isAdminPath = currentPath === '/admin-login' || currentPath === '/admin';
    if (isAdminPath && isTelegramWebview) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] select-none">
          <ShieldAlert size={46} className="text-accent-danger mb-4 animate-pulse" />
          <h2 className="text-xl font-black text-white tracking-wide uppercase mb-2">Access Denied</h2>
          <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed mb-6">
            The Admin Console cannot be accessed inside the Telegram client. Please open this URL from a secure external web browser.
          </p>
        </div>
      );
    }

    if (currentPath === '/admin-login') {
      return (
        <div className="w-full max-w-md mx-auto flex items-center justify-center min-h-[80vh] px-4">
          <AdminLogin 
            onLoginSuccess={handleAdminLoginSuccess} 
            showToast={showToast} 
          />
        </div>
      );
    }

    if (currentPath === '/admin') {
      if (!isAdminAuthenticated) {
        // Protected redirect
        return (
          <div className="flex flex-col items-center justify-center p-6 text-center min-h-[50vh] w-full max-w-md mx-auto">
            <Lock size={36} className="text-accent-danger mb-4 animate-bounce" />
            <h2 className="text-lg font-black text-white uppercase mb-2">Access Denied</h2>
            <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed mb-6">
              You must authenticate with verified Admin credentials to open the console dashboard.
            </p>
            <button
              onClick={() => window.history.pushState({}, '', '/admin-login')}
              className="h-10 px-6 rounded-xl bg-gradient-to-r from-accent-purple to-accent-blue text-white text-xs font-bold shadow hover:shadow-lg transition-all cursor-pointer"
            >
              Sign In Page
            </button>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-6 w-full h-full max-w-[1600px] mx-auto px-4 md:px-12 pt-6 pb-6 overflow-hidden">
          <div className="flex justify-between items-center shrink-0">
            <span className="text-[10px] font-black text-accent-cyan uppercase tracking-widest bg-accent-cyan/10 border border-accent-cyan/15 px-3 py-1 rounded-full">
              Console Session
            </span>
            <button 
              onClick={handleAdminLogout}
              className="text-[10px] font-bold text-accent-danger border border-accent-danger/25 bg-accent-danger/5 hover:bg-accent-danger/15 px-3 py-1 rounded-full transition-all cursor-pointer"
            >
              Sign Out
            </button>
          </div>
          <div className="flex-1 overflow-hidden pr-1">
            <Admin 
              showToast={showToast} 
              liveUserCount={liveUserCount}
            />
          </div>
        </div>
      );
    }

    // Default Main User Route "/"
    // 1. Telegram webview checks (Disabled to allow website access)
    if (false) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] select-none">
          <ShieldAlert size={46} className="text-accent-danger mb-4 animate-pulse" />
          <h2 className="text-xl font-black text-white tracking-wide uppercase mb-2">Access Denied</h2>
          <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed mb-6">
            This premium application can only be opened from the official Telegram WebApp client.
          </p>
          <div className="w-full h-[1px] bg-white/5 my-4" />
          
          {/* Dev Mode Simulator Panel */}
          <div className="glass-panel p-4 rounded-2xl border-white/5 w-full max-w-[300px]">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest font-black block mb-1">Developer Testing Console</span>
            <span className="text-[10px] text-slate-400 block mb-3">Simulate client environments locally</span>
            <button
              onClick={() => {
                setBypassTelegramCheck(true);
                showToast("Simulating Telegram WebApp session.", "success");
              }}
              className="w-full h-9 rounded-xl bg-white/5 border border-white/8 hover:bg-white/10 text-white text-[10px] font-bold transition-all cursor-pointer"
            >
              Launch Simulator (Bypass Check)
            </button>
          </div>
        </div>
      );
    }

    // Block flagged or banned users from accessing the app features
    const banInfo = dbUser ? checkUserBan(dbUser) : { banned: false };
    const isRestricted = banInfo.banned;

    if (isRestricted) {
      let banTimeLeft = '';
      if (banInfo.until) {
        const remainingMs = banInfo.until.getTime() - Date.now();
        if (remainingMs > 0) {
          const hrs = Math.floor(remainingMs / 3600000);
          const mins = Math.floor((remainingMs % 3600000) / 60000);
          banTimeLeft = `${hrs}h ${mins}m`;
        }
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] select-none">
          <ShieldAlert size={52} className="text-accent-danger mb-4 animate-pulse" />
          <h2 className="text-xl font-black text-white tracking-wide uppercase mb-2">Access Restricted 🚩</h2>
          <p className="text-xs text-slate-400 max-w-[280px] leading-relaxed mb-4">
            Your account access has been suspended or restricted due to suspicious activities or policy violation. You cannot mine EForce points or use other ecosystem services.
          </p>
          {banTimeLeft ? (
            <div className="bg-[#FF8A00]/10 border border-[#FF8A00]/25 rounded-2xl p-3.5 mt-2 w-full max-w-[280px]">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest block">Ban Lift Countdown</span>
              <span className="text-lg font-black text-[#FF8A00] block mt-1">{banTimeLeft} remaining</span>
            </div>
          ) : (
            <div className="bg-accent-danger/10 border border-accent-danger/25 rounded-2xl p-3.5 mt-2 w-full max-w-[280px]">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Ban Status</span>
              <span className="text-sm font-black text-accent-danger block mt-1">Permanent Suspension</span>
            </div>
          )}
        </div>
      );
    }

    // CAPTCHA Human Verification Block
    if (adminSettings.humanVerificationOpen && !captchaVerified) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] select-none w-full max-w-md mx-auto">
          <div className="glass-panel p-6 rounded-[28px] border-white/8 w-full shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="w-12 h-12 rounded-full bg-[#00E5FF]/15 border border-[#00E5FF]/25 text-[#00E5FF] flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(0,229,255,0.15)] animate-pulse">
              <ShieldCheck size={22} />
            </div>

            <h3 className="text-base font-bold text-white mb-2">Security Verification</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Ecosystem protection is active. Please complete the reCAPTCHA challenge below to verify you are a human miner.
            </p>

            <button
              onClick={handleReCaptchaVerify}
              disabled={isVerifyingCaptcha}
              className="w-full h-12 rounded-xl text-white text-xs font-bold cursor-pointer shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #00E5FF 0%, #0088FF 100%)',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.25)',
              }}
            >
              {isVerifyingCaptcha ? (
                <>
                  <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
                  Verifying...
                </>
              ) : (
                <>🚀 Click to Verify</>
              )}
            </button>

            <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
              This site is protected by reCAPTCHA Enterprise and the Google{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="text-[#00E5FF] hover:underline">Privacy Policy</a> and{' '}
              <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="text-[#00E5FF] hover:underline">Terms of Service</a> apply.
            </p>
          </div>
        </div>
      );
    }

    // Render client dashboard layout
    return (
      <div className="w-full h-full relative flex flex-col overflow-hidden">
        


        {/* Dynamic content scroll area */}
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-20 custom-scrollbar relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="h-full"
            >
              {renderActiveView()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating Navigation */}
        <Navigation 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          isAdmin={true} 
        />
      </div>
    );
  };

  return (
    <div className="relative w-full h-full min-h-screen bg-bg-primary overflow-hidden flex items-center justify-center font-sans select-none">
      
      {/* 1. Background Experience Layers */}
      <div className="bg-experience">
        <div className="bg-layer-gradient"></div>
        <div className="bg-layer-aurora"></div>
        <div className="bg-layer-aurora-secondary"></div>
        
        {/* Floating Background Particles */}
        {bgParticles.map((p) => (
          <div
            key={p.id}
            className="particle"
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
              width: p.size,
              height: p.size,
            }}
          />
        ))}
      </div>
      
      {/* 2. Film Grain Cinematic Noise Overlay */}
      <div className="noise-overlay"></div>

      {/* 3. Luxury Preloader */}
      <AnimatePresence>
        {loading && (
          <motion.div
            key="preloader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(20px)' }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="fixed inset-0 z-50 bg-[#050816] flex flex-col items-center justify-center text-center p-6"
          >
            {/* Spinning Custom Gold Logo with Halo */}
            <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#FF8A00]/15 filter blur-xl animate-pulse"></div>
              <motion.div
                animate={{ rotateY: 360 }}
                transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}
                className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#FFD700]/30 flex items-center justify-center shadow-[0_0_30px_rgba(255,138,0,0.25)] bg-[#050816]"
              >
                <img src="/loading-logo.png" alt="Loading Logo" className="w-full h-full object-contain p-1" />
              </motion.div>
            </div>

            {/* Glowing Logo Text */}
            <h1 className="text-xl font-extrabold tracking-[0.25em] text-white uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">
              ELITE FORCE
            </h1>
            <p className="text-[10px] text-slate-500 font-bold tracking-[0.4em] uppercase mt-2">
              WEB3 ECOSYSTEM v2.0
            </p>

            {/* Particle Loading Line */}
            <div className="w-36 h-1 bg-white/5 rounded-full mt-8 overflow-hidden relative">
              <motion.div
                initial={{ left: '-100%' }}
                animate={{ left: '100%' }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                className="absolute w-1/2 h-full bg-gradient-to-r from-transparent via-accent-cyan to-transparent"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 4. Main Application Structure */}
      {!loading && (
        <div className={
          isAdminPath 
            ? "w-full h-screen bg-[#050816]/95 backdrop-blur-sm relative flex flex-col overflow-hidden"
            : "w-full h-full max-w-[430px] md:h-[840px] md:rounded-[36px] md:border-[6px] md:border-[#1E2338] md:shadow-[0_25px_80px_rgba(0,0,0,0.8),_0_0_0_1px_rgba(255,255,255,0.05),_0_0_40px_rgba(0,229,255,0.03)] bg-[#050816]/95 backdrop-blur-sm relative flex flex-col overflow-hidden"
        }>
          
          {/* Simulated Mobile Speaker Cutout on Desktop */}
          {!isAdminPath && (
            <div className="hidden md:block absolute top-0 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-[#1E2338] rounded-b-2xl z-50">
              <div className="w-12 h-1 bg-black rounded-full mx-auto mt-1.5"></div>
            </div>
          )}

          {/* Toast Notification Container */}
          <div className="absolute top-8 left-4 right-4 z-50 flex flex-col gap-2">
            <AnimatePresence>
              {toasts.map((toast) => (
                <motion.div
                  key={toast.id}
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  className="glass-panel px-4 py-3 rounded-2xl flex items-center gap-3 shadow-[0_12px_30px_rgba(0,0,0,0.3)] border-white/8 relative overflow-hidden"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                    toast.type === 'success' ? 'bg-accent-success' :
                    toast.type === 'error' ? 'bg-accent-danger' :
                    toast.type === 'warning' ? 'bg-accent-warning' : 'bg-accent-cyan'
                  }`} />
                  
                  <div className={`shrink-0 ${
                    toast.type === 'success' ? 'text-accent-success' :
                    toast.type === 'error' ? 'text-accent-danger' :
                    toast.type === 'warning' ? 'text-accent-warning' : 'text-accent-cyan'
                  }`}>
                    {toast.type === 'success' && <CheckCircle size={16} />}
                    {toast.type === 'error' && <ShieldAlert size={16} />}
                    {toast.type === 'warning' && <AlertCircle size={16} />}
                    {toast.type === 'info' && <Info size={16} />}
                  </div>

                  <span className="text-xs font-semibold text-slate-200 tracking-wide">
                    {toast.message}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Render routed content */}
          {renderRoutedPage()}

        </div>
      )}
    </div>
  );
}
