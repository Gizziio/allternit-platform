import type { OrbState } from "thinking-orbs";

export type { OrbState };

/** Maps a tool part's type (e.g. "tool-Bash") to the thinking-orbs state that best represents it. */
export function getOrbStateForToolType(partType: string): OrbState {
  switch (partType) {
    case "tool-WebSearch":
    case "tool-Grep":
    case "tool-Glob":
    case "tool-NotebookQuery":
      return "searching";
    case "tool-Edit":
    case "tool-Write":
      return "composing";
    case "tool-PlanWrite":
      return "weaving";
    case "tool-TodoWrite":
      return "solving";
    case "tool-Task":
    case "tool-Agent":
      return "connecting";
    case "tool-Thinking":
      return "breathing";
    case "tool-Bash":
      return "working";
    default:
      return "working";
  }
}
