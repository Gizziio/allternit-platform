"use client";

import React from "react";
import type { CodeCanvasTile } from "./CodeModeStore";
import { CodeCanvasTileSession } from "@/components/canvas/CodeCanvasTileSession";
import { CodeCanvasTilePreview } from "@/components/canvas/CodeCanvasTilePreview";
import { CodeCanvasTileDiff } from "@/components/canvas/CodeCanvasTileDiff";
import { CodeCanvasTileTerminal } from "@/components/canvas/CodeCanvasTileTerminal";
import { CodeCanvasTileNotes } from "@/components/canvas/CodeCanvasTileNotes";
import { CodeCanvasTileKnowledge } from "@/components/canvas/CodeCanvasTileKnowledge";
import { CodeCanvasTileKnowledgeGraph } from "@/components/canvas/CodeCanvasTileKnowledgeGraph";

export function CodeCanvasTileContent({
  tile,
  workspacePath,
}: {
  tile: CodeCanvasTile;
  workspacePath?: string;
}) {
  switch (tile.type) {
    case "session":
      if (!tile.sessionId) {
        return (
          <CenteredMessage>
            No session linked
          </CenteredMessage>
        );
      }
      return <CodeCanvasTileSession sessionId={tile.sessionId} workspacePath={workspacePath} />;
    case "preview":
      return <CodeCanvasTilePreview url={tile.url} filePath={tile.filePath} />;
    case "diff":
      return <CodeCanvasTileDiff diffText={tile.diffText} filePath={tile.filePath} />;
    case "terminal":
      return <CodeCanvasTileTerminal workspacePath={workspacePath} />;
    case "notes":
      return <CodeCanvasTileNotes />;
    case "knowledge":
      return workspacePath ? <CodeCanvasTileKnowledge workspacePath={workspacePath} /> : <CenteredMessage>No workspace linked</CenteredMessage>;
    case "knowledge-graph":
      return <CodeCanvasTileKnowledgeGraph />;
    default:
      return <CenteredMessage>Unknown tile type: {tile.type}</CenteredMessage>;
  }
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-muted)",
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}
