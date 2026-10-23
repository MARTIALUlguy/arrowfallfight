import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: {
          950: "#05070f",
          900: "#0a0e1c",
          800: "#101630",
          700: "#18204a",
          600: "#232d63",
        },
        neon: {
          red: "#ff3b5c",
          orange: "#ff8a2a",
          yellow: "#ffd23f",
          green: "#3ddc84",
          mint: "#5ffbcd",
          cyan: "#3fd8ff",
          blue: "#4f7dff",
          glacier: "#9fd8ff",
          violet: "#a05cff",
          pink: "#ff6ad5",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { filter: "brightness(1)" },
          "50%": { filter: "brightness(1.35)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
