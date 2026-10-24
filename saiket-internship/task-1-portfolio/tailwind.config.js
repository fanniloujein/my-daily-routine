/** Tailwind config for the portfolio (Task 1).
 *  Colors point to CSS variables so the whole site can switch theme
 *  (dawn / day / dusk / night) by changing a single attribute on <html>.
 */
const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

module.exports = {
  content: ["./index.html", "./assets/js/**/*.js"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        ink: v("ink"),
        muted: v("muted"),
        line: v("line"),
        accent: v("accent"),
        accent2: v("accent2"),
        ok: v("ok"),
        bad: v("bad"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Space Grotesk'", "Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      maxWidth: { page: "72rem" },
    },
  },
  plugins: [],
};
