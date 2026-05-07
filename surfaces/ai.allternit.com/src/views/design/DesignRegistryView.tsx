"use client";

import React, { useState, useMemo } from "react";
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
  { id: "minimalist", label: "Minimalist", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("minimalist")).length },
  { id: "dark", label: "Dark", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("dark")).length },
  { id: "clean", label: "Clean", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("clean")).length },
  { id: "saas", label: "SaaS", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("saas")).length },
  { id: "fintech", label: "Fintech", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("fintech")).length },
  { id: "purple", label: "Purple", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("purple")).length },
  { id: "animation", label: "Animation", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("animation")).length },
  { id: "developer", label: "Developer", count: DESIGN_MARKETPLACE.filter((d) => d.tags.includes("developer")).length },
];

const TOP_CREATORS = [
  { handle: "@allternit", name: "Allternit", designs: 8, verified: true },
  { handle: "@vercel", name: "Vercel", designs: 1, verified: true },
  { handle: "@linear", name: "Linear", designs: 2, verified: true },
  { handle: "@stripe", name: "Stripe", designs: 1, verified: true },
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
        <div style={{ height: 8, width: "60%", background: "rgba(255,255,255,0.08)", borderRadius: 4 }} />
        <div style={{ height: 6, width: "40%", background: "rgba(255,255,255,0.05)", borderRadius: 3, marginTop: 10 }} />
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
        <div style={{ flex: 1, height: 24, background: "rgba(255,255,255,0.06)", borderRadius: 6 }} />
        <div style={{ width: 24, height: 24, background: "rgba(255,255,255,0.06)", borderRadius: 6 }} />
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
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        background: "#0a0a0c",
        color: "#fff",
        fontFamily: "var(--font-sans)",
        overflow: "hidden",
      }}
    >
      {/* ─── Left Sidebar ────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 240,
          borderRight: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 16px",
          gap: 24,
          flexShrink: 0,
          overflowY: "auto",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 8 }}>
          <MagicWand size={20} weight="duotone" color="var(--accent-primary)" />
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>
            Allternit
          </span>
        </div>

        {/* Search */}
        <div style={{ position: "relative" }}>
          <MagnifyingGlass
            size={14}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.25)",
            }}
          />
          <input
            type="text"
            placeholder="Search designs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 10px 9px 32px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.03)",
              color: "#fff",
              fontSize: 12,
              outline: "none",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* Feed Filters */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Feed
          </label>
          {FEED_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setActiveFeed(opt.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: 8,
                border: "none",
                background: activeFeed === opt.id ? "rgba(255,255,255,0.08)" : "transparent",
                color: activeFeed === opt.id ? "#fff" : "rgba(255,255,255,0.45)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span style={{ opacity: activeFeed === opt.id ? 1 : 0.5 }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            Tags
          </label>
          {TAG_CATEGORIES.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTag(tag.id)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderRadius: 8,
                border: "none",
                background: activeTag === tag.id ? "rgba(226,124,89,0.12)" : "transparent",
                color: activeTag === tag.id ? "var(--accent-primary)" : "rgba(255,255,255,0.45)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s",
              }}
            >
              <span>{tag.label}</span>
              <span
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.25)",
                  fontWeight: 700,
                }}
              >
                {tag.count}
              </span>
            </button>
          ))}
        </div>

        {/* Top Creators */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              color: "rgba(255,255,255,0.3)",
              textTransform: "uppercase",
            }}
          >
            Top Creators
          </label>
          {TOP_CREATORS.map((creator) => (
            <div
              key={creator.handle}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 0",
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {creator.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {creator.handle}
                  {creator.verified && (
                    <Check size={10} weight="bold" color="#3b82f6" />
                  )}
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
                  {creator.designs} designs
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ─── Main Content ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header Stats */}
        <div
          style={{
            padding: "24px 28px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-0.02em",
                marginBottom: 4,
              }}
            >
              Browse the Hyperdesign marketplace.
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", maxWidth: 520 }}>
              Browse and install Design.md specifications for your agents. Search by tag, compare
              the most-used entries, and study the building blocks behind the library.
            </p>
          </div>

          <div style={{ display: "flex", gap: 24 }}>
            <StatBox label="Active Designs" value={DESIGN_MARKETPLACE.length.toString()} sub="Design systems available" />
            <StatBox label="Tag Groups" value={TAG_CATEGORIES.length.toString()} sub="Curated categories" />
            <StatBox label="Total Installs" value={formatNumber(totalInstalls)} sub="Across all systems" />
            <StatBox label="Most Used" value={mostUsed.name} sub={`${formatNumber(mostUsed.installs || 0)} installs`} />
          </div>
        </div>

        {/* Scrollable Grid Area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          {/* Filter pills */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "80px 0",
                color: "rgba(255,255,255,0.3)",
                gap: 12,
              }}
            >
              <MagnifyingGlass size={40} />
              <p style={{ fontSize: 14, fontWeight: 600 }}>No designs match your filters.</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setActiveTag("all");
                  setActiveFeed("featured");
                }}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 16,
              }}
            >
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
                    style={{
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 16,
                      overflow: "hidden",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                    }}
                    onClick={() => setSelectedId(design.id)}
                  >
                    {/* Preview */}
                    <div style={{ height: 180, position: "relative" }}>
                      <PreviewGradient colors={design.previewColors} />

                      {/* Hover overlay actions */}
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                              position: "absolute",
                              inset: 0,
                              background: "rgba(0,0,0,0.5)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 10,
                              padding: 16,
                            }}
                          >
                            <ActionBtn
                              icon={<PlayCircle size={16} />}
                              label="Preview"
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
                      <div
                        style={{
                          position: "absolute",
                          top: 10,
                          right: 10,
                          display: "flex",
                          gap: 6,
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(design.id);
                          }}
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: "rgba(0,0,0,0.4)",
                            border: "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            color: isLiked ? "#ef4444" : "#fff",
                            backdropFilter: "blur(4px)",
                          }}
                        >
                          <Heart size={14} weight={isLiked ? "fill" : "regular"} />
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: "0.08em",
                              color: "var(--accent-primary)",
                              textTransform: "uppercase",
                              marginBottom: 4,
                            }}
                          >
                            {design.vibe}
                          </div>
                          <h3
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "#fff",
                              margin: 0,
                              lineHeight: 1.3,
                            }}
                          >
                            {design.name}
                          </h3>
                        </div>
                      </div>

                      <p
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.4)",
                          lineHeight: 1.5,
                          margin: 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {design.description}
                      </p>

                      {/* Tags */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {design.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.04)",
                              border: "1px solid rgba(255,255,255,0.05)",
                              fontSize: 10,
                              fontWeight: 700,
                              color: "rgba(255,255,255,0.4)",
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Footer stats */}
                      <div
                        style={{
                          marginTop: "auto",
                          paddingTop: 12,
                          borderTop: "1px solid rgba(255,255,255,0.04)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              background: "rgba(255,255,255,0.08)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 9,
                              fontWeight: 800,
                              color: "rgba(255,255,255,0.5)",
                            }}
                          >
                            {(design.author || "A")[0]}
                          </div>
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
                            {design.creatorHandle || "@allternit"}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
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
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.6)",
              whiteSpace: "nowrap",
            }}
          >
            <Sparkle size={12} color="var(--accent-primary)" />
            Gemini 2.5 Pro
          </div>

          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="text"
              placeholder="Describe a design system you want to generate..."
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
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "#fff",
                fontSize: 13,
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6 }}>
            <button
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Upload size={14} />
            </button>
            <button
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
            </button>
            <button
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
              style={{
                padding: "0 18px",
                height: 32,
                borderRadius: 8,
                background: "var(--accent-primary)",
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
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
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 100 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>{sub}</span>
    </div>
  );
}

function StatBadge({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, color: "rgba(255,255,255,0.35)", fontSize: 10, fontWeight: 700 }}>
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
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${active ? "rgba(226,124,89,0.3)" : "rgba(255,255,255,0.06)"}`,
        background: active ? "rgba(226,124,89,0.1)" : "transparent",
        color: active ? "var(--accent-primary)" : "rgba(255,255,255,0.5)",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
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
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 16px",
        borderRadius: 8,
        background: primary ? "#fff" : "rgba(255,255,255,0.1)",
        border: "none",
        color: primary ? "#111" : "#fff",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        backdropFilter: "blur(4px)",
      }}
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
