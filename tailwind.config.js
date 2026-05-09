/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#f8f0e5',
        linen: '#fffaf4',
        cocoa: '#5a3f32',
        caramel: '#b88a5d',
        gold: '#c9a45b',
        rose: '#b96f68',
        blush: '#efd7d2',
      },
      boxShadow: {
        soft: '0 18px 48px rgba(90, 63, 50, 0.14)',
      },
    },
  },
  plugins: [],
};
