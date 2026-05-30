/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        m: {
          blue: '#4263eb',
          blueBg: '#edf2ff',
          blueBgHover: '#dbe4ff',
          blueBgStrong: '#5c7cfa',
          border: '#e9ecef',
          bgSubtle: '#f8f9fa',
          text: '#212529',
          textDim: '#495057',
          textMute: '#868e96',
          darkBg: '#1a1b1e',
          darkBgSubtle: '#25262b',
          darkBorder: '#373a40',
          darkText: '#c1c2c5',
        },
      },
    },
  },
  plugins: [],
};
