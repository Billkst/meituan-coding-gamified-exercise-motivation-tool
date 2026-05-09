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
      },
    },
  },
  plugins: [],
} satisfies Config
