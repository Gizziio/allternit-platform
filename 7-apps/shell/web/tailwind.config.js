/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../6-ui/a2r-platform/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border-default)",
        input: "var(--border-default)",
        ring: "var(--accent-chat)",
        background: "var(--bg-primary)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--accent-chat)",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "var(--bg-secondary)",
          foreground: "var(--text-secondary)",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "var(--rail-hover)",
          foreground: "var(--text-tertiary)",
        },
        accent: {
          DEFAULT: "var(--rail-active-bg)",
          foreground: "var(--rail-active-fg)",
        },
        popover: {
          DEFAULT: "var(--glass-bg-thick)",
          foreground: "var(--text-primary)",
        },
        card: {
          DEFAULT: "var(--bg-secondary)",
          foreground: "var(--text-primary)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-collapsible-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-collapsible-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
