import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          tertiary: 'var(--bg-tertiary)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          pink: 'var(--accent-pink)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        rarity: {
          common: 'var(--rarity-common)',
          rare: 'var(--rarity-rare)',
          epic: 'var(--rarity-epic)',
          legendary: 'var(--rarity-legendary)',
        },
        semantic: {
          success: 'var(--semantic-success)',
          warning: 'var(--semantic-warning)',
          error: 'var(--semantic-error)',
          info: 'var(--semantic-info)',
        },
      },
      fontFamily: {
        display: ['Satoshi', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        body: ['Instrument Sans', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'glow-subtle': '0 0 4px rgba(182,255,60,0.3)',
        'glow-standard': '0 0 12px rgba(182,255,60,0.5)',
        'glow-hero': '0 0 24px rgba(182,255,60,0.7), 0 0 48px rgba(182,255,60,0.3)',
        'glow-legendary': '0 0 16px rgba(255,200,60,0.8), 0 0 40px rgba(255,200,60,0.4)',
      },
      borderRadius: {
        card: '4px',
        button: '8px',
      },
      maxWidth: {
        container: '1280px',
      },
      transitionTimingFunction: {
        'enter': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'exit': 'cubic-bezier(0.4, 0, 1, 1)',
        'move': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'breathing': 'breathing 4s ease-in-out infinite',
        'buff-pulse': 'buff-pulse 1.2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s linear infinite',
        'shuffle': 'shuffle 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'reveal-flip': 'reveal-flip 600ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'halo-pulse': 'halo-pulse 2s ease-in-out infinite',
        'fade-up': 'fade-up 800ms ease-out forwards',
        'strike-up': 'strike-up 700ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'strike-down': 'strike-down 700ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'shake-hit': 'shake-hit 400ms ease-in-out',
        'damage-float': 'damage-float 900ms ease-out forwards',
      },
      keyframes: {
        breathing: {
          '0%, 100%': { filter: 'brightness(0.8)', transform: 'scale(1.0)' },
          '50%':      { filter: 'brightness(1.0)', transform: 'scale(1.02)' },
        },
        'buff-pulse': {
          '0%, 100%': { opacity: '0.7' },
          '50%':      { opacity: '1.0' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        shuffle: {
          '0%':   { transform: 'rotate(0deg) scale(0.85)',   opacity: '0.6' },
          '20%':  { transform: 'rotate(-12deg) scale(0.95)', opacity: '0.85' },
          '50%':  { transform: 'rotate(180deg) scale(1.05)', opacity: '1' },
          '80%':  { transform: 'rotate(348deg) scale(0.95)', opacity: '0.85' },
          '100%': { transform: 'rotate(360deg) scale(0.7)',  opacity: '0' },
        },
        'reveal-flip': {
          '0%':   { transform: 'rotateY(180deg) scale(0.5)', opacity: '0' },
          '60%':  { transform: 'rotateY(-12deg) scale(1.08)', opacity: '1' },
          '100%': { transform: 'rotateY(0deg) scale(1)',     opacity: '1' },
        },
        'halo-pulse': {
          '0%, 100%': { filter: 'brightness(1.0)' },
          '50%':      { filter: 'brightness(1.25)' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(0px)' },
          '20%':  { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(-40px)' },
        },
        'strike-up': {
          '0%':   { transform: 'translateY(0)', filter: 'brightness(1)' },
          '40%':  { transform: 'translateY(-80px) scale(1.05)', filter: 'brightness(1.4)' },
          '60%':  { transform: 'translateY(-80px) scale(1.05)', filter: 'brightness(1.4)' },
          '100%': { transform: 'translateY(0)', filter: 'brightness(1)' },
        },
        'strike-down': {
          '0%':   { transform: 'translateY(0)', filter: 'brightness(1)' },
          '40%':  { transform: 'translateY(80px) scale(1.05)', filter: 'brightness(1.4)' },
          '60%':  { transform: 'translateY(80px) scale(1.05)', filter: 'brightness(1.4)' },
          '100%': { transform: 'translateY(0)', filter: 'brightness(1)' },
        },
        'shake-hit': {
          '0%, 100%':  { transform: 'translateX(0)' },
          '20%, 60%':  { transform: 'translateX(-4px)' },
          '40%, 80%':  { transform: 'translateX(4px)' },
        },
        'damage-float': {
          '0%':   { opacity: '0', transform: 'translate(-50%, 0) scale(0.5)' },
          '15%':  { opacity: '1', transform: 'translate(-50%, -10px) scale(1.2)' },
          '40%':  { opacity: '1', transform: 'translate(-50%, -30px) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -70px) scale(0.9)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
