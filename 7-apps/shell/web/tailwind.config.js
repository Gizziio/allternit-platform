/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../6-ui/a2r-platform/src/**/*.{ts,tsx}",
  ],
  safelist: [
    // Dialog positioning classes (arbitrary values need safelisting)
    "left-[50%]",
    "top-[50%]",
    "translate-x-[-50%]",
    "translate-y-[-50%]",
    "max-h-[85vh]",
    // Animation classes used by Dialog
    "data-[state=open]:animate-in",
    "data-[state=closed]:animate-out",
    "data-[state=closed]:fade-out-0",
    "data-[state=open]:fade-in-0",
    "data-[state=closed]:zoom-out-95",
    "data-[state=open]:zoom-in-95",
    "data-[state=closed]:slide-out-to-left-1/2",
    "data-[state=closed]:slide-out-to-top-[48%]",
    "data-[state=open]:slide-in-from-left-1/2",
    "data-[state=open]:slide-in-from-top-[48%]",
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
