/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-green': '#22c55e',
        'brand-red': '#ef4444',
        'bg-shell': '#0B0E11',
        'bg-card': '#111827',
        'bg-panel': '#111520',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '6': '24px',
      },
      boxShadow: {
        'premium': '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
        'glow-green': '0 0 15px rgba(34, 197, 94, 0.2)',
        'glow-red': '0 0 15px rgba(239, 68, 68, 0.2)',
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
      fontSize: {
        'xxs': '10px',
      }
    },
  },
  plugins: [],
}
