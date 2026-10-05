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
          dark: "#edf3f7",
          card: "#ffffff",
          border: "#7b8d9c",
          accent: "#315f7e",
          emerald: "#3e704b",
          amber: "#745014",
          rose: "#98453f",
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
          '0%, 100%': { opacity: '1', filter: 'drop-shadow(0 0 8px rgba(49, 95, 126, 0.35))' },
          '50%': { opacity: '0.6', filter: 'drop-shadow(0 0 2px rgba(49, 95, 126, 0.12))' }
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
