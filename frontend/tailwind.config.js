/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "primary": "#b87414",
        "background-light": "#f8f7f6",
        "background-dark": "#211a11",
      },
    },
  },
  plugins: [],
}