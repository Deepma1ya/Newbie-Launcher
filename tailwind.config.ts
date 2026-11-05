/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{html,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        grass: 'rgb(var(--grass) / <alpha-value>)',
        leaf: 'rgb(var(--leaf) / <alpha-value>)',
        gold: 'rgb(var(--gold) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        info: 'rgb(var(--info) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'Segoe UI', 'sans-serif'],
        display: ['Sora', 'Inter Variable', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace']
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem'
      },
      boxShadow: {
        soft: '0 18px 60px -24px rgba(0,0,0,0.75)',
        lift: '0 24px 70px -30px rgba(0,0,0,0.85)',
        glow: '0 0 0 1px rgba(110,231,160,0.18), 0 18px 50px -20px rgba(78,204,130,0.45)'
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        updateFill: {
          '0%': { width: '8%' },
          '70%': { width: '78%' },
          '100%': { width: '92%' }
        },
        breathe: {
          '0%, 100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.03)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      },
      animation: {
        shimmer: 'shimmer 2.2s linear infinite',
        'update-fill': 'updateFill 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        breathe: 'breathe 5s ease-in-out infinite',
        float: 'float 6s ease-in-out infinite'
      }
    }
  },
  plugins: []
}
