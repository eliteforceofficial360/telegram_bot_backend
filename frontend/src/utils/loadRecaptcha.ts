// src/utils/loadRecaptcha.ts
export function loadRecaptcha() {
    if (document.querySelector('script[src*="recaptcha/enterprise.js"]')) return;
    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/enterprise.js?render=6Lc7s1ktAAAAAItxOhjl2fLpLkM1ldYk-AVupikV';
    script.async = true;
    document.head.appendChild(script);
}