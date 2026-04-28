/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#1476ff',
        'secondary': '#f3f5ff',
        'light': '#f3f5ff',
        'background': '#f9faff',
        'text': '#111827',
      },
    },
  },
  plugins: [],
}

