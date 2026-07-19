import React, { useState } from 'react';
import { Shield, Key, ArrowRight, Eye, EyeOff, Mail } from 'lucide-react';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const startSession = (uid: string, userEmail: string | null) => {
    localStorage.setItem('admin_session', JSON.stringify({
      email: userEmail,
      uid,
      loginTime: Date.now(),
      expires: Date.now() + (24 * 60 * 60 * 1000), // 24 ঘন্টা
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) {
      showToast('Please fill in all credentials.', 'warning');
      return;
    }
    setLoading(true);

    // ⚠️ Dev fallback শুধু import.meta.env.DEV (local dev build) এ চলবে,
    // প্রোডাকশন বিল্ডে এই ব্লকটা বান্ডলে আসবেই না।
    if (import.meta.env.DEV && !isFirebaseConfigured()) {
      setTimeout(() => {
        setLoading(false);
        if (email === 'admin@eforce.com' && password === 'EForce@Admin2025') {
          startSession('DEV_MOCK_ADMIN', email.trim());
          showToast('Dev mode: Admin session authorized.', 'success');
          onLoginSuccess();
        } else {
          showToast('Invalid email or password. Access Denied.', 'error');
        }
      }, 800);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 🔒 আসল অ্যাডমিন চেক — Firestore "admins" কালেকশনে uid আছে কিনা দেখো
      const adminDoc = await getDoc(doc(db, 'admins', user.uid));

      if (!adminDoc.exists()) {
        await signOut(auth); // অ্যাডমিন না হলে সাথে সাথে সাইন-আউট করে দাও
        showToast('This account does not have admin access.', 'error');
        setLoading(false);
        return;
      }

      startSession(user.uid, user.email);
      showToast('✅ Admin session authorized.', 'success');
      setLoading(false);
      onLoginSuccess();
    } catch (err: any) {
      console.error('Admin auth error:', err);
      let errorMsg = 'Authentication error. Access Denied.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        errorMsg = 'Invalid email or password. Access Denied.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Invalid email address format.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMsg = 'Too many attempts. Please try again later.';
      }
      showToast(errorMsg, 'error');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] px-4 w-full select-none">
      <div className="w-full max-w-[360px] glass-panel p-6 rounded-[28px] border-white/8 relative overflow-hidden shadow-[0_20px_50px_rgba(179,136,255,0.05)]">
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent-purple/10 rounded-full filter blur-xl"></div>
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent-cyan/10 rounded-full filter blur-xl"></div>

        <div className="w-14 h-14 rounded-full bg-accent-purple/10 border border-accent-purple/20 flex items-center justify-center mx-auto mb-4 text-accent-purple">
          <Shield size={26} className="animate-pulse" />
        </div>

        <div className="text-center mb-6">
          <h2 className="text-lg font-black text-white tracking-wide uppercase">EForce Console</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Ecosystem Authorization</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="admin-email" className="text-[9px] text-slate-500 font-bold uppercase tracking-wider pl-1">
              Admin Email (Gmail)
            </label>
            <div className="flex items-center gap-2 bg-[#12182D] border border-white/8 rounded-xl px-3.5 py-2 focus-within:border-accent-cyan transition-all">
              <Mail size={14} className="text-slate-500 shrink-0" />
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-slate-600 text-left"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="admin-password" className="text-[9px] text-slate-500 font-bold uppercase tracking-wider pl-1">
              Security Password
            </label>
            <div className="flex items-center gap-2 bg-[#12182D] border border-white/8 rounded-xl px-3.5 py-2 focus-within:border-accent-cyan transition-all">
              <Key size={14} className="text-slate-500 shrink-0" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-transparent border-none outline-none text-xs text-white w-full placeholder-slate-600 text-left"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full h-11 bg-gradient-to-r from-accent-purple to-accent-blue hover:shadow-[0_0_20px_rgba(179,136,255,0.25)] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
            ) : (
              <>
                <span>Sign In to Console</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="text-[10px] text-slate-600 mt-6 text-center leading-normal uppercase font-bold tracking-widest">
        🔐 Controlled node environment. Unauthorized access is recorded.
      </div>
    </div>
  );
};