import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import type { SurfacePalette } from "./context-strip.types";

export function formatSurfaceLabel(surface: AgentModeSurface): string {
  switch (surface) {
    case "chat":
      return "Chat";
    case "cowork":
      return "Cowork";
    case "code":
      return "Code";
    case "browser":
      return "Browser";
    default:
      return "Agent";
  }
}

export function getSurfacePalette(surface: AgentModeSurface): SurfacePalette {
  switch (surface) {
    case "browser":
      return {
        accent: "#69A8C8",
        glow: "rgba(105,168,200,0.26)",
        soft: "rgba(105,168,200,0.14)",
        border: "rgba(105,168,200,0.16)",
      };
    case "code":
      return {
        accent: "#79C47C",
        glow: "rgba(121,196,124,0.28)",
        soft: "rgba(121,196,124,0.14)",
        border: "rgba(121,196,124,0.16)",
      };
    case "cowork":
      return {
        accent: "#A78BFA",
        glow: "rgba(167,139,250,0.28)",
        soft: "rgba(167,139,250,0.14)",
        border: "rgba(167,139,250,0.16)",
      };
    case "chat":
    default:
      return {
        accent: "#D4956A",
        glow: "color-mix(in srgb, var(--accent-primary) 28%, transparent)",
        soft: "color-mix(in srgb, var(--accent-primary) 14%, transparent)",
        border: "color-mix(in srgb, var(--accent-primary) 14%, transparent)",
      };
  }
}

export function compactWorkspaceScope(workspaceScope?: string): string {
  if (!workspaceScope) {
    return "Session scoped workspace";
  }

  if (workspaceScope.length <= 44) {
    return workspaceScope;
  }

  const segments = workspaceScope.split("/").filter(Boolean);
  if (segments.length <= 2) {
    return workspaceScope;
  }

  return `.../${segments.slice(-2).join("/")}`;
}
