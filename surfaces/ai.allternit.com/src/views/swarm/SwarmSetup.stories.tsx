import type { Meta, StoryObj } from "@storybook/react";
import { SwarmSetup } from "./components/SwarmSetup";

const meta: Meta<typeof SwarmSetup> = {
  title: "Views/Swarm/SwarmSetup",
  component: SwarmSetup,
  parameters: {
    layout: "fullscreen",
    backgrounds: {
      default: "dark",
      values: [{ name: "dark", value: "#0a0908" }],
    },
  },
};

export default meta;
type Story = StoryObj<typeof SwarmSetup>;

export const Default: Story = {
  args: {
    onLaunched: (id: string) => console.log("Launched execution:", id),
  },
};
