/**
 * OAuthCallbackPage.tsx
 *
 * Landing page after the user grants X (Twitter) OAuth permission.
 * URL: https://mini-telegram-app-c0fb4.web.app/auth/x/callback?code=xxx&state=xxx
 *
 * Flow:
 *  1. Read `code` and `state` from URL search params.
 *  2. Validate `state` against localStorage value (CSRF protection).
 *  3. POST { code, state } to /api/x/callback on the backend.
 *  4. On success: store sessionToken in localStorage, open Telegram deep link.
 *  5. On error: display friendly error — no website landing page.
 */

import { useEffect, useState } from 'react';

type Status = 'loading' | 'success' | 'error';

// These values are read from adminSettings in App.tsx,
// but since OAuthCallbackPage renders before any Firestore data loads,
// we use hardcoded fallbacks here (same values as adminSettings defaults).
const BOT_API_URL = 'https://elite-force-telegram-app.onrender.com';
const BOT_USERNAME = 'Elite_Force_Official_Mining_bot';

export function OAuthCallbackPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Completing X authentication…');

  useEffect(() => {
    let active = true;

    async function exchange() {
      const params = new URLSearchParams(window.location.search);
      const code       = params.get('code');
      const stateParam = params.get('state');
      const errorParam = params.get('error');
      const errorDesc  = params.get('error_description');

      // ── 0. X returned an explicit error (e.g. user denied) ─────────────────
      if (errorParam) {
        const msg = errorParam === 'access_denied'
          ? 'You declined X access. Please try again inside the app.'
          : `X OAuth error: ${errorDesc || errorParam}`;
        if (active) { setStatus('error'); setMessage(msg); }
        return;
      }

      // ── 1. Required params check ────────────────────────────────────────────
      if (!code || !stateParam) {
        if (active) { setStatus('error'); setMessage('Missing OAuth parameters. Please try again.'); }
        return;
      }

      // ── 2. CSRF: validate state ─────────────────────────────────────────────
      const savedState = localStorage.getItem('x_oauth_state');
      if (savedState && savedState !== stateParam) {
        console.error('[OAuthCallback] State mismatch — possible CSRF.', { savedState, stateParam });
        if (active) { setStatus('error'); setMessage('Security check failed. Please try connecting again.'); }
        return;
      }

      // ── 3. Exchange code for tokens via backend ─────────────────────────────
      try {
        const res = await fetch(`${BOT_API_URL}/api/x/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state: stateParam }),
        });

        let data: Record<string, unknown> = {};
        try { data = await res.json(); } catch { /* non-JSON body */ }

        if (!res.ok || !data.ok) {
          const errMsg = (data.error as string) || `Token exchange failed (HTTP ${res.status})`;
          console.error('[OAuthCallback] Backend error:', errMsg);
          if (active) { setStatus('error'); setMessage(errMsg); }
          return;
        }

        // ── 4. Store one-time session token for Mini App verification ─────────
        const sessionToken = data.sessionToken as string | undefined;
        if (sessionToken) {
          localStorage.setItem('x_oauth_session_token', sessionToken);
        }
        localStorage.removeItem('x_oauth_state'); // Clean up CSRF state

        const xUsername = data.xUsername as string | undefined;
        if (active) {
          setStatus('success');
          setMessage(`✅ @${xUsername ?? 'your account'} connected! Returning to app…`);
        }

        // ── 5. Redirect back to Telegram Mini App ─────────────────────────────
        // startapp=oauth_success tells App.tsx to read x_oauth_session_token
        // from localStorage, verify it with the backend, and auto-complete the task.
        const deepLink = `https://t.me/${BOT_USERNAME}?startapp=oauth_success`;
        setTimeout(() => {
          const tg = (window as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
          if (tg?.openTelegramLink) {
            tg.openTelegramLink(deepLink);
          } else {
            window.location.replace(deepLink);
          }
        }, 900);

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unexpected error during authentication.';
        console.error('[OAuthCallback] Unhandled error:', msg);
        if (active) { setStatus('error'); setMessage(msg); }
      }
    }

    exchange();
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Minimal, self-contained render (no Tailwind / shared CSS required) ─────
  const iconMap: Record<Status, string> = { loading: '🔄', success: '✅', error: '❌' };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)',
      color: '#fff',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '24px',
      textAlign: 'center',
      gap: '20px',
    }}>
      {/* App icon */}
      <div style={{ fontSize: '52px', lineHeight: 1 }}>{iconMap[status]}</div>

      {/* Spinner while loading */}
      {status === 'loading' && (
        <div style={{
          width: '44px',
          height: '44px',
          border: '4px solid rgba(255,138,0,0.2)',
          borderTop: '4px solid #FF8A00',
          borderRadius: '50%',
          animation: 'spin 0.85s linear infinite',
        }} />
      )}

      {/* Elite Force brand */}
      <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '2px', color: '#FF8A00', textTransform: 'uppercase' }}>
        Elite Force
      </div>

      {/* Status message */}
      <p style={{
        maxWidth: '340px',
        fontSize: '16px',
        lineHeight: '1.6',
        color: status === 'error' ? '#ff6b6b' : '#e0e0e0',
        margin: 0,
      }}>
        {message}
      </p>

      {/* Error help text */}
      {status === 'error' && (
        <p style={{ fontSize: '13px', color: '#888', maxWidth: '300px', margin: 0 }}>
          Return to the Elite Force Mini App in Telegram and try connecting your X account again.
        </p>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
