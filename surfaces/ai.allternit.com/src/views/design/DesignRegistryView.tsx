"use client";

import React, { useMemo, useState } from 'react';
import { useIsClient } from '@/lib/hooks/use-is-client';
import {
  MagnifyingGlass,
  DownloadSimple,
  Check,
  ArrowSquareOut,
  Sparkle,
  Star,
  Eye,
  GitFork,
  MagicWand,
  Fire,
  TrendUp,
  Clock,
  Crown,
  Lightning,
  Plus,
  Copy,
  Heart,
  PlayCircle,
  Upload,
} from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { DESIGN_MARKETPLACE, DesignSystem } from "../../lib/design/design-registry";
import { useNav } from "../../nav/useNav";

// ─── Types ───────────────────────────────────────────────────────────────────

type FeedFilter = "featured" | "pro" | "trending" | "upcoming";

interface DesignRegistryViewProps {
  onInstall?: (design: DesignSystem) => void;
  installedId?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FEED_OPTIONS: { id: FeedFilter; label: string; icon: React.ReactNode }[] = [
  { id: "featured", label: "Featured", icon: <Star size={14} weight="fill" /> },
  { id: "pro", label: "Pro", icon: <Crown size={14} weight="fill" /> },
  { id: "trending", label: "Trending", icon: <Fire size={14} weight="fill" /> },
  { id: "upcoming", label: "Upcoming", icon: <Clock size={14} weight="fill" /> },
];

const TAG_CATEGORIES = [
  { id: "all", label: "All", count: DESIGN_MARKETPLACE.length },
  { id: "ai", label: "AI", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("ai")).length },
  { id: "llm", label: "LLM", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("llm")).length },
  { id: "ecommerce", label: "Ecommerce", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("ecommerce")).length },
  { id: "retail", label: "Retail", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("retail")).length },
  { id: "enterprise", label: "Enterprise", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("enterprise")).length },
  { id: "b2b", label: "B2B", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("b2b")).length },
  { id: "consumer", label: "Consumer", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("consumer")).length },
  { id: "media", label: "Media", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("media")).length },
  { id: "design", label: "Design", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("design")).length },
  { id: "creative", label: "Creative", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("creative")).length },
  { id: "themed", label: "Themed", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("themed")).length },
  { id: "unique", label: "Unique", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("unique")).length },
  { id: "finance", label: "Finance", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("finance")).length },
  { id: "fintech", label: "Fintech", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("fintech")).length },
  { id: "health", label: "Health", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("health")).length },
  { id: "medical", label: "Medical", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("medical")).length },
  { id: "edu", label: "Edu", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("edu")).length },
  { id: "learning", label: "Learning", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("learning")).length },
  { id: "starter", label: "Starter", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("starter")).length },
  { id: "template", label: "Template", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("template")).length },
];

const TOP_CREATORS = [
  { handle: "@nexu-io", name: "nexu-io", designs: 148, verified: true },
];

// ─── Helper: Preview Gradient ────────────────────────────────────────────────

function PreviewGradient({ colors }: { colors: string[] }) {
  const safeColors = colors.length >= 2 ? colors : ["#111", "#333"];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: `linear-gradient(135deg, ${safeColors[0]}, ${safeColors[1]})`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative shapes */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "10%",
          width: "40%",
          height: "40%",
          borderRadius: "50%",
          background: safeColors[2] || safeColors[1],
          opacity: 0.15,
          filter: "blur(20px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          left: "15%",
          width: "30%",
          height: "30%",
          borderRadius: "50%",
          background: safeColors[0],
          opacity: 0.1,
          filter: "blur(16px)",
        }}
      />
      {/* Mock UI lines */}
      <div style={{ position: "absolute", top: 20, left: 20, right: 20 }}>
        <div style={{ height: 8, width: "60%", background: "var(--surface-hover)", borderRadius: 4 }} />
        <div style={{ height: 6, width: "40%", background: "var(--surface-hover)", borderRadius: 3, marginTop: 10 }} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          display: "flex",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, height: 24, background: "var(--surface-hover)", borderRadius: 6 }} />
        <div style={{ width: 24, height: 24, background: "var(--surface-hover)", borderRadius: 6 }} />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DesignRegistryView({ onInstall, installedId }: DesignRegistryViewProps) {
  const { dispatch } = useNav();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFeed, setActiveFeed] = useState<FeedFilter>("featured");
  const [activeTag, setActiveTag] = useState("all");
  const [promptInput, setPromptInput] = useState("");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [likedDesigns, setLikedDesigns] = useState<Set<string>>(new Set());
  const [remixing, setRemixing] = useState<string | null>(null);

  const handleInstall = (design: DesignSystem) => {
    if (onInstall) {
      onInstall(design);
    } else {
      dispatch({
        type: "PUSH_VIEW",
        viewType: "allternit-ix" as any,
        viewId: "allternit-ix",
        context: {
          stream:
            design.id === "generative"
              ? ""
              : `[v:card title="Installed: ${design.name}" [v:metric label="Status" val="Active" trend="up"]]`,
          designMd: design.id === "generative" ? "GENERATIVE_TRIGGER" : design.designMd,
        },
      });
    }
  };

  const handleRemix = (design: DesignSystem) => {
    setRemixing(design.id);
    setTimeout(() => {
      setRemixing(null);
      dispatch({
        type: "PUSH_VIEW",
        viewType: "design" as any,
        viewId: `design-remix-${Date.now()}`,
        context: {
          remix: true,
          remixOf: design.id,
          remixName: `${design.name} (Remix)`,
          designMd: design.designMd,
          prompt: `Remix of ${design.name}: ${design.description}`,
        },
      });
    }, 900);
  };

  const toggleLike = (id: string) => {
    setLikedDesigns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredDesigns = useMemo(() => {
    let result = DESIGN_MARKETPLACE;

    // Search
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(lower) ||
          d.description.toLowerCase().includes(lower) ||
          d.tags.some((t) => t.toLowerCase().includes(lower))
      );
    }

    // Tag filter
    if (activeTag !== "all") {
      result = result.filter((d) => d.tags.includes(activeTag));
    }

    // Feed sort
    if (activeFeed === "trending") {
      result = [...result].sort((a, b) => (b.installs || 0) - (a.installs || 0));
    } else if (activeFeed === "pro") {
      result = result.filter((d) => (d.installs || 0) > 2000);
    } else if (activeFeed === "upcoming") {
      result = result.filter((d) => (d.installs || 0) < 1500);
    }

    return result;
  }, [searchTerm, activeTag, activeFeed]);

  const totalInstalls = DESIGN_MARKETPLACE.reduce((sum, d) => sum + (d.installs || 0), 0);
  const mostUsed = DESIGN_MARKETPLACE.reduce((max, d) =>
    (d.installs || 0) > (max.installs || 0) ? d : max
  );

  return (
    <div className="flex size-full bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans overflow-hidden">
      {/* ─── Left Sidebar ────────────────────────────────────────────────────── */}
      <aside className="w-[240px] border-r border-solid border-[var(--border-subtle)] flex flex-col p-[20px_16px] gap-6 shrink-0 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-2 pb-2">
          <MagicWand size={20} weight="duotone" className="text-[var(--accent-primary)]" />
          <span className="text-[14px] font-extrabold tracking-tight">
            Allternit
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <input aria-label="Search designs…" type="text"
            placeholder="Search designs…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-[9px_10px_9px_32px] rounded-[10px] border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[12px] outline-none font-inherit"
          />
        </div>

        {/* Feed Filters */}
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-extrabold tracking-[0.1em] text-[var(--text-tertiary)] uppercase mb-1">
            Feed
          </div>
          {FEED_OPTIONS.map((opt) => (
            <button type="button"
              key={opt.id}
              onClick={() => setActiveFeed(opt.id)}
              className={cn(
                "flex items-center gap-2 p-[7px_10px] rounded-lg border-none text-[12px] font-semibold cursor-pointer text-left transition-all duration-150",
                activeFeed === opt.id ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "bg-transparent text-[var(--text-secondary)]"
              )}
            >
              <span className={cn(activeFeed === opt.id ? "opacity-100" : "opacity-50")}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-1">
          <div className="text-[12px] font-extrabold tracking-[0.1em] text-[var(--text-tertiary)] uppercase mb-1">
            Tags
          </div>
          {TAG_CATEGORIES.map((tag) => (
            <button type="button"
              key={tag.id}
              onClick={() => setActiveTag(tag.id)}
              className={cn(
                "flex items-center justify-between p-[6px_10px] rounded-lg border-none text-[12px] font-semibold cursor-pointer text-left transition-all duration-150",
                activeTag === tag.id ? "bg-[#e27c591f] text-[var(--accent-primary)]" : "bg-transparent text-[var(--text-secondary)]"
              )}
            >
              <span>{tag.label}</span>
              <span className="text-[12px] text-[var(--text-tertiary)] font-bold">
                {tag.count}
              </span>
            </button>
          ))}
        </div>

        {/* Top Creators */}
        <div className="flex flex-col gap-2">
          <div className="text-[12px] font-extrabold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
            Top Creators
          </div>
          {TOP_CREATORS.map((creator) => (
            <div
              key={creator.handle}
              className="flex items-center gap-2 py-1.5"
            >
              <div className="size-6 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[12px] font-extrabold text-[var(--text-secondary)]">
                {creator.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                  {creator.handle}
                  {creator.verified && (
                    <Check size={10} weight="bold" className="text-blue-500" />
                  )}
                </div>
                <div className="text-[12px] text-[var(--text-tertiary)]">
                  {creator.designs} designs
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ─── Main Content ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Stats */}
        <div className="p-[24px_28px] border-b border-solid border-[var(--border-subtle)] flex items-center justify-between gap-6">
          <div>
            <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-[-0.02em] mb-1 m-0">
              Browse the Hyperdesign marketplace.
            </h1>
            <p className="text-[13px] text-[var(--text-tertiary)] max-w-[520px] m-0">
              Browse and install Design.md specifications for your agents. Search by tag, compare
              the most-used entries, and study the building blocks behind the library.
            </p>
          </div>

          <div className="flex gap-6">
            <StatBox label="Active Designs" value={DESIGN_MARKETPLACE.length.toString()} sub="Design systems available" />
            <StatBox label="Tag Groups" value={TAG_CATEGORIES.length.toString()} sub="Curated categories" />
            <StatBox label="Total Installs" value={formatNumber(totalInstalls)} sub="Across all systems" />
            <StatBox label="Most Used" value={mostUsed.name} sub={`${formatNumber(mostUsed.installs || 0)} installs`} />
          </div>
        </div>

        {/* Scrollable Grid Area */}
        <div className="flex-1 overflow-y-auto p-[24px_28px]">
        {/* Filter pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          <FilterPill
            active={activeFeed === "featured"}
            onClick={() => setActiveFeed("featured")}
            icon={<Star size={12} weight="fill" />}
            label="Featured"
          />
          <FilterPill
            active={activeFeed === "trending"}
            onClick={() => setActiveFeed("trending")}
            icon={<TrendUp size={12} />}
            label="Trending"
          />
          <FilterPill
            active={activeFeed === "pro"}
            onClick={() => setActiveFeed("pro")}
            icon={<Lightning size={12} />}
            label="Pro"
          />
          {activeTag !== "all" && (
            <FilterPill
              active
              onClick={() => setActiveTag("all")}
              icon={<Sparkle size={12} />}
              label={TAG_CATEGORIES.find((t) => t.id === activeTag)?.label || activeTag}
            />
          )}
        </div>

        {/* Grid */}
        {filteredDesigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)] gap-3">
            <MagnifyingGlass size={40} />
            <p className="text-[14px] font-semibold">No designs match your filters.</p>
            <button type="button"
              onClick={() => {
                setSearchTerm("");
                setActiveTag("all");
                setActiveFeed("featured");
              }}
              className="px-4 py-2 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] text-[13px] font-semibold cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {filteredDesigns.map((design) => {
              const isHovered = hoveredCard === design.id;
              const isLiked = likedDesigns.has(design.id);
              return (
                <motion.div
                  key={design.id}
                  onMouseEnter={() => setHoveredCard(design.id)}
                  onMouseLeave={() => setHoveredCard(null)}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-2xl overflow-hidden cursor-pointer flex flex-col relative"
                  onClick={() => setSelectedId(design.id)}
                >
                  {/* Preview */}
                  <div className="h-[180px] relative">
                    <PreviewGradient colors={design.previewColors} />

                    {/* Hover overlay actions */}
                    <AnimatePresence>
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2.5 p-4"
                        >
                          <ActionBtn
                            icon={<DownloadSimple size={16} />}
                            label="Install"
                            primary
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInstall(design);
                            }}
                          />
                          <ActionBtn
                            icon={remixing === design.id ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}><Sparkle size={16} /></motion.div> : <Copy size={16} />}
                            label={remixing === design.id ? "Cloning…" : "Remix"}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemix(design);
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Top-right actions */}
                    <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                      <button type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(design.id);
                        }}
                        className={cn(
                          "size-7 rounded-lg border-none flex items-center justify-center cursor-pointer backdrop-blur-sm",
                          isLiked ? "bg-black/40 text-red-500" : "bg-black/40 text-white"
                        )}
                      >
                        <Heart size={14} weight={isLiked ? "fill" : "regular"} />
                      </button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col gap-2.5 flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-[12px] font-extrabold tracking-[0.08em] text-[var(--accent-primary)] uppercase mb-1">
                          {design.vibe}
                        </div>
                        <h3 className="text-[15px] font-bold text-[var(--text-primary)] m-0 leading-tight">
                          {design.name}
                        </h3>
                      </div>
                    </div>

                    <p className="text-[12px] text-[var(--text-tertiary)] leading-relaxed m-0 line-clamp-2">
                      {design.description}
                    </p>

                    {/* Tags */}
                    <div className="flex gap-1.5 flex-wrap">
                      {design.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 rounded-md bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] text-[12px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Footer stats */}
                    <div className="mt-auto pt-3 border-t border-solid border-[var(--border-subtle)] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="size-5 rounded-full bg-[var(--surface-hover)] flex items-center justify-center text-[12px] font-extrabold text-[var(--text-secondary)]">
                          {(design.author || "A")[0]}
                        </div>
                        <span className="text-[12px] text-[var(--text-secondary)] font-medium">
                          {design.creatorHandle || "@allternit"}
                        </span>
                      </div>
                      <div className="flex gap-2.5">
                        <StatBadge icon={<DownloadSimple size={11} />} value={formatNumber(design.installs || 0)} />
                        <StatBadge icon={<Eye size={11} />} value={formatNumber(design.views || 0)} />
                        <StatBadge icon={<GitFork size={11} />} value={formatNumber(design.forks || 0)} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        </div>

        {/* Bottom AI Prompt Bar */}
        <div className="p-[12px_20px] border-t border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] backdrop-blur-md flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] text-[12px] font-bold text-[var(--text-secondary)] whitespace-nowrap">
          <Sparkle size={12} className="text-[var(--accent-primary)]" />
          Allternit AI
        </div>

        <div className="flex-1 relative">
          <input aria-label="Describe a design system you want to generate…" type="text"
            placeholder="Describe a design system you want to generate…"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && promptInput.trim()) {
                dispatch({
                  type: "PUSH_VIEW",
                  viewType: "design",
                  viewId: `design-${Date.now()}`,
                  context: { prompt: promptInput.trim() },
                });
              }
            }}
            className="w-full p-[10px_16px] rounded-[10px] border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] text-[13px] outline-none font-inherit"
          />
        </div>

        <div className="flex gap-1.5">
          <button type="button" className="size-8 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer">
            <Upload size={14} />
          </button>
          <button type="button" className="size-8 rounded-lg bg-[var(--surface-hover)] border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center cursor-pointer">
            <Plus size={14} />
          </button>
          <button type="button"
            onClick={() => {
              if (promptInput.trim()) {
                dispatch({
                  type: "PUSH_VIEW",
                  viewType: "design",
                  viewId: `design-${Date.now()}`,
                  context: { prompt: promptInput.trim() },
                });
              }
            }}
            className="px-4 h-8 rounded-lg bg-[var(--accent-primary)] border-none text-white text-[12px] font-extrabold cursor-pointer flex items-center gap-1"
          >
            <MagicWand size={14} />
            Create
          </button>
        </div>
        </div>
        </main>
        </div>
        );
        }

        // ─── Subcomponents ───────────────────────────────────────────────────────────

        function StatBox({ label, value, sub }: { label: string; value: string; sub: string }) {
        return (
        <div className="flex flex-col gap-0.5 min-w-[100px]">
        <span className="text-[12px] font-extrabold tracking-[0.1em] text-[var(--text-tertiary)] uppercase">
        {label}
        </span>
        <span className="text-[20px] font-extrabold text-[var(--text-primary)] tracking-[-0.02em]">
        {value}
        </span>
        <span className="text-[12px] text-[var(--text-tertiary)] font-medium">{sub}</span>
        </div>
        );
        }

        function StatBadge({ icon, value }: { icon: React.ReactNode; value: string }) {
        return (
        <div className="flex items-center gap-1 text-[var(--text-tertiary)] text-[12px] font-bold">
        {icon}
        {value}
        </div>
        );
        }

        function FilterPill({
        active,
        onClick,
        icon,
        label,
        }: {
        active: boolean;
        onClick: () => void;
        icon: React.ReactNode;
        label: string;
        }) {
        return (
        <button type="button"
        onClick={onClick}
        className={cn(
        "flex items-center gap-1.5 p-[6px_12px] rounded-lg border border-solid text-[12px] font-bold cursor-pointer transition-all duration-150",
        active ? "border-[var(--accent-primary)]/30 bg-[#e27c591a] text-[var(--accent-primary)]" : "border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)]"
        )}
        >
        {icon}
        {label}
        </button>
        );
        }

        function ActionBtn({
        icon,
        label,
        primary,
        onClick,
        }: {
        icon: React.ReactNode;
        label: string;
        primary?: boolean;
        onClick?: (e: React.MouseEvent) => void;
        }) {
        return (
        <button type="button"
        onClick={onClick}
        className={cn(
        "flex items-center gap-1.5 p-[8px_16px] rounded-lg border-none text-[12px] font-bold cursor-pointer backdrop-blur-sm",
        primary ? "bg-white/90 text-[#111]" : "bg-white/15 text-white"
        )}
        >
        {icon}
        {label}
        </button>
        );
        }

        function formatNumber(n: number): string {
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return String(n);
        }

