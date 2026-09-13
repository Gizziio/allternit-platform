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
  // Amber-only law (2026-09-11): every surface resolves to the amber accent;
  // `surface` is kept in the signature for call-site compatibility.
  void surface;
  return {
    accent: "var(--accent-primary)",
    glow: "color-mix(in srgb, var(--accent-primary) 28%, transparent)",
    soft: "color-mix(in srgb, var(--accent-primary) 14%, transparent)",
    border: "color-mix(in srgb, var(--accent-primary) 14%, transparent)",
  };
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
