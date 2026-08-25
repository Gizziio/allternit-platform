import React, { useEffect } from "react";
import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";
import "../src/design/theme.css";

const ThemeDecorator = (Story: React.FC) => {
  useEffect(() => {
    const previous = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
    return () => {
      if (previous) {
        document.documentElement.setAttribute("data-theme", previous);
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      document.documentElement.classList.remove("dark");
    };
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        background: "var(--bg-primary, #0d0d0d)",
        color: "var(--text-primary, #e2e8f0)",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
      }}
    >
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: "dark",
      values: [
        {
          name: "dark",
          value: "#0d0d0d",
        },
        {
          name: "light",
          value: "#ffffff",
        },
      ],
    },
  },
  decorators: [ThemeDecorator],
};

export default preview;
