/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#050814",
          900: "#070b1a",
          800: "#0b1228",
          700: "#121a36",
          600: "#1a2550",
        },
        ember: {
          400: "#ffb347",
          500: "#ff8a1f",
          600: "#e56a00",
        },
        volt: {
          300: "#7af6ff",
          400: "#2ee9ff",
          500: "#00c8e0",
        },
        trick: {
          400: "#c084fc",
          500: "#8b5cf6",
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', "ui-monospace", "monospace"],
        display: ['"Exo 2"', "Rajdhani", "system-ui", "sans-serif"],
        body: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(255, 138, 31, 0.35)",
        volt: "0 0 24px rgba(46, 233, 255, 0.35)",
      },
      backgroundImage: {
        scan: "repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0px, rgba(255,255,255,0.015) 1px, transparent 1px, transparent 3px)",
      },
    },
  },
  plugins: [],
};
