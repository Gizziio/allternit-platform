import React from "react";
import type { Preview } from "@storybook/react";

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
  decorators: [
    (Story) => (
      <div style={{ 
        height: "100vh", 
        width: "100vw",
        background: "#0d0d0d",
        color: "#e2e8f0",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
