/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#dc2626",
          dark: "#991b1b",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      boxShadow: {
        neu: "6px 6px 12px rgba(0,0,0,0.18), -2px -2px 8px rgba(255,255,255,0.04)",
      },
    },
  },
  plugins: [],
};
