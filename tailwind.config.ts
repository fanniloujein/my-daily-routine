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
        ink: v("ink"),
        "ink-2": v("ink-2"),
        muted: v("muted"),
        line: v("line"),
        primary: v("primary"),
        "primary-strong": v("primary-strong"),
        "primary-soft": v("primary-soft"),
        navy: v("navy"),
        lavender: v("lavender"),
        "lavender-soft": v("lavender-soft"),
        success: v("success"),
        "success-soft": v("success-soft"),
        warning: v("warning"),
        "warning-soft": v("warning-soft"),
        danger: v("danger"),
        "danger-soft": v("danger-soft"),
      },
      borderRadius: { xl: "0.9rem", "2xl": "1.25rem", "3xl": "1.75rem" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.05), 0 8px 24px -12px rgb(var(--shadow) / 0.18)",
        pop: "0 12px 40px -12px rgb(var(--shadow) / 0.35)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["ui-rounded", "SF Pro Rounded", "Nunito", "Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "fade-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
        "scale-in": { from: { opacity: "0", transform: "scale(.97)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: { "fade-in": "fade-in .25s ease-out both", "scale-in": "scale-in .18s ease-out both" },
    },
  },
  plugins: [],
} satisfies Config;
