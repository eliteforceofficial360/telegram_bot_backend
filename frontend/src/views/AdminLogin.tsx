import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';

interface AdminLoginProps {
  onSuccess?: () => void;
  onLoginSuccess?: () => void;
  showToast: (msg: string, type: any) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onSuccess, onLoginSuccess, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSuccessCall = () => {
    if (onLoginSuccess) onLoginSuccess();
    if (onSuccess) onSuccess();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !password.trim()) {
      showToast('Please enter both Email & Password.', 'error');
      return;
    }

    setLoading(true);

    try {
      if (!isFirebaseConfigured || !auth) {
        showToast('Demo Mode: Authenticated successfully!', 'info');
        handleSuccessCall();
        return;
      }

      await signInWithEmailAndPassword(auth, email.trim(), password);
      showToast('Login successful! Access granted.', 'success');
      handleSuccessCall();
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      let errorMsg = 'Authentication failed. Invalid credentials.';
      if (err.code === 'auth/user-not-found') errorMsg = 'No admin account found with this email.';
      if (err.code === 'auth/wrong-password') errorMsg = 'Incorrect password.';
      if (err.code === 'auth/invalid-email') errorMsg = 'Invalid email address format.';
      if (err.code === 'auth/too-many-requests') errorMsg = 'Too many failed attempts. Try again later.';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-[65vh] px-4 w-full bg-[#FAFBFC] select-none font-sans">
      <div className="w-full max-w-[400px] relative">

        {/* Corporate card with subtle top border accent */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-900" />

          {/* Node status header */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-500 tracking-widest uppercase">
              Secure Terminal · Node Active
            </span>
          </div>

          {/* Icon */}
          <div className="flex items-center justify-center mb-5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xl shadow-xs">
              <i className="fa-solid fa-shield-halved text-amber-400"></i>
            </div>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">EForce Console</h2>
            <p className="text-[11px] text-slate-500 font-mono tracking-wider mt-1 uppercase">
              Ecosystem Super Authorization
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10.5px] text-slate-600 font-mono font-bold uppercase tracking-wider">
                Admin Email
              </label>
              <div className="flex items-center gap-2.5 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition-all shadow-xs">
                <i className="fa-solid fa-envelope text-slate-400 text-xs"></i>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="bg-transparent border-none outline-none text-xs text-slate-900 w-full placeholder-slate-400 font-medium"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10.5px] text-slate-600 font-mono font-bold uppercase tracking-wider">
                Security Password
              </label>
              <div className="flex items-center gap-2.5 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 focus-within:border-slate-900 focus-within:ring-1 focus-within:ring-slate-900 transition-all shadow-xs">
                <i className="fa-solid fa-lock text-slate-400 text-xs"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none text-xs text-slate-900 w-full placeholder-slate-400 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs mt-3 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <i className="fa-solid fa-circle-notch animate-spin text-sm"></i>
              ) : (
                <>
                  <span>Authenticate Console Access</span>
                  <i className="fa-solid fa-arrow-right-to-bracket text-xs"></i>
                </>
              )}
            </button>
          </form>
        </div>

        <div className="text-[10px] text-slate-400 mt-6 text-center leading-relaxed font-mono uppercase tracking-widest">
          Controlled node environment · Unauthorized access is logged
        </div>
      </div>
    </div>
  );
};