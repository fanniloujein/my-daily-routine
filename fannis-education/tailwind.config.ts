import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Bleu pastel — identité principale (600/700 pour textes et boutons, contraste AA)
        brand: {
          50: "#F1F7FD",
          100: "#E1EEFB",
          200: "#C6DFF7",
          300: "#A3CBF1",
          400: "#79B1E8",
          500: "#5596DB",
          600: "#3B7BC6",
          700: "#2F63A2",
          800: "#2A5385",
          900: "#26466D",
        },
        // Jaune pastel — accent doux
        sun: {
          50: "#FFFCF0",
          100: "#FFF6D6",
          200: "#FFEDAD",
          300: "#FFE07A",
          400: "#F9CF4A",
          500: "#E9B726",
          700: "#8A6410",
        },
        surface: "#F6F7F9",
        ink: {
          DEFAULT: "#1F2937",
          soft: "#4B5563",
          muted: "#6B7280",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Noto Sans Arabic",
          "Tahoma",
          "sans-serif",
        ],
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.25rem" },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.05)",
        soft: "0 1px 2px rgba(16,24,40,.05)",
      },
    },
  },
  plugins: [],
};

export default config;
