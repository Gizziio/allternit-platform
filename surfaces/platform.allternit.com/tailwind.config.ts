import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{tsx,ts}",
    "./index.html",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        border: "var(--border-default)",
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--accent-primary)",
          foreground: "var(--ui-text-inverse)",
        },
        secondary: {
          DEFAULT: "var(--bg-secondary)",
          foreground: "var(--text-secondary)",
        },
        muted: {
          DEFAULT: "var(--bg-tertiary)",
          foreground: "var(--text-tertiary)",
        },
        accent: {
          DEFAULT: "var(--surface-hover)",
          foreground: "var(--text-primary)",
        },
      },
      borderRadius: {
        lg: "0.625rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
