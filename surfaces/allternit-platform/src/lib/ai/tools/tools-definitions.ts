import { type UiToolName } from "../types";

// Tool costs in CENTS (external API fees only)
// LLM costs are calculated separately from token usage
export const toolsDefinitions: Record<NonNullable<UiToolName>, ToolDefinition> = {
  getWeather: {
    name: "getWeather",
    description: "Get the weather in a specific location",
    cost: 0, // internal
  },
  createTextDocument: {
    name: "createTextDocument",
    description: "Create a text document",
    cost: 0, // internal
  },
  createCodeDocument: {
    name: "createCodeDocument",
    description: "Create a code document",
    cost: 0, // internal
  },
  createSheetDocument: {
    name: "createSheetDocument",
    description: "Create a spreadsheet",
    cost: 0, // internal
  },
  editTextDocument: {
    name: "editTextDocument",
    description: "Edit a text document",
    cost: 0, // internal
  },
  editCodeDocument: {
    name: "editCodeDocument",
    description: "Edit a code document",
    cost: 0, // internal
  },
  editSheetDocument: {
    name: "editSheetDocument",
    description: "Edit a spreadsheet",
    cost: 0, // internal
  },
  readDocument: {
    name: "readDocument",
    description: "Read the content of a document",
    cost: 0, // internal
  },
  retrieveUrl: {
    name: "retrieveUrl",
    description: "Retrieve information from a URL",
    cost: 0, // internal
  },
  webSearch: {
    name: "webSearch",
    description: "Search the web",
    cost: 5, // Tavily API ~5¢
  },
  codeExecution: {
    name: "codeExecution",
    description: "Execute code in a virtual environment",
    cost: 5, // Vercel Sandbox execution ~5¢
  },
  generateImage: {
    name: "generateImage",
    description: "Generate images from text descriptions",
    cost: 17, // Nano banana pro ~17¢
  },
  deepResearch: {
    name: "deepResearch",
    description: "Research a topic",
    cost: 0, // LLM calls tracked via usage, Tavily calls counted separately
  },
  notebookIngest: {
    name: "notebookIngest",
    description: "Ingest content into a research notebook",
    cost: 0,
  },
  notebookQuery: {
    name: "notebookQuery",
    description: "Query a research notebook with semantic search",
    cost: 0,
  },
  notebookSummarize: {
    name: "notebookSummarize",
    description: "Summarize or transform notebook sources",
    cost: 0,
  },
};

export const allTools = Object.keys(toolsDefinitions);
type ToolDefinition = {
  name: string;
  description: string;
  cost: number;
};
