import React, { useEffect, useRef, useState } from "react";
import { Cpu, FileText, FolderSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { filesApi } from "@/lib/agents/files-api";
import type { SurfacePalette, FileNode } from "./context-strip.types";
import { MetaCard } from "./MetaCard";

interface WorkspaceDrawerProps {
  workspaceScope?: string;
  canvasCount: number;
  tags: string[];
  palette: SurfacePalette;
}

export function WorkspaceDrawer({ workspaceScope, canvasCount, tags, palette }: WorkspaceDrawerProps) {
  const [activeTab, setActiveTab] = useState<"files" | "canvases" | "info">("files");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const fetchStarted = useRef(false);

  // Fetch files when workspace tab is opened
  useEffect(() => {
    if (activeTab === "files" && fileTree.length === 0 && !fetchStarted.current) {
      fetchStarted.current = true;
      setIsLoadingFiles(true);
      filesApi.listDirectory({ path: workspaceScope || '.' })
        .then((entries) => {
          const items = entries.entries ?? [];
          const toNode = (entry: (typeof items)[number]): FileNode => ({
            name: entry.name,
            type: entry.type === 'directory' ? 'directory' : 'file',
          });
          setFileTree(items.map(toNode));
        })
        .catch(() => {})
        .finally(() => setIsLoadingFiles(false));
    }
  }, [activeTab, fileTree.length, workspaceScope]);

  return (
    <div className="flex flex-col gap-3">
      {/* Tab Navigation */}
      <div 
        className="flex gap-2 border-b border-solid border-[var(--palette-border)] pb-2"
        style={{ '--palette-border': palette.border } as React.CSSProperties}
      >
        <WorkspaceTab
          active={activeTab === "files"}
          label="Files"
          icon={<FolderSimple size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("files")}
        />
        <WorkspaceTab
          active={activeTab === "canvases"}
          label={`Canvases (${canvasCount})`}
          icon={<FileText size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("canvases")}
        />
        <WorkspaceTab
          active={activeTab === "info"}
          label="Info"
          icon={<Cpu size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("info")}
        />
      </div>

      {/* Tab Content */}
      {activeTab === "files" && (
        <FileBrowser
          fileTree={fileTree}
          isLoading={isLoadingFiles}
          workspaceScope={workspaceScope}
          palette={palette}
        />
      )}

      {activeTab === "canvases" && (
        <CanvasesView canvasCount={canvasCount} palette={palette} />
      )}

      {activeTab === "info" && (
        <WorkspaceInfo
          workspaceScope={workspaceScope}
          tags={tags}
          palette={palette}
        />
      )}
    </div>
  );
}

function WorkspaceTab({
  active,
  label,
  icon,
  palette,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  palette: SurfacePalette;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-none text-[12px] font-bold cursor-pointer transition-all",
        active ? "bg-[var(--palette-soft)] text-[var(--palette-accent)]" : "bg-transparent text-[#a8998c] hover:bg-[var(--surface-hover)]"
      )}
      style={active ? {
        '--palette-soft': palette.soft,
        '--palette-accent': palette.accent,
      } as React.CSSProperties : {}}
    >
      {icon}
      {label}
    </button>
  );
}

function FileBrowser({
  fileTree,
  isLoading,
  workspaceScope,
  palette,
}: {
  fileTree: FileNode[];
  isLoading: boolean;
  workspaceScope?: string;
  palette: SurfacePalette;
}) {
  if (isLoading) {
    return (
      <div className="p-5 text-center text-[#a8998c]">
        <div className="text-[13px]">Loading workspace files...</div>
      </div>
    );
  }

  if (!workspaceScope) {
    return (
      <div
        className="p-4 rounded-xl bg-[rgba(16,12,10,0.24)] border border-solid border-[var(--palette-border)] text-center"
        style={{ '--palette-border': palette.border } as React.CSSProperties}
      >
        <FolderSimple size={24} className="mx-auto mb-2 text-[var(--palette-accent)]"
          style={{ color: palette.accent }}
        />
        <div className="text-[12px] text-[#b3a395] leading-relaxed">
          No workspace scope configured. This session uses a default scoped workspace.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 mb-2.5 p-[8px_10px] bg-[var(--surface-hover)] rounded-lg text-[12px] text-[#a8998c] font-mono overflow-hidden text-ellipsis whitespace-nowrap"
      >
        <FolderSimple size={12} />
        {workspaceScope}
      </div>

      {fileTree.length === 0 ? (
        <div className="text-center p-5 text-[#7a6b5d] text-[12px]">
          No files found in workspace
        </div>
      ) : (
        <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
          {fileTree.map((node, index) => (
            <FileNodeItem key={`${node.type}-${node.name}-${index}`} node={node} depth={0} palette={palette} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileNodeItem({
  node,
  depth,
  palette,
}: {
  node: FileNode;
  depth: number;
  palette: SurfacePalette;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDirectory = node.type === "directory";

  return (
    <div>
      <button
        type="button"
        onClick={() => isDirectory && setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-1.5 py-1 px-2 border-none bg-transparent rounded-md text-left text-[12px] transition-colors",
          isDirectory ? "cursor-pointer" : "cursor-default"
        )}
        style={{ paddingLeft: `calc(8px + var(--depth-padding) * 16px)`, '--depth-padding': depth } as React.CSSProperties}
        onMouseEnter={(e) => {
          e.currentTarget.classList.add("bg-[var(--surface-hover)]");
        }}
        onMouseLeave={(e) => {
          e.currentTarget.classList.remove("bg-[var(--surface-hover)]");
        }}
      >
        {isDirectory ? (
          <span className="text-[var(--palette-accent)] text-[12px]"
            style={{ '--palette-accent': palette.accent } as React.CSSProperties}
          >{expanded ? "▼" : "▶"}</span>
        ) : (
          <span className="text-[#7a6b5d] text-[12px]">•</span>
        )}
        <span className={cn(isDirectory ? "text-[var(--palette-accent)]" : "text-[#d1c3b4]")}
          style={isDirectory ? { '--palette-accent': palette.accent } as React.CSSProperties : {}}
        >{node.name}</span>
      </button>

      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileNodeItem key={`${child.type}-${child.name}-${index}`} node={child} depth={depth + 1} palette={palette} />
          ))}
        </div>
      )}
    </div>
  );
}

function CanvasesView({ canvasCount, palette }: { canvasCount: number; palette: SurfacePalette }) {
  return (
    <div>
      {canvasCount === 0 ? (
        <div
          className="p-4 rounded-xl bg-[rgba(16,12,10,0.24)] border border-solid border-[var(--palette-border)] text-center"
          style={{ '--palette-border': palette.border, '--palette-accent': palette.accent } as React.CSSProperties}
        >
          <FileText size={24} className="mx-auto mb-2 text-[var(--palette-accent)]" />
          <div className="text-[12px] text-[#b3a395] leading-relaxed">
            No canvases attached to this session yet. Canvases will appear here when created.
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {Array.from({ length: canvasCount }).map((_, i) => (
            <div
              key={`canvas-${i}`}
              className="flex items-center gap-2 p-2.5 rounded-[10px] bg-[rgba(16,12,10,0.24)] border border-solid border-[var(--palette-border)]"
              style={{ '--palette-border': palette.border, '--palette-accent': palette.accent } as React.CSSProperties}
            >
              <FileText size={16} className="text-[var(--palette-accent)]" />
              <div className="flex-1">
                <div className="text-[12px] text-[#f6eee7]">Canvas {i + 1}</div>
                <div className="text-[12px] text-[#7a6b5d]">Session artifact</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceInfo({
  workspaceScope,
  tags,
  palette,
}: {
  workspaceScope?: string;
  tags: string[];
  palette: SurfacePalette;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <MetaCard
        accent={palette.accent}
        label="Workspace Path"
        value={workspaceScope || "Session scoped (no explicit path)"}
      />
      <div
        className="rounded-[14px] border border-solid border-[var(--surface-hover)] bg-[rgba(16,12,10,0.24)] p-[12px_12px_11px]"
      >
        <div
          className="text-[12px] font-extrabold text-[var(--palette-accent)] uppercase tracking-[0.08em] mb-2"
          style={{ '--palette-accent': palette.accent } as React.CSSProperties}
        >
          Tags
        </div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-[var(--palette-soft)] text-[var(--palette-accent)] text-[12px] font-semibold"
                style={{
                  '--palette-soft': palette.soft,
                  '--palette-accent': palette.accent,
                } as React.CSSProperties}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[12px] text-[#7a6b5d]">No tags</div>
        )}
      </div>
    </div>
  );
}
