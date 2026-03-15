import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          50:  '#f0fff0',
          100: '#dcfcdc',
          200: '#c0f8c0',
          300: '#a0f2a0',
          400: '#80EF80',   // pastel green — main accent / hover
          500: '#5ed65e',   // buttons — slightly darker for contrast
          600: '#42b842',   // darker hover
          700: '#2e8c2e',
          800: '#1e641e',
          900: '#114011',
          950: '#082608',
        },
        brand: {
          50:  '#f0fff0',
          500: '#80EF80',
          600: '#5ed65e',
          900: '#114011',
        },
        dark: {
          900: "#0a0f0d",
          800: "#111814",
          700: "#1a2318",
          600: "#243020",
        },
      },
      animation: {
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-fast": "pulse 0.8s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in": "slideIn 0.4s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        "bounce-in": "bounceIn 0.5s cubic-bezier(0.68,-0.55,0.265,1.55)",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        bounceIn: {
          "0%": { transform: "scale(0)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
