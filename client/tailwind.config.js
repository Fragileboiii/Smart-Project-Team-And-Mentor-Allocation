/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:  { 900: '#0f172a', 800: '#1e293b', 700: '#334155', 600: '#475569' },
        indigo:{ 500: '#6366f1', 400: '#818cf8', 300: '#a5b4fc' },
        cyan:  { 400: '#22d3ee', 300: '#67e8f9' },
        emerald:{ 400: '#34d399', 500: '#10b981' },
        amber: { 400: '#fbbf24', 500: '#f59e0b' },
        rose:  { 400: '#fb7185', 500: '#f43f5e' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
