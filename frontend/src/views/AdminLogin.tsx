import React, { useState } from 'react';
import { ShieldCheck, KeyRound, ArrowRight, Eye, EyeOff, Mail } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';

interface AdminLoginProps {
  onLoginSuccess: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess, showToast }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast("Please fill in all credentials.", "warning");
      return;
    }

    setLoading(true);

    if (!isFirebaseConfigured()) {
      // Local dev mode fallback if Firebase is not setup
      setTimeout(() => {
        setLoading(false);
        if (email === 'admin@eforce.com' && password === 'EForce@Admin2025') {
          // Store mock admin session in localStorage
          localStorage.setItem('admin_session', JSON.stringify({
            email: email.trim(),
            uid: 'DEV_MOCK_ADMIN',
            loginTime: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
          }));
          showToast("Dev mode: Admin session authorized.", "success");
          onLoginSuccess();
        } else {
          showToast("Invalid email or password. Access Denied.", "error");
        }
      }, 800);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Store admin session in localStorage
      localStorage.setItem('admin_session', JSON.stringify({
        email: user.email,
        uid: user.uid,
        loginTime: Date.now(),
        expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }));

      showToast("✅ Admin session authorized.", "success");
      setLoading(false);
      onLoginSuccess();
    } catch (err: any) {
      console.error("Admin auth error:", err);
      let errorMsg = "Authentication error. Access Denied.";
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        errorMsg = "Invalid email or password. Access Denied.";
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = "Invalid email address format.";
      }
      showToast(errorMsg, "error");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] px-4 w-full bg-[#FAFBFC] select-none">
      <div className="w-full max-w-[380px] relative">

        {/* Corner brackets — signature element echoing "controlled node" security identity */}
        <span className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-[#2952CC]" />
        <span className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-[#2952CC]" />
        <span className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-[#2952CC]" />
        <span className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-[#2952CC]" />

        <div className="bg-white border border-[#E4E7EC] rounded-md p-7 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">

          {/* Status strip */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2952CC] opacity-60"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2952CC]"></span>
            </span>
            <span className="text-[10px] font-mono text-[#667085] tracking-[0.15em] uppercase">Secure Node · Active</span>
          </div>

          {/* Icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-11 h-11 rounded-sm bg-[#101828] flex items-center justify-center text-white">
              <ShieldCheck size={20} strokeWidth={1.75} />
            </div>
          </div>

          <div className="text-center mb-7">
            <h2 className="text-xl font-bold text-[#101828] tracking-tight">EForce Console</h2>
            <p className="text-[11px] text-[#667085] font-mono tracking-wide mt-1 uppercase">Ecosystem Authorization</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#667085] font-mono uppercase tracking-[0.1em] pl-0.5">Admin Email</label>
              <div className="flex items-center gap-2 border-b border-[#D0D5DD] focus-within:border-[#101828] transition-colors py-2">
                <Mail size={14} className="text-[#98A2B3] shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="bg-transparent border-none outline-none text-sm text-[#101828] w-full placeholder-[#98A2B3]"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-[#667085] font-mono uppercase tracking-[0.1em] pl-0.5">Security Password</label>
              <div className="flex items-center gap-2 border-b border-[#D0D5DD] focus-within:border-[#101828] transition-colors py-2">
                <KeyRound size={14} className="text-[#98A2B3] shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-transparent border-none outline-none text-sm text-[#101828] w-full placeholder-[#98A2B3]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#98A2B3] hover:text-[#101828] transition-colors shrink-0"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#101828] hover:bg-[#1D2939] text-white text-xs font-semibold rounded-sm flex items-center justify-center gap-1.5 transition-colors mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
      </div>

      <div className="text-[10px] text-[#98A2B3] mt-6 text-center leading-relaxed font-mono uppercase tracking-widest">
        Controlled node environment · Unauthorized access is recorded
      </div>
    </div>
  );
};