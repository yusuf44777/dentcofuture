import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-syne)", "system-ui", "sans-serif"]
      },
      colors: {
        bg: "#0A0A0F",
        surface: "#13131A",
        "surface-2": "#1A1A24",
        purple: {
          DEFAULT: "#6C63FF",
          dim: "rgba(108,99,255,0.15)",
          glow: "rgba(108,99,255,0.4)"
        },
        mint: {
          DEFAULT: "#00E5A0",
          dim: "rgba(0,229,160,0.15)",
          glow: "rgba(0,229,160,0.4)"
        },
        danger: "#FF4D6D"
      },
      borderRadius: {
        card: "12px",
        pill: "999px"
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" }
        },
        "fly-up": {
          "0%": { opacity: "1", transform: "translateY(0) scale(1)" },
          "100%": { opacity: "0", transform: "translateY(-120px) scale(1.4)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out both",
        "fade-in": "fade-in 0.4s ease-out both",
        float: "float 3s ease-in-out infinite",
        "pulse-slow": "pulse 2s ease-in-out infinite",
        "fly-up": "fly-up 1.2s ease-out forwards",
        shimmer: "shimmer 3s linear infinite"
      },
      boxShadow: {
        purple: "0 0 30px rgba(108,99,255,0.3)",
        mint: "0 0 30px rgba(0,229,160,0.3)",
        card: "0 4px 24px rgba(0,0,0,0.4)"
      }
    }
  },
  plugins: []
};

export default config;
