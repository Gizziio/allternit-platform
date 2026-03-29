import type { Meta, StoryObj } from "@storybook/react";
import { SwarmADE } from "./SwarmADE";

const meta: Meta<typeof SwarmADE> = {
  title: "Views/Swarm/SwarmADE",
  component: SwarmADE,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof SwarmADE>;

// Production component with real data
export const Default: Story = {
  args: {},
};
