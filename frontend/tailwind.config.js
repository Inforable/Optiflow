/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#07090D',
          900: '#0B0E14',
          800: '#151A23',
          700: '#232D3F',
          600: '#2E3A50',
          500: '#3D4A63',
          400: '#56627A',
          300: '#7A859A',
        },
        primary: {
          DEFAULT: '#06B6D4',
          light: '#22D3EE',
          dark: '#0891B2',
        },
        accent: {
          cyan: '#06B6D4',
          purple: '#8B5CF6',
          success: '#10B981',
          warning: '#F59E0B',
          danger: '#EF4444',
        },
        ai: '#8B5CF6',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      borderRadius: {
        control: '8px',
        card: '12px',
        modal: '16px',
      },
      boxShadow: {
        glow: '0 0 15px rgba(6,182,212,0.3)',
        'glow-strong': '0 0 22px rgba(6,182,212,0.45)',
        'glow-white': '0 0 20px rgba(255,255,255,0.3)',
        'glow-purple': '0 0 10px rgba(139,92,246,0.3), 0 0 20px rgba(139,92,246,0.1)',
        'glow-danger': '0 0 15px rgba(239,68,68,0.3)',
        'glow-success': '0 0 15px rgba(16,185,129,0.3)',
      },
      fontSize: {
        micro: ['10px', { lineHeight: '14px', letterSpacing: '0.06em' }],
      },
      keyframes: {
        flow: { to: { strokeDashoffset: '-24' } },
        'fade-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: {
        flow: 'flow 0.9s linear infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
