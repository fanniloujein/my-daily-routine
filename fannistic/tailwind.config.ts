import type { Config } from "tailwindcss";

// Palette officielle du kit logo Fanni'stic.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        midnight: { DEFAULT: "#0E1633", 900: "#0A1028", 800: "#141E42", 700: "#1C2852", 600: "#2A3866" },
        gold: { DEFAULT: "#FFB800", sun: "#FFC21A", soft: "#FFF4D6" },
        cyan: { DEFAULT: "#1FC8E3", deep: "#0E8FA5", soft: "#E3F8FC" },
        ink: { DEFAULT: "#0E1633", 2: "#3B4466", muted: "#5F6787" },
        paper: { DEFAULT: "#FFFFFF", 2: "#F4F6FA", 3: "#E8ECF4" },
        line: "#E1E5EF",
        success: { DEFAULT: "#0F8A5F", soft: "#E3F5EE" },
        danger: { DEFAULT: "#C43B3B", soft: "#FBEAEA" },
      },
      fontFamily: {
        sans: ["var(--font-poppins)", "ui-sans-serif", "system-ui", "sans-serif"],
        arabic: ["var(--font-arabic)", "var(--font-poppins)", "system-ui", "sans-serif"],
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: {
        card: "0 1px 2px rgb(14 22 51 / 0.05), 0 10px 30px -14px rgb(14 22 51 / 0.22)",
        pop: "0 20px 50px -20px rgb(14 22 51 / 0.45)",
        glow: "0 0 0 1px rgb(31 200 227 / 0.35), 0 12px 40px -12px rgb(31 200 227 / 0.45)",
      },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        twinkle: { "0%,100%": { opacity: "1", transform: "scale(1)" }, "50%": { opacity: ".6", transform: "scale(.85)" } },
      },
      animation: {
        "fade-up": "fade-up .35s ease-out both",
        float: "float 6s ease-in-out infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
