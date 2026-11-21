import type { Config } from "tailwindcss";

const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        "surface-2": v("surface-2"),
        beige: v("beige"),
        ink: v("ink"),
        "ink-2": v("ink-2"),
        muted: v("muted"),
        line: v("line"),
        primary: v("primary"),
        "primary-strong": v("primary-strong"),
        "primary-soft": v("primary-soft"),
        navy: v("navy"),
        accent: v("accent"),
        "accent-soft": v("accent-soft"),
        success: v("success"),
        "success-soft": v("success-soft"),
        warning: v("warning"),
        "warning-soft": v("warning-soft"),
        danger: v("danger"),
        "danger-soft": v("danger-soft"),
      },
      borderRadius: { xl: "0.85rem", "2xl": "1.15rem", "3xl": "1.6rem" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.04), 0 6px 20px -10px rgb(var(--shadow) / 0.16)",
        pop: "0 16px 48px -12px rgb(var(--shadow) / 0.35)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "scale-in": { from: { opacity: "0", transform: "scale(.97)" }, to: { opacity: "1", transform: "none" } },
        "slide-in": { from: { transform: "translateX(100%)" }, to: { transform: "none" } },
      },
      animation: { "fade-in": "fade-in .22s ease-out both", "scale-in": "scale-in .16s ease-out both", "slide-in": "slide-in .22s ease-out both" },
    },
  },
  plugins: [],
} satisfies Config;
