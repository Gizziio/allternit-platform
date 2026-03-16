const { mergeConfig } = require("vite");
const path = require("path");

/** @type { import('@storybook/react-vite').StorybookConfig } }
 */
const config = {
  stories: ["../src/**/*.stories.@(js|jsx|ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  viteFinal: async (config) => {
    return mergeConfig(config, {
      resolve: {
        alias: [
          {
            find: /^@\/(.*)$/,
            replacement: path.resolve(__dirname, "../src/$1"),
          },
        ],
      },
    });
  },
};

module.exports = config;
