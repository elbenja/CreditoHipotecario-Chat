import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // App background sits between slate-950 and slate-900.
        'ch-bg': '#0b0f1a',
        'ch-panel': '#0f172a',
        'ch-card': '#1e293b',
        'ch-border': '#1e293b',
        'ch-border-hover': '#334155',
        // The single accent. On Screen 2 it appears in exactly four places.
        'ch-accent': '#F4BC44',
        'ch-pos': '#4ade80',
        'ch-neg': '#f87171',
      },
      fontFamily: {
        jakarta: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        inter: ['Inter', 'system-ui', 'sans-serif'],
      },
      transitionTimingFunction: { ch: 'cubic-bezier(.2,.7,.2,1)' },
      transitionDuration: { 120: '120ms', 180: '180ms', 240: '240ms' },
      maxWidth: { transcript: '640px' },
      width: { panel: '372px' },
      height: { nav: '60px' },
    },
  },
  plugins: [],
} satisfies Config;
