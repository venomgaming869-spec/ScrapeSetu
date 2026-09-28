/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: '#176d49',
        'forest-dark': '#145f40',
        mint: '#d5f0df',
        canvas: '#f5f7f4',
        ink: '#1d2621',
        muted: '#66756c',
        line: '#d8e1d9',
        cream: '#f7f5eb',
      },
      fontFamily: {
        sans: ['DM Sans', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 12px 40px rgba(22, 54, 35, 0.08)',
      },
    },
  },
  plugins: [],
}