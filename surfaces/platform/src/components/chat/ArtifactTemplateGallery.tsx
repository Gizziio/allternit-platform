"use client";

import React, { useState, useCallback } from "react";
import {
  GameController,
  Wrench,
  ChartBar,
  Sparkle,
  Graph,
  Layout,
  Timer,
  ArrowSquareOut,
  MagicWand,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  ARTIFACT_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type ArtifactTemplate,
  type ArtifactCategory,
} from "@/lib/ai/tools/templates/artifact-templates";

// ============================================================================
// Types
// ============================================================================

interface ArtifactTemplateGalleryProps {
  /**
   * Called when the user clicks "Open" — parent should push an ArtifactUIPart
   * directly into the message list without an LLM call.
   */
  onOpenDirect: (template: ArtifactTemplate) => void;
  /**
   * Called when the user clicks "Remix" — parent should submit the prompt
   * through the chat input, triggering the generateWebArtifact tool.
   */
  onSendPrompt: (prompt: string) => void;
  className?: string;
}

// ============================================================================
// Category metadata
// ============================================================================

const CATEGORY_META: Record<ArtifactCategory, { label: string; icon: React.ReactNode }> = {
  game:         { label: "Games",       icon: <GameController size={14} weight="bold" /> },
  tool:         { label: "Tools",       icon: <Wrench size={14} weight="bold" /> },
  chart:        { label: "Charts",      icon: <ChartBar size={14} weight="bold" /> },
  animation:    { label: "Animation",   icon: <Sparkle size={14} weight="bold" /> },
  diagram:      { label: "Diagrams",    icon: <Graph size={14} weight="bold" /> },
  ui:           { label: "UI",          icon: <Layout size={14} weight="bold" /> },
  productivity: { label: "Productivity",icon: <Timer size={14} weight="bold" /> },
};

const KIND_BADGE: Record<string, { label: string; className: string }> = {
  html:    { label: "HTML",    className: "bg-orange-500/15 text-orange-300 border-orange-500/20" },
  svg:     { label: "SVG",     className: "bg-green-500/15  text-green-300  border-green-500/20" },
  mermaid: { label: "Diagram", className: "bg-blue-500/15   text-blue-300   border-blue-500/20" },
  jsx:     { label: "JSX",     className: "bg-cyan-500/15   text-cyan-300   border-cyan-500/20" },
};

// ============================================================================
// Template card
// ============================================================================

function TemplateCard({
  template,
  onOpenDirect,
  onSendPrompt,
}: {
  template: ArtifactTemplate;
  onOpenDirect: (t: ArtifactTemplate) => void;
  onSendPrompt: (prompt: string) => void;
}) {
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const [hovering, setHovering] = useState(false);
  const badge = KIND_BADGE[template.kind];

  const handleOpen = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onOpenDirect(template); },
    [onOpenDirect, template]
  );

  const handleRemix = useCallback(
    (e: React.MouseEvent) => { e.stopPropagation(); onSendPrompt(template.prompt); },
    [onSendPrompt, template.prompt]
  );

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.03]",
        "transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.05]",
        "overflow-hidden cursor-pointer"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handleOpen}
    >
      {/* Thumbnail area */}
      <div className="relative h-36 bg-zinc-900/60 overflow-hidden flex-shrink-0">
        {template.kind === "html" && (
          <>
            <iframe
              srcDoc={template.content}
              className={cn(
                "absolute inset-0 w-full h-full border-0 pointer-events-none transition-opacity duration-300",
                previewLoaded ? "opacity-100" : "opacity-0"
              )}
              sandbox="allow-scripts"
              style={{ transform: "scale(0.5)", transformOrigin: "top left", width: "200%", height: "200%" }}
              onLoad={() => setPreviewLoaded(true)}
              title={template.title}
            />
            {!previewLoaded && <ThumbnailPlaceholder template={template} />}
          </>
        )}
        {template.kind !== "html" && <ThumbnailPlaceholder template={template} />}

        {/* Hover overlay */}
        <div className={cn(
          "absolute inset-0 bg-black/60 flex items-center justify-center gap-2",
          "transition-opacity duration-150",
          hovering ? "opacity-100" : "opacity-0"
        )}>
          <ActionButton icon={<ArrowSquareOut size={13} weight="bold" />} label="Open" onClick={handleOpen} primary />
          <ActionButton icon={<MagicWand size={13} weight="bold" />} label="Remix" onClick={handleRemix} />
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-white/90 leading-tight line-clamp-1">
            {template.title}
          </span>
          <span className={cn(
            "inline-flex flex-shrink-0 items-center rounded-full border px-1.5 py-0.5",
            "text-[10px] font-semibold tracking-wide",
            badge.className
          )}>
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-white/40 leading-relaxed line-clamp-2">
          {template.description}
        </p>
      </div>
    </div>
  );
}

function ThumbnailPlaceholder({ template }: { template: ArtifactTemplate }) {
  const meta = CATEGORY_META[template.category];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/20">
      <div className="text-3xl">{meta?.icon}</div>
      <span className="text-[11px] font-medium tracking-wide">{template.title}</span>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold",
        "transition-all duration-100 active:scale-95",
        primary
          ? "bg-indigo-500 text-white hover:bg-indigo-400"
          : "bg-white/10 text-white/80 hover:bg-white/20"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

// ============================================================================
// Category filter tabs
// ============================================================================

function CategoryTabs({
  active,
  onChange,
}: {
  active: ArtifactCategory | "all";
  onChange: (cat: ArtifactCategory | "all") => void;
}) {
  const tabs: Array<{ id: ArtifactCategory | "all"; label: string }> = [
    { id: "all", label: "All" },
    ...TEMPLATE_CATEGORIES.map(cat => ({
      id: cat as ArtifactCategory,
      label: CATEGORY_META[cat as ArtifactCategory]?.label ?? cat,
    })),
  ];

  return (
    <div className="flex gap-1.5 flex-wrap">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all duration-150",
            active === tab.id
              ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30"
              : "text-white/40 hover:text-white/70 hover:bg-white/[0.05]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Main gallery
// ============================================================================

export function ArtifactTemplateGallery({
  onOpenDirect,
  onSendPrompt,
  className,
}: ArtifactTemplateGalleryProps) {
  const [activeCategory, setActiveCategory] = useState<ArtifactCategory | "all">("all");

  const visible = activeCategory === "all"
    ? ARTIFACT_TEMPLATES
    : ARTIFACT_TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-white/80">Templates</h2>
        <p className="text-xs text-white/40">
          Click <span className="text-white/60">Open</span> to launch instantly, or{" "}
          <span className="text-white/60">Remix</span> to generate a customised version.
        </p>
      </div>

      <CategoryTabs active={activeCategory} onChange={setActiveCategory} />

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {visible.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onOpenDirect={onOpenDirect}
            onSendPrompt={onSendPrompt}
          />
        ))}
      </div>
    </div>
  );
}
