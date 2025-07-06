/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'page': '#1a1a1a',
        'surface': '#2d2d2d',
        'primary': '#4a4a4a',
        'accent': '#6b6b6b',
        'text': '#ffffff',
        'text-secondary': '#cccccc',
        'border': '#404040',
        'input': '#333333',
        'button': '#555555',
        'button-hover': '#666666',
        'success': '#4ade80',
        'error': '#f87171',
        'warning': '#fbbf24'
      }
    },
  },
  plugins: [],
} 