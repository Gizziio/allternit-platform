"use client";

import React, { memo, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowSquareOut,
  File,
  GlobeHemisphereWest,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { useBrowserStore } from "@/capsules/browser/browser.store";
import { useNav } from "@/nav/useNav";
import {
  inferPreviewTitle,
  isBrowserPreviewToolName,
} from "@/components/ai-elements/browser-preview-utils";
import type {
  ArtifactReplyItem,
  CitationReplyItem,
  FileOpReplyItem,
  Reply,
  ToolCallReplyItem,
} from "@/lib/agents/replies-stream";

interface ReplyProvenancePanelProps {
  reply: Reply;
  branchMeta?: {
    index: number;
    total: number;
  } | null;
  uploadedFiles?: Array<{
    id: string;
    name: string;
    type?: string;
    size?: number;
  }>;
  onClose: () => void;
}

interface SourceRef {
  id: string;
  title: string;
  url?: string;
  snippet?: string;
  via?: string;
}

const PANEL_CARD_STYLE: CSSProperties = {
  border: "1px solid var(--border-subtle)",
  borderRadius: 12,
  padding: "12px 12px 10px",
  background: "var(--surface-panel-muted)",
};

const PANEL_CARD_SELECTED_STYLE: CSSProperties = {
  ...PANEL_CARD_STYLE,
  background:
    "color-mix(in srgb, var(--accent-primary) 12%, var(--surface-panel-muted))",
};

function dedupeSources(items: CitationReplyItem[]): SourceRef[] {
  const seen = new Map<string, SourceRef>();
  for (const item of items) {
    for (const ref of item.items) {
      const key = ref.url ?? `${ref.id}:${ref.title}`;
      if (!seen.has(key)) {
        seen.set(key, {
          id: ref.id,
          title: ref.title,
          url: ref.url,
          snippet: ref.snippet,
        });
      }
    }
  }
  return Array.from(seen.values());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const normalized = new URL(trimmed).toString();
    return /^https?:\/\//i.test(normalized) ? normalized : null;
  } catch {
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return null;
  }
}

function extractUrlsFromText(value: string): string[] {
  const matches = value.match(/\bhttps?:\/\/[^\s)<>"']+/gi) ?? [];
  return matches
    .map((match) => normalizeUrl(match))
    .filter((url): url is string => Boolean(url));
}

function collectUrlCandidates(
  value: unknown,
  candidates: SourceRef[],
  seen: Set<string>,
  via: string,
): void {
  if (typeof value === "string") {
    for (const url of extractUrlsFromText(value)) {
      if (seen.has(url)) {
        continue;
      }
      seen.add(url);
      candidates.push({
        id: `${via}:${url}`,
        title: inferPreviewTitle(url),
        url,
        via,
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collectUrlCandidates(entry, candidates, seen, via));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  const directUrl = typeof value.url === "string" ? normalizeUrl(value.url) : null;
  const directHref = typeof value.href === "string" ? normalizeUrl(value.href) : null;
  const directLink = typeof value.link === "string" ? normalizeUrl(value.link) : null;
  const directUri = typeof value.uri === "string" ? normalizeUrl(value.uri) : null;
  if (directUrl && !seen.has(directUrl)) {
    seen.add(directUrl);
    candidates.push({
      id: `${via}:${directUrl}`,
      title: inferPreviewTitle(
        directUrl,
        typeof value.title === "string"
          ? value.title
          : typeof value.name === "string"
            ? value.name
            : undefined,
      ),
      url: directUrl,
      snippet:
        typeof value.snippet === "string"
          ? value.snippet
          : typeof value.description === "string"
            ? value.description
            : undefined,
      via,
    });
  }
  for (const candidateUrl of [directHref, directLink, directUri]) {
    if (!candidateUrl || seen.has(candidateUrl)) {
      continue;
    }
    seen.add(candidateUrl);
    candidates.push({
      id: `${via}:${candidateUrl}`,
      title: inferPreviewTitle(
        candidateUrl,
        typeof value.title === "string"
          ? value.title
          : typeof value.name === "string"
            ? value.name
            : typeof value.label === "string"
              ? value.label
              : undefined,
      ),
      snippet:
        typeof value.snippet === "string"
          ? value.snippet
          : typeof value.description === "string"
            ? value.description
            : undefined,
      url: candidateUrl,
      via,
    });
  }

  for (const nestedKey of [
    "results",
    "items",
    "sources",
    "documents",
    "citations",
    "pages",
    "links",
    "references",
    "matches",
    "entries",
    "resources",
    "records",
    "output",
    "data",
  ]) {
    if (nestedKey in value) {
      collectUrlCandidates(value[nestedKey], candidates, seen, via);
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (nestedValue !== value.url) {
      collectUrlCandidates(nestedValue, candidates, seen, via);
    }
  }
}

function hasLikelySourceSignal(item: ToolCallReplyItem): boolean {
  return (
    isBrowserPreviewToolName(item.toolName) ||
    /search|browse|browser|find|crawl|web|retrieve|open|visit|fetch|scrape|api|reference|source/i.test(
      item.toolName,
    )
  );
}

function deriveFoundSources(
  toolItems: ToolCallReplyItem[],
  artifactItems: ArtifactReplyItem[],
  citedSources: SourceRef[],
): SourceRef[] {
  const citedUrls = new Set(
    citedSources.map((source) => source.url).filter((url): url is string => Boolean(url)),
  );
  const found: SourceRef[] = [];
  const seen = new Set<string>(citedUrls);

  for (const item of toolItems) {
    if (!hasLikelySourceSignal(item)) {
      continue;
    }

    collectUrlCandidates(item.input, found, seen, item.title || item.toolName);
    collectUrlCandidates(item.output, found, seen, item.title || item.toolName);
    item.progressLines.forEach((line) =>
      collectUrlCandidates(line, found, seen, item.title || item.toolName),
    );
  }

  for (const item of artifactItems) {
    if (!item.url) {
      continue;
    }
    collectUrlCandidates(
      {
        url: item.url,
        title: item.title,
        description: item.artifactType,
      },
      found,
      seen,
      "artifact",
    );
  }

  return found;
}

function formatUrlHost(url?: string): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function CountChip({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        border: "1px solid var(--border-subtle)",
        background: "var(--surface-panel-muted)",
        padding: "6px 10px",
      }}
    >
      <span style={{ fontSize: 11, color: "var(--ui-text-muted)" }}>{label}</span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--ui-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {count}
      </span>
    </div>
  );
}

export const ReplyProvenancePanel = memo(function ReplyProvenancePanel({
  reply,
  branchMeta = null,
  uploadedFiles = [],
  onClose,
}: ReplyProvenancePanelProps) {
  const addBrowserTab = useBrowserStore((state) => state.addTab);
  const dispatch = useNav((state) => state.dispatch);
  const citationItems = reply.items.filter(
    (item): item is CitationReplyItem => item.kind === "citation",
  );
  const toolItems = reply.items.filter(
    (item): item is ToolCallReplyItem => item.kind === "tool_call",
  );
  const artifactItems = reply.items.filter(
    (item): item is ArtifactReplyItem => item.kind === "artifact",
  );
  const fileOpItems = reply.items.filter(
    (item): item is FileOpReplyItem => item.kind === "file_op",
  );

  const citedSources = useMemo(() => dedupeSources(citationItems), [citationItems]);
  const foundSources = useMemo(
    () => deriveFoundSources(toolItems, artifactItems, citedSources),
    [artifactItems, toolItems, citedSources],
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const searchActivity = useMemo(
    () =>
      toolItems.filter((item) =>
        /search|browse|browser|find|crawl|web/i.test(item.toolName),
      ),
    [toolItems],
  );
  const selectedSource =
    citedSources.find((source) => source.id === selectedSourceId) ??
    foundSources.find((source) => source.id === selectedSourceId) ??
    citedSources[0] ??
    foundSources[0] ??
    null;

  const handleOpenSource = (url: string, title?: string) => {
    dispatch({ type: "OPEN_VIEW", viewType: "browserview" });
    addBrowserTab(url, title);
  };

  return (
    <aside
      style={{
        width: 340,
        minWidth: 340,
        maxWidth: 340,
        height: "100%",
        borderLeft: "1px solid var(--shell-divider)",
        background: "linear-gradient(180deg, var(--shell-panel-bg), color-mix(in srgb, var(--shell-panel-bg) 80%, transparent))",
        overflowY: "auto",
        padding: "20px 18px 120px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "sticky",
          top: -20,
          zIndex: 2,
          marginBottom: 18,
          paddingBottom: 14,
          background:
            "linear-gradient(180deg, var(--shell-panel-bg) 0%, color-mix(in srgb, var(--shell-panel-bg) 92%, transparent) 100%)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-secondary)" }}>
              Evidence
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ui-text-primary)", marginTop: 4 }}>
              Reply provenance
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence panel"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              color: "var(--ui-text-muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
          {branchMeta ? (
            <CountChip
              label="Answer"
              count={branchMeta.index}
            />
          ) : null}
          {branchMeta ? (
            <CountChip
              label="Variants"
              count={branchMeta.total}
            />
          ) : null}
          <CountChip label="Cited" count={citedSources.length} />
          <CountChip label="Found" count={foundSources.length} />
          <CountChip label="Search" count={searchActivity.length} />
          <CountChip
            label="Files"
            count={artifactItems.length + fileOpItems.length + uploadedFiles.length}
          />
        </div>
      </div>

      {branchMeta && branchMeta.total > 1 ? (
        <div
          style={{
            ...PANEL_CARD_STYLE,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent-secondary)",
            }}
          >
            Alternate answer
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--ui-text-primary)",
              marginTop: 8,
            }}
          >
            Inspecting answer {branchMeta.index} of {branchMeta.total} for this prompt.
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--ui-text-secondary)",
              lineHeight: 1.5,
              marginTop: 6,
            }}
          >
            Sources, files, and search activity below belong to the currently selected answer variant.
          </div>
        </div>
      ) : null}

      <Section
        title="Cited Sources"
        count={citedSources.length}
        icon={<GlobeHemisphereWest size={14} weight="bold" />}
        emptyLabel="No cited sources on this reply yet."
      >
        {citedSources.map((source, index) => (
          <button
            key={`${source.id}-${source.url ?? index}`}
            type="button"
            onClick={() => setSelectedSourceId(source.id)}
            style={{
              ...(selectedSource?.id === source.id
                ? PANEL_CARD_SELECTED_STYLE
                : PANEL_CARD_STYLE),
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--ui-text-muted)", marginBottom: 6 }}>
              [{index + 1}] Source
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ui-text-primary)" }}>
              {source.title}
            </div>
            {source.snippet ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--ui-text-secondary)", marginTop: 6 }}>
                {source.snippet.length > 140 ? `${source.snippet.slice(0, 140)}...` : source.snippet}
              </div>
            ) : null}
          </button>
        ))}
        {selectedSource ? (
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 14,
              padding: "14px 14px 12px",
              background: "color-mix(in srgb, var(--surface-panel-muted) 84%, transparent)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-secondary)" }}>
              Inspect source
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ui-text-primary)", marginTop: 8 }}>
              {selectedSource.title}
            </div>
            {selectedSource.url ? (
              <div style={{ fontSize: 12, color: "var(--ui-text-muted)", marginTop: 6, wordBreak: "break-all" }}>
                {selectedSource.url}
              </div>
            ) : null}
            {selectedSource.snippet ? (
              <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--ui-text-secondary)", marginTop: 10 }}>
                {selectedSource.snippet}
              </div>
            ) : null}
            {selectedSource.url ? (
              <button
                type="button"
                onClick={() => {
                  if (!selectedSource.url) return;
                  handleOpenSource(selectedSource.url, selectedSource.title);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 12,
                  fontSize: 12,
                  color: "var(--accent-primary)",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <ArrowSquareOut size={12} weight="bold" />
                Open in browser panel
              </button>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section
        title="Found Sources"
        count={foundSources.length}
        icon={<GlobeHemisphereWest size={14} weight="bold" />}
        emptyLabel="No additional source candidates were inferred from tool activity."
      >
        {foundSources.map((source, index) => (
          <button
            key={`${source.id}-${source.url ?? index}`}
            type="button"
            onClick={() => setSelectedSourceId(source.id)}
            style={{
              ...(selectedSource?.id === source.id
                ? PANEL_CARD_SELECTED_STYLE
                : PANEL_CARD_STYLE),
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ui-text-primary)" }}>
                {source.title}
              </div>
              <div style={{ fontSize: 10, color: "var(--ui-text-muted)", textTransform: "uppercase" }}>
                {source.via ?? "tool"}
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--ui-text-muted)", marginTop: 6 }}>
              {formatUrlHost(source.url) ?? source.url ?? "Source candidate"}
            </div>
            {source.snippet ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--ui-text-secondary)", marginTop: 6 }}>
                {source.snippet.length > 140 ? `${source.snippet.slice(0, 140)}...` : source.snippet}
              </div>
            ) : null}
          </button>
        ))}
      </Section>

      <Section
        title="Search Activity"
        count={searchActivity.length}
        icon={<MagnifyingGlass size={14} weight="bold" />}
        emptyLabel="No search activity recorded on this reply."
      >
        {searchActivity.map((item) => (
          <div
            key={item.id}
            style={{
              ...PANEL_CARD_STYLE,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ui-text-primary)" }}>
              {item.title || item.toolName}
            </div>
            <div style={{ fontSize: 11, color: "var(--ui-text-muted)", marginTop: 4 }}>
              {item.state === "queued" ? "Queued" : item.state === "running" ? "Running" : item.state === "error" ? "Failed" : "Done"}
            </div>
            {item.progressLines.length > 0 ? (
              <div style={{ fontSize: 12, lineHeight: 1.45, color: "var(--ui-text-secondary)", marginTop: 6 }}>
                {item.progressLines[item.progressLines.length - 1]}
              </div>
            ) : null}
            {typeof item.output === "string" && item.output.trim() ? (
              <div style={{ fontSize: 11, lineHeight: 1.45, color: "var(--ui-text-muted)", marginTop: 6 }}>
                {item.output.length > 180 ? `${item.output.slice(0, 180)}...` : item.output}
              </div>
            ) : null}
          </div>
        ))}
      </Section>

      <Section
        title="Files & Outputs"
        count={artifactItems.length + fileOpItems.length}
        icon={<File size={14} weight="bold" />}
        emptyLabel="No file or output provenance on this reply."
      >
        {artifactItems.map((item) => (
          <div
            key={item.id}
            style={{
              ...PANEL_CARD_STYLE,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ui-text-primary)" }}>
              {item.title}
            </div>
            <div style={{ fontSize: 11, color: "var(--ui-text-muted)", marginTop: 4 }}>
              {item.artifactType}
            </div>
          </div>
        ))}
        {fileOpItems.map((item) => (
          <div
            key={item.id}
            style={{
              ...PANEL_CARD_STYLE,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ui-text-primary)", textTransform: "capitalize" }}>
              {item.operation}
            </div>
            <div style={{ fontSize: 12, color: "var(--ui-text-secondary)", marginTop: 4 }}>
              {item.path}
            </div>
          </div>
        ))}
      </Section>

      <Section
        title="Uploaded Files"
        count={uploadedFiles.length}
        icon={<File size={14} weight="bold" />}
        emptyLabel="No project files are linked to this conversation."
      >
        {uploadedFiles.map((file) => (
          <div
            key={file.id}
            style={{
              ...PANEL_CARD_STYLE,
              padding: "10px 12px",
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ui-text-primary)" }}>
              {file.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--ui-text-muted)", marginTop: 4 }}>
              {formatFileMeta(file.type, file.size)}
            </div>
          </div>
        ))}
      </Section>
    </aside>
  );
});

function formatFileMeta(type?: string, size?: number): string {
  const parts: string[] = [];
  if (type) {
    parts.push(type);
  }
  if (typeof size === "number" && Number.isFinite(size)) {
    if (size < 1024) parts.push(`${size} B`);
    else if (size < 1024 * 1024) parts.push(`${Math.round(size / 1024)} KB`);
    else parts.push(`${(size / (1024 * 1024)).toFixed(1)} MB`);
  }
  return parts.join(" • ") || "Attached file";
}

function Section({
  title,
  count,
  icon,
  emptyLabel,
  children,
}: {
  title: string;
  count: number;
  icon: React.ReactNode;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  const childArray = React.Children.toArray(children);
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ color: "var(--accent-primary)", display: "flex", alignItems: "center" }}>{icon}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ui-text-primary)" }}>{title}</div>
        <div
          style={{
            fontSize: 11,
            color: "var(--ui-text-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </div>
      </div>
      {childArray.length > 0 ? (
        childArray
      ) : (
        <div style={{ fontSize: 12, color: "var(--ui-text-muted)", padding: "6px 0" }}>{emptyLabel}</div>
      )}
    </section>
  );
}
