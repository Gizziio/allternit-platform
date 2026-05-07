/**
 * AI Models Registry
 * 
 * This file contains the complete list of supported AI models including:
 * - AI SDK compatible models (OpenAI, Anthropic, Google, etc.)
 * - OpenClaw CLI subprocess models (claude-code, codex, aider, etc.)
 * - Local models (Ollama)
 */

import type { ModelData } from "./types";

// SVG Logos (embedded as data URIs for reliability)
const LOGOS = {
  openai: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.896zm16.597 3.855-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>`,
  
  anthropic: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.368-3.6h6.624l1.368 3.6h3.744L8.016 3.541zm-.264 10.656 1.944-5.112 1.944 5.112z"/></svg>`,
  
  gemini: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>`,
  
  mistral: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  
  ollama: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>`,
  
  deepseek: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 22h20L12 2zm0 3.5L18.5 20h-13L12 5.5z"/></svg>`,
  
  qwen: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9H10.07L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/></svg>`,
  
  aider: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>`,
  
  goose: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
  
  cursor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/></svg>`,
  
  terminal: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V6h16v12H4zM7.5 9l2.5 2.5L7.5 14l-1-1 1.5-1.5L6.5 10l1-1zm4.5 5h4v1h-4v-1z"/></svg>`,
};

// AI SDK Models (API-based)
const AI_SDK_MODELS: ModelData[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    modelId: "gpt-4o",
    runtimeType: "api",
    description: "Most capable multimodal model",
    logo: LOGOS.openai,
    features: { vision: true, fileUpload: true, webSearch: true, reasoning: false, codeExecution: false },
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    runtimeType: "api",
    description: "Fast and affordable",
    logo: LOGOS.openai,
    features: { vision: true, fileUpload: true, webSearch: true, reasoning: false, codeExecution: false },
  },
  {
    id: "o1",
    name: "o1",
    provider: "openai",
    modelId: "o1",
    runtimeType: "api",
    description: "Advanced reasoning model",
    logo: LOGOS.openai,
    features: { vision: false, fileUpload: true, webSearch: false, reasoning: true, codeExecution: false },
  },
  {
    id: "o1-mini",
    name: "o1 Mini",
    provider: "openai",
    modelId: "o1-mini",
    runtimeType: "api",
    description: "Fast reasoning model",
    logo: LOGOS.openai,
    features: { vision: false, fileUpload: true, webSearch: false, reasoning: true, codeExecution: false },
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    modelId: "claude-3-5-sonnet-20241022",
    runtimeType: "api",
    description: "Excellent for coding",
    logo: LOGOS.anthropic,
    features: { vision: true, fileUpload: true, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "claude-3-5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "anthropic",
    modelId: "claude-3-5-haiku-20241022",
    runtimeType: "api",
    description: "Fast and efficient",
    logo: LOGOS.anthropic,
    features: { vision: true, fileUpload: true, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "claude-3-opus",
    name: "Claude 3 Opus",
    provider: "anthropic",
    modelId: "claude-3-opus-20240229",
    runtimeType: "api",
    description: "Most capable Claude model",
    logo: LOGOS.anthropic,
    features: { vision: true, fileUpload: true, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    modelId: "gemini-1.5-pro",
    runtimeType: "api",
    description: "Google's most capable model",
    logo: LOGOS.gemini,
    features: { vision: true, fileUpload: true, webSearch: true, reasoning: false, codeExecution: false },
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    modelId: "gemini-1.5-flash",
    runtimeType: "api",
    description: "Fast and versatile",
    logo: LOGOS.gemini,
    features: { vision: true, fileUpload: true, webSearch: true, reasoning: false, codeExecution: false },
  },
  {
    id: "mistral-large",
    name: "Mistral Large",
    provider: "mistral",
    modelId: "mistral-large-latest",
    runtimeType: "api",
    description: "Most capable Mistral model",
    logo: LOGOS.mistral,
    features: { vision: false, fileUpload: true, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    modelId: "deepseek-reasoner",
    runtimeType: "api",
    description: "Open reasoning model",
    logo: LOGOS.deepseek,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: true, codeExecution: false },
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "deepseek",
    modelId: "deepseek-chat",
    runtimeType: "api",
    description: "General purpose chat",
    logo: LOGOS.deepseek,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "big-pickle",
    name: "Big Pickle (Free)",
    provider: "opencode",
    modelId: "big-pickle",
    runtimeType: "api",
    description: "Free zen model via OpenCode",
    logo: LOGOS.goose,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "minimax-m2.5-free",
    name: "MiniMax M2.5 (Free)",
    provider: "opencode",
    modelId: "minimax-m2.5-free",
    runtimeType: "api",
    description: "Free MiniMax model via OpenCode zen",
    logo: LOGOS.goose,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: false },
  },
];

// OpenClaw CLI Subprocess Models
const OPENCLAW_CLI_MODELS: ModelData[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    provider: "anthropic",
    runtimeType: "cli",
    command: "claude",
    args: ["--stream"],
    description: "Anthropic's official CLI agent",
    logo: LOGOS.anthropic,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: true },
  },
  {
    id: "codex",
    name: "Codex CLI",
    provider: "openai",
    runtimeType: "cli",
    command: "codex",
    args: ["exec", "--yolo", "-"], // "-" reads prompt from stdin
    description: "OpenAI's official CLI agent",
    logo: LOGOS.openai,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: true },
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    provider: "google",
    runtimeType: "cli",
    command: "gemini",
    args: ["--output-format", "stream-json", "--yolo"],
    description: "Google's official CLI agent",
    logo: LOGOS.gemini,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: true },
  },
  {
    id: "kimi-cli",
    name: "Kimi CLI",
    provider: "moonshot",
    runtimeType: "cli",
    command: "kimi",
    args: ["--yolo"],
    description: "Moonshot's official CLI agent",
    logo: LOGOS.qwen,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: true },
  },
  {
    id: "aider",
    name: "Aider",
    provider: "aider",
    runtimeType: "cli",
    command: "aider",
    args: ["--stream"],
    description: "AI pair programming in your terminal",
    logo: LOGOS.aider,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: true },
  },
  {
    id: "goose",
    name: "Goose",
    provider: "block",
    runtimeType: "cli",
    command: "goose",
    args: [],
    description: "Open source AI agent by Block",
    logo: LOGOS.goose,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: true },
  },
];

// The default model downloaded during "Add Local Brain" onboarding
export const LOCAL_BRAIN_MODEL_ID = "local-brain";
export const LOCAL_BRAIN_OLLAMA_ID = "llama3.2:3b";

// Local Models (Ollama)
const LOCAL_MODELS: ModelData[] = [
  {
    id: LOCAL_BRAIN_MODEL_ID,
    name: "Local Brain",
    provider: "ollama",
    modelId: LOCAL_BRAIN_OLLAMA_ID,
    runtimeType: "local",
    description: "Offline · private · works on any machine",
    logo: LOGOS.ollama,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "ollama-llama3.3",
    name: "Llama 3.3 (Local)",
    provider: "ollama",
    modelId: "llama3.3",
    runtimeType: "local",
    description: "Meta's latest open model (local)",
    logo: LOGOS.ollama,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "ollama-qwen2.5",
    name: "Qwen 2.5 (Local)",
    provider: "ollama",
    modelId: "qwen2.5",
    runtimeType: "local",
    description: "Alibaba's Qwen model (local)",
    logo: LOGOS.qwen,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "ollama-phi4",
    name: "Phi-4 (Local)",
    provider: "ollama",
    modelId: "phi4",
    runtimeType: "local",
    description: "Microsoft's Phi-4 model (local)",
    logo: LOGOS.ollama,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: false },
  },
  {
    id: "ollama-deepseek-coder",
    name: "DeepSeek Coder (Local)",
    provider: "ollama",
    modelId: "deepseek-coder",
    runtimeType: "local",
    description: "DeepSeek Coder V2 (local)",
    logo: LOGOS.deepseek,
    features: { vision: false, fileUpload: false, webSearch: false, reasoning: false, codeExecution: true },
  },
  {
    id: "ollama-llava",
    name: "LLaVA (Local)",
    provider: "ollama",
    modelId: "llava",
    runtimeType: "local",
    description: "Vision-capable local model",
    logo: LOGOS.ollama,
    features: { vision: true, fileUpload: false, webSearch: false, reasoning: false, codeExecution: false },
  },
];

// Combine all models
export const ALL_MODELS: ModelData[] = [
  ...AI_SDK_MODELS,
  ...OPENCLAW_CLI_MODELS,
  ...LOCAL_MODELS,
];

// Default model - Using free "zen" Big Pickle model from Terminal Server
export const DEFAULT_MODEL = "kimi/kimi-for-coding";

// Model groups for UI organization
export const MODEL_GROUPS = [
  { title: "Cloud Models", models: AI_SDK_MODELS },
  { title: "CLI Agents", models: OPENCLAW_CLI_MODELS },
  { title: "Local Brain", models: LOCAL_MODELS },
];

// Helper functions
export function getModelById(id: string): ModelData | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}

export function getModelsByRuntimeType(type: ModelData["runtimeType"]): ModelData[] {
  return ALL_MODELS.filter((m) => m.runtimeType === type);
}

export function getDefaultModel(): ModelData {
  return getModelById(DEFAULT_MODEL) || ALL_MODELS[0];
}

// Fetch models - async version for server-side usage
export async function fetchModels(): Promise<ModelData[]> {
  // In a real implementation, this would fetch from an API
  // For now, return the static list
  return ALL_MODELS;
}
