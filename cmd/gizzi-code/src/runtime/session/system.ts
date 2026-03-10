import { Ripgrep } from "@/shared/file/ripgrep"
import path from "path"

import { Instance } from "@/runtime/context/project/instance"
import { Filesystem } from "@/shared/util/filesystem"

import PROMPT_ANTHROPIC from "@/runtime/session/prompt/anthropic.txt"
import PROMPT_ANTHROPIC_WITHOUT_TODO from "@/runtime/session/prompt/qwen.txt"
import PROMPT_BEAST from "@/runtime/session/prompt/beast.txt"
import PROMPT_GEMINI from "@/runtime/session/prompt/gemini.txt"

import PROMPT_CODEX from "@/runtime/session/prompt/codex_header.txt"
import PROMPT_TRINITY from "@/runtime/session/prompt/trinity.txt"
import type { Provider } from "@/runtime/providers/provider"

export namespace SystemPrompt {
  export function instructions() {
    return PROMPT_CODEX.trim()
  }

  export function provider(model: Provider.Model) {
    if (model.api.id.includes("gpt-5")) return [PROMPT_CODEX]
    if (model.api.id.includes("gpt-") || model.api.id.includes("o1") || model.api.id.includes("o3"))
      return [PROMPT_BEAST]
    if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
    if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
    if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
    return [PROMPT_ANTHROPIC_WITHOUT_TODO]
  }

  async function memoryPrompt(): Promise<string> {
    const memoryDir = path.join(Instance.directory, ".gizzi", "L1-COGNITIVE", "memory")
    const exists = await Filesystem.exists(memoryDir)
    return [
      `# auto memory`,
      ``,
      `You have a persistent auto memory directory at \`${memoryDir}/\`. Its contents persist across conversations.`,
      `Memory files from this directory AND from the global per-project store are both loaded into context.`,
      ``,
      exists ? `The directory exists and may contain MEMORY.md and topic files.` : `The directory does not exist yet. Create it when you need to save memories.`,
      ``,
      `## How to save memories:`,
      `- Organize memory semantically by topic, not chronologically`,
      `- Use the write tool to update your memory files`,
      `- \`MEMORY.md\` is always loaded into your conversation context — lines after 200 will be truncated, so keep it concise`,
      `- Create separate topic files (e.g., \`debugging.md\`, \`patterns.md\`) for detailed notes and link to them from MEMORY.md`,
      `- Update or remove memories that turn out to be wrong or outdated`,
      `- Do not write duplicate memories. First check if there is an existing memory you can update before writing a new one.`,
      ``,
      `## What to save:`,
      `- Stable patterns and conventions confirmed across multiple interactions`,
      `- Key architectural decisions, important file paths, and project structure`,
      `- User preferences for workflow, tools, and communication style`,
      `- Solutions to recurring problems and debugging insights`,
      ``,
      `## What NOT to save:`,
      `- Session-specific context (current task details, in-progress work, temporary state)`,
      `- Information that might be incomplete — verify against project docs before writing`,
      `- Speculative or unverified conclusions from reading a single file`,
      ``,
      `## Explicit user requests:`,
      `- When the user asks you to remember something across sessions, save it`,
      `- When the user asks to forget or stop remembering something, find and remove the relevant entries`,
      `- When the user corrects you on something you stated from memory, update or remove the incorrect entry`,
    ].join("\n")
  }

  export async function environment(model: Provider.Model) {
    const project = Instance.project
    return [
      [
        `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        `</env>`,
        `<directories>`,
        `  ${
          project.vcs === "git" && false
            ? await Ripgrep.tree({
                cwd: Instance.directory,
                limit: 50,
              })
            : ""
        }`,
        `</directories>`,
      ].join("\n"),
      await memoryPrompt(),
    ]
  }
}
