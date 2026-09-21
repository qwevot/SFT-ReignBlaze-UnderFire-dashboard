/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        dark: {
          900: '#0b0f19',
          800: '#111827',
          700: '#1f2937',
          600: '#374151'
        },
        hazard: {
          safe: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444'
        }
      }
    },
  },
  plugins: [],
}
