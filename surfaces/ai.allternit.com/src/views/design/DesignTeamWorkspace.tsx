// @ts-nocheck
"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  ShareNetwork,
  CheckCircle,
  ChatCircle,
  Eye,
  Link,
  Copy,
  Check,
  Globe,
  Star,
  Plus,
  Pencil,
  DotsThree,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// ─── Mock Data ───────────────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  status: "online" | "away" | "offline";
  role: "owner" | "editor" | "viewer";
}

interface SharedProject {
  id: string;
  name: string;
  type: string;
  lastEdited: string;
  editors: string[];
  status: "draft" | "review" | "approved" | "published";
  previewColor: string;
}

interface ReviewItem {
  id: string;
  projectName: string;
  reviewer: string;
  action: "commented" | "approved" | "requested changes";
  time: string;
  avatar: string;
}

const MOCK_TEAM: TeamMember[] = [
  { id: "1", name: "You", handle: "@you", avatar: "Y", status: "online", role: "owner" },
  { id: "2", name: "Alex Chen", handle: "@alexc", avatar: "A", status: "online", role: "editor" },
  { id: "3", name: "Maya Patel", handle: "@mayap", avatar: "M", status: "away", role: "editor" },
  { id: "4", name: "Jordan Lee", handle: "@jordanl", avatar: "J", status: "offline", role: "viewer" },
];

const MOCK_PROJECTS: SharedProject[] = [
  {
    id: "p1",
    name: "Apollo Financial Dashboard",
    type: "Prototype",
    lastEdited: "2m ago",
    editors: ["1", "2"],
    status: "review",
    previewColor: "#1a1f36",
  },
  {
    id: "p2",
    name: "Canopy Onboarding Flow",
    type: "Mobile",
    lastEdited: "1h ago",
    editors: ["1", "3"],
    status: "approved",
    previewColor: "#f4f7ff",
  },
  {
    id: "p3",
    name: "Social Engine v1",
    type: "Content Engine",
    lastEdited: "3h ago",
    editors: ["2"],
    status: "draft",
    previewColor: "#fff5f2",
  },
];

const MOCK_REVIEWS: ReviewItem[] = [
  {
    id: "r1",
    projectName: "Apollo Financial Dashboard",
    reviewer: "Alex Chen",
    action: "commented",
    time: "5m ago",
    avatar: "A",
  },
  {
    id: "r2",
    projectName: "Canopy Onboarding Flow",
    reviewer: "Maya Patel",
    action: "approved",
    time: "1h ago",
    avatar: "M",
  },
  {
    id: "r3",
    projectName: "Apollo Financial Dashboard",
    reviewer: "Jordan Lee",
    action: "requested changes",
    time: "2h ago",
    avatar: "J",
  },
];

// ─── Live Presence Cursors ────────────────────────────────────────────────────

interface LiveCursor { id: string; name: string; color: string; x: number; y: number; }

const CURSOR_COLORS = ["#3b82f6", "#22c55e", "#f59e0b"];

function useLiveCursors(): LiveCursor[] {
  const [cursors, setCursors] = useState<LiveCursor[]>([
    { id: "2", name: "Alex", color: CURSOR_COLORS[0], x: 30, y: 40 },
    { id: "3", name: "Maya", color: CURSOR_COLORS[1], x: 65, y: 25 },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCursors((prev) => prev.map((c) => ({
        ...c,
        x: Math.max(5, Math.min(90, c.x + (Math.random() - 0.5) * 12)),
        y: Math.max(5, Math.min(90, c.y + (Math.random() - 0.5) * 8)),
      })));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return cursors;
}

// ─── JWT-style token generator ────────────────────────────────────────────────

function makeReviewToken(projectName: string): string {
  const slug = projectName.toLowerCase().replace(/\s+/g, "-");
  const token = btoa(`${slug}:${Date.now()}`).replace(/=/g, "").slice(0, 16);
  return `https://allternit.studio/review/${slug}?token=${token}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DesignTeamWorkspace({ projectName }: { projectName?: string }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "approved">("all");
  const [showPresence, setShowPresence] = useState(true);
  const liveCursors = useLiveCursors();
  const canvasRef = useRef<HTMLDivElement>(null);

  const reviewToken = useRef(makeReviewToken(projectName || "project")).current;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reviewToken);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="size-full bg-white dark:bg-black text-black dark:text-white font-sans flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-[20px_24px] border-b border-solid border-black/5 dark:border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-extrabold tracking-tight mb-1 m-0 text-zinc-900 dark:text-white">
            Team Workspace
          </h2>
          <p className="text-[13px] text-zinc-500 dark:text-white/40 m-0">
            Collaborate, review, and ship designs together.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button type="button"
            onClick={() => setShareOpen(!shareOpen)}
            className="flex items-center gap-1.5 p-[8px_16px] rounded-xl bg-black/5 dark:bg-white/5 border border-solid border-black/5 dark:border-white/10 text-zinc-900 dark:text-white text-[13px] font-bold cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <ShareNetwork size={16} />
            Share for review
          </button>
          <button type="button"
            className="flex items-center gap-1.5 p-[8px_16px] rounded-xl bg-[var(--accent-primary,#e27c59)] border-none text-white text-[13px] font-bold cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            New workspace
          </button>
        </div>
      </div>

      {/* Share panel */}
      <AnimatePresence>
        {shareOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-b border-solid border-black/5 dark:border-white/5"
          >
            <div className="p-[16px_24px] flex items-center gap-4 bg-[color-mix(in_srgb,var(--accent-primary,#e27c59)_4%,transparent)]">
              <div className="flex-1">
                <div className="text-[12px] font-bold text-zinc-600 dark:text-white/70 mb-1.5">
                  Client review link
                </div>
                <div className="flex items-center gap-2 p-[10px_14px] rounded-xl bg-black/5 dark:bg-black/30 border border-solid border-black/5 dark:border-white/5">
                  <Link size={14} className="text-zinc-400 dark:text-white/30" />
                  <span className="text-[12px] text-zinc-500 dark:text-white/50 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    {reviewToken}
                  </span>
                  <button type="button"
                    onClick={handleCopyLink}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 rounded-md border-none text-white text-[12px] font-bold cursor-pointer transition-colors",
                      linkCopied ? "bg-green-600" : "bg-zinc-800 dark:bg-white/10 hover:bg-zinc-700 dark:hover:bg-white/20"
                    )}
                  >
                    {linkCopied ? <Check size={12} /> : <Copy size={12} />}
                    {linkCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-solid border-black/5 dark:border-white/10 text-[12px] font-semibold text-zinc-600 dark:text-white/70">
                  <Globe size={14} />
                  Anyone with link
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/5 dark:bg-white/5 border border-solid border-black/5 dark:border-white/10 text-[12px] font-semibold text-zinc-600 dark:text-white/70">
                  <Eye size={14} />
                  Can comment
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Team */}
        <div className="w-[260px] border-r border-solid border-black/5 dark:border-white/5 p-5 flex flex-col gap-5 overflow-y-auto shrink-0">
          <SectionTitle icon={<Users size={14} />} label="Team Members" />
          <div className="flex flex-col gap-2">
            {MOCK_TEAM.map((member) => (
              <div
                key={member.id}
                className={cn(
                  "flex items-center gap-2.5 p-[8px_10px] rounded-xl transition-colors",
                  member.role === "owner" ? "bg-[color-mix(in_srgb,var(--accent-primary,#e27c59)_8%,transparent)] border border-solid border-[color-mix(in_srgb,var(--accent-primary,#e27c59)_12%,transparent)]" : "bg-transparent border border-solid border-transparent"
                )}
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[12px] font-extrabold text-zinc-600 dark:text-white/70">
                    {member.avatar}
                  </div>
                  <div
                    className={cn(
                      "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-solid border-white dark:border-black",
                      member.status === "online" ? "bg-green-500" : member.status === "away" ? "bg-amber-500" : "bg-zinc-500"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-zinc-900 dark:text-white truncate">
                    {member.name}
                    {member.role === "owner" && (
                      <Star size={10} weight="fill" className="text-[var(--accent-primary,#e27c59)] ml-1 inline" />
                    )}
                  </div>
                  <div className="text-[12px] text-zinc-400 dark:text-white/30 truncate">{member.handle}</div>
                </div>
                <span className="text-[12px] font-extrabold uppercase tracking-widest text-zinc-300 dark:text-white/20">
                  {member.role}
                </span>
              </div>
            ))}
          </div>

          <button type="button" className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-black/5 dark:bg-white/5 border border-dashed border-black/10 dark:border-white/10 text-zinc-400 dark:text-white/40 text-[12px] font-bold cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            <Plus size={14} />
            Invite member
          </button>
        </div>

        {/* Center: Projects + Live Presence Canvas */}
        <div className="flex-1 p-5 overflow-y-auto border-r border-solid border-black/5 dark:border-white/5 relative" ref={canvasRef}>
          {/* Live cursors overlay */}
          {showPresence && liveCursors.map((cursor) => (
            <motion.div
              key={cursor.id}
              animate={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="absolute pointer-events-none z-10"
            >
              <div className="flex items-end gap-1">
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none"><path d="M0 0L14 8L7 10L4 18L0 0Z" fill={cursor.color} /></svg>
                <span className="text-[12px] font-extrabold text-white px-1.5 py-0.5 rounded-[4px] whitespace-nowrap" style={{ background: cursor.color }}>{cursor.name}</span>
              </div>
            </motion.div>
          ))}

          <div className="flex items-center justify-between mb-3">
            <SectionTitle icon={<Globe size={14} />} label="Shared Workspaces" />
            <button type="button" onClick={() => setShowPresence(!showPresence)} className={cn("text-[12px] font-extrabold px-2 py-0.5 rounded-md border border-solid text-zinc-400 uppercase tracking-wider transition-colors", showPresence ? "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-500" : "bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/10 text-zinc-400 dark:text-white/30")}>
              {showPresence ? "● Live" : "○ Offline"}
            </button>
          </div>
          <div className="flex flex-col gap-2.5 mt-3">
            {MOCK_PROJECTS.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-3.5 p-3.5 rounded-xl bg-black/5 dark:bg-white/5 border border-solid border-black/5 dark:border-white/5 cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/10"
              >
                <div
                  className="w-12 h-12 rounded-xl border border-solid border-black/5 dark:border-white/10 shrink-0 shadow-sm"
                  style={{ background: project.previewColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[14px] font-bold text-zinc-900 dark:text-white truncate">{project.name}</span>
                    <StatusBadge status={project.status} />
                  </div>
                  <div className="text-[12px] text-zinc-500 dark:text-white/40">
                    {project.type} • Edited {project.lastEdited}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex -ml-1.5">
                    {project.editors.map((editorId, i) => {
                      const member = MOCK_TEAM.find((m) => m.id === editorId);
                      return (
                        <div
                          key={editorId}
                          className="w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-[12px] font-extrabold text-zinc-700 dark:text-white border-2 border-solid border-white dark:border-black -ml-1.5 transition-transform hover:-translate-y-0.5"
                          style={{ zIndex: project.editors.length - i }}
                        >
                          {member?.avatar}
                        </div>
                      );
                    })}
                  </div>
                  <button type="button" className="bg-transparent border-none text-zinc-400 dark:text-white/30 cursor-pointer p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 hover:text-zinc-600 dark:hover:text-white transition-colors">
                    <DotsThree size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Activity & Review */}
        <div className="w-[300px] p-5 flex flex-col gap-5 overflow-y-auto shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
          {/* Review Filter */}
          <div>
            <SectionTitle icon={<ChatCircle size={14} />} label="Review Activity" />
            <div className="flex gap-1.5 my-3">
              {(["all", "pending", "approved"] as const).map((f) => (
                <button type="button"
                  key={f}
                  onClick={() => setReviewFilter(f)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg border-none text-[12px] font-bold transition-colors capitalize cursor-pointer",
                    reviewFilter === f ? "bg-black/10 dark:bg-white/10 text-zinc-900 dark:text-white" : "bg-transparent text-zinc-400 dark:text-white/30 hover:bg-black/5 dark:hover:bg-white/5"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2.5">
              {MOCK_REVIEWS.filter((r) => {
                if (reviewFilter === "pending") return r.action === "commented" || r.action === "requested changes";
                if (reviewFilter === "approved") return r.action === "approved";
                return true;
              }).map((review) => (
                <div
                  key={review.id}
                  className="p-3 rounded-xl bg-white dark:bg-white/5 border border-solid border-black/5 dark:border-white/5 flex gap-2.5 shadow-sm"
                >
                  <div className="w-7 h-7 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[12px] font-extrabold text-zinc-600 dark:text-white/80 shrink-0">
                    {review.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-zinc-900 dark:text-white mb-0.5">
                      {review.reviewer}{" "}
                      <span className="text-zinc-400 dark:text-white/40 font-medium">
                        {review.action}
                      </span>
                    </div>
                    <div className="text-[12px] text-zinc-500 dark:text-white/50 mb-1 truncate">
                      {review.projectName}
                    </div>
                    <div className="text-[12px] text-zinc-400 dark:text-white/30 font-medium">
                      {review.time}
                    </div>
                  </div>
                  <ReviewActionIcon action={review.action} />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-4 rounded-2xl bg-[color-mix(in_srgb,var(--accent-primary,#e27c59)_6%,transparent)] border border-solid border-[color-mix(in_srgb,var(--accent-primary,#e27c59)_12%,transparent)] flex flex-col gap-2.5">
            <div className="text-[12px] font-extrabold text-[var(--accent-primary,#e27c59)] uppercase tracking-wider mb-1">Quick Actions</div>
            <QuickAction icon={<Link size={14} />} label="Copy review link" />
            <QuickAction icon={<CheckCircle size={14} />} label="Mark all as read" />
            <QuickAction icon={<Pencil size={14} />} label="Edit permissions" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-zinc-400 dark:text-white/30">{icon}</span>
      <span className="text-[12px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-white/30">
        {label}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: SharedProject["status"] }) {
  const colors = {
    draft: { bg: "bg-black/5 dark:bg-white/5", text: "text-zinc-400 dark:text-white/40" },
    review: { bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-500" },
    approved: { bg: "bg-green-500/10", text: "text-green-600 dark:text-green-500" },
    published: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-500" },
  };
  const c = colors[status];
  return (
    <span className={cn("px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider shrink-0", c.bg, c.text)}>
      {status}
    </span>
  );
}

function ReviewActionIcon({ action }: { action: ReviewItem["action"] }) {
  if (action === "approved")
    return <CheckCircle size={16} className="text-green-500" weight="fill" />;
  if (action === "commented")
    return <ChatCircle size={16} className="text-blue-500" weight="fill" />;
  return <Pencil size={16} className="text-amber-500" weight="fill" />;
}

function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button type="button" className="flex items-center gap-2 p-[8px_10px] rounded-lg bg-black/10 dark:bg-white/5 border border-solid border-black/5 dark:border-white/5 text-zinc-700 dark:text-white/70 text-[12px] font-bold cursor-pointer text-left w-full hover:bg-black/15 dark:hover:bg-white/10 transition-colors">
      <span className="text-zinc-400 dark:text-white/30">{icon}</span>
      {label}
    </button>
  );
}
