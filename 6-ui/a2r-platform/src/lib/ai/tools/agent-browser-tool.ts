import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runAgentBrowserCommand(command: string) {
  try {
    const { stdout, stderr } = await execAsync(`agent-browser ${command}`);
    if (stderr) {
      console.error(`agent-browser stderr: ${stderr}`);
      // Decide if stderr should be thrown as an error or just logged
    }
    return stdout;
  } catch (error) {
    console.error(`Failed to execute agent-browser command: ${command}`, error);
    throw error;
  }
}

const agentBrowserSchema = z.object({
  action: z.enum(["open", "click", "fill", "snapshot", "get", "screenshot", "close"]),
  url: z.string().optional().describe("The URL to open. Required for 'open' action."),
  selector: z.string().optional().describe("The selector or ref for the element to interact with. Required for 'click', 'fill', and 'get' actions."),
  value: z.string().optional().describe("The value to fill in a form element. Required for 'fill' action."),
  property: z.string().optional().describe("The property to get from an element, e.g., 'text'. Required for 'get' action."),
  filename: z.string().optional().describe("The filename for the screenshot. Required for 'screenshot' action."),
});

type AgentBrowserParams = z.infer<typeof agentBrowserSchema>;

export const agentBrowserTool = tool({
  description: "A tool to interact with a web browser. Use it to open pages, click elements, fill forms, and extract information.",
  inputSchema: agentBrowserSchema,
  execute: async ({ action, url, selector, value, property, filename }: AgentBrowserParams) => {
    switch (action) {
      case "open":
        if (!url) throw new Error("URL is required for 'open' action.");
        return await runAgentBrowserCommand(`open ${url}`);
      case "snapshot":
        return await runAgentBrowserCommand("snapshot");
      case "click":
        if (!selector) throw new Error("Selector is required for 'click' action.");
        return await runAgentBrowserCommand(`click "${selector}"`);
      case "fill":
        if (!selector || value === undefined) throw new Error("Selector and value are required for 'fill' action.");
        return await runAgentBrowserCommand(`fill "${selector}" "${value}"`);
      case "get":
        if (!selector || !property) throw new Error("Selector and property are required for 'get' action.");
        return await runAgentBrowserCommand(`get ${property} "${selector}"`);
      case "screenshot":
        if (!filename) throw new Error("Filename is required for 'screenshot' action.");
        return await runAgentBrowserCommand(`screenshot ${filename}`);
      case "close":
        return await runAgentBrowserCommand("close");
      default:
        throw new Error(`Unsupported agent-browser action: ${action}`);
    }
  },
});
