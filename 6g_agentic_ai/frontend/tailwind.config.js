/** @type {import('tailwindcss').Config} */
export default {
  content: {
    relative: true,
    files: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
  },
  theme: {
    extend: {
      colors: {
        factory: {
          dark: "#0a0d14",
          card: "#121824",
          border: "#1e293b",
          accent: "#38bdf8",
          emerald: "#10b981",
          amber: "#f59e0b",
          rose: "#f43f5e",
          purple: "#a855f7",
          cyan: "#06b6d4"
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s infinite',
        'conveyor': 'conveyorMove 1s linear infinite'
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.6))' },
          '50%': { opacity: '0.6', filter: 'drop-shadow(0 0 2px rgba(56, 189, 248, 0.2))' }
        },
        conveyorMove: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '20px 0' }
        }
      }
    },
  },
  plugins: [],
}
