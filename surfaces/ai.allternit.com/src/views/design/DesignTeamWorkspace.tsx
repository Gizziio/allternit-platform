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
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0a0c",
        color: "#fff",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
            Team Workspace
          </h2>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Collaborate, review, and ship designs together.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => setShareOpen(!shareOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <ShareNetwork size={16} />
            Share for review
          </button>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 10,
              background: "#e27c59",
              border: "none",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
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
            style={{
              overflow: "hidden",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <div
              style={{
                padding: "16px 24px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                background: "rgba(226,124,89,0.04)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", marginBottom: 6 }}>
                  Client review link
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Link size={14} color="rgba(255,255,255,0.4)" />
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {reviewToken}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: linkCopied ? "#22c55e" : "rgba(255,255,255,0.06)",
                      border: "none",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {linkCopied ? <Check size={12} /> : <Copy size={12} />}
                    {linkCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  <Globe size={14} />
                  Anyone with link
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  <Eye size={14} />
                  Can comment
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Grid */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Team */}
        <div
          style={{
            width: 260,
            borderRight: "1px solid rgba(255,255,255,0.04)",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflowY: "auto",
          }}
        >
          <SectionTitle icon={<Users size={14} />} label="Team Members" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MOCK_TEAM.map((member) => (
              <div
                key={member.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 10,
                  background: member.role === "owner" ? "rgba(226,124,89,0.08)" : "transparent",
                  border: member.role === "owner" ? "1px solid rgba(226,124,89,0.12)" : "1px solid transparent",
                }}
              >
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 800,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {member.avatar}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background:
                        member.status === "online"
                          ? "#22c55e"
                          : member.status === "away"
                          ? "#f59e0b"
                          : "#6b7280",
                      border: "2px solid #0a0a0c",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                    {member.name}
                    {member.role === "owner" && (
                      <Star size={10} weight="fill" color="#e27c59" style={{ marginLeft: 4, display: "inline" }} />
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{member.handle}</div>
                </div>
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "rgba(255,255,255,0.3)",
                  }}
                >
                  {member.role}
                </span>
              </div>
            ))}
          </div>

          <button
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.04)",
              border: "1px dashed rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus size={14} />
            Invite member
          </button>
        </div>

        {/* Center: Projects + Live Presence Canvas */}
        <div
          style={{
            flex: 1,
            padding: 20,
            overflowY: "auto",
            borderRight: "1px solid rgba(255,255,255,0.04)",
            position: "relative",
          }}
          ref={canvasRef}
        >
          {/* Live cursors overlay */}
          {showPresence && liveCursors.map((cursor) => (
            <motion.div
              key={cursor.id}
              animate={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              style={{ position: "absolute", pointerEvents: "none", zIndex: 10 }}
            >
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                <svg width="14" height="18" viewBox="0 0 14 18" fill="none"><path d="M0 0L14 8L7 10L4 18L0 0Z" fill={cursor.color} /></svg>
                <span style={{ fontSize: 9, fontWeight: 800, background: cursor.color, color: "#fff", padding: "2px 5px", borderRadius: 4, whiteSpace: "nowrap" }}>{cursor.name}</span>
              </div>
            </motion.div>
          ))}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <SectionTitle icon={<Globe size={14} />} label="Shared Workspaces" />
            <button onClick={() => setShowPresence(!showPresence)} style={{ fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 5, background: showPresence ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)", border: `1px solid ${showPresence ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`, color: showPresence ? "#22c55e" : "rgba(255,255,255,0.3)", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {showPresence ? "● Live" : "○ Offline"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {MOCK_PROJECTS.map((project) => (
              <div
                key={project.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 14,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.02)";
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: project.previewColor,
                    border: "1px solid rgba(255,255,255,0.06)",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{project.name}</span>
                    <StatusBadge status={project.status} />
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                    {project.type} • Edited {project.lastEdited}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", marginLeft: -6 }}>
                    {project.editors.map((editorId, i) => {
                      const member = MOCK_TEAM.find((m) => m.id === editorId);
                      return (
                        <div
                          key={editorId}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 9,
                            fontWeight: 800,
                            color: "#fff",
                            border: "2px solid #0a0a0c",
                            marginLeft: -6,
                            zIndex: project.editors.length - i,
                          }}
                        >
                          {member?.avatar}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.3)",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    <DotsThree size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Activity & Review */}
        <div
          style={{
            width: 300,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 20,
            overflowY: "auto",
          }}
        >
          {/* Review Filter */}
          <div>
            <SectionTitle icon={<ChatCircle size={14} />} label="Review Activity" />
            <div style={{ display: "flex", gap: 6, marginTop: 12, marginBottom: 12 }}>
              {(["all", "pending", "approved"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setReviewFilter(f)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 6,
                    background: reviewFilter === f ? "rgba(255,255,255,0.08)" : "transparent",
                    border: "none",
                    color: reviewFilter === f ? "#fff" : "rgba(255,255,255,0.4)",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {MOCK_REVIEWS.filter((r) => {
                if (reviewFilter === "pending") return r.action === "commented" || r.action === "requested changes";
                if (reviewFilter === "approved") return r.action === "approved";
                return true;
              }).map((review) => (
                <div
                  key={review.id}
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 800,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {review.avatar}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", marginBottom: 2 }}>
                      {review.reviewer}{" "}
                      <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 500 }}>
                        {review.action}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.5)",
                        marginBottom: 4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {review.projectName}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
                      {review.time}
                    </div>
                  </div>
                  <ReviewActionIcon action={review.action} />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "rgba(226,124,89,0.06)",
              border: "1px solid rgba(226,124,89,0.1)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, color: "#e27c59" }}>Quick Actions</div>
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
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
      <span style={{ color: "rgba(255,255,255,0.4)" }}>{icon}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.35)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: SharedProject["status"] }) {
  const colors = {
    draft: { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.5)" },
    review: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
    approved: { bg: "rgba(34,197,94,0.1)", text: "#22c55e" },
    published: { bg: "rgba(59,130,246,0.1)", text: "#3b82f6" },
  };
  const c = colors[status];
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 6,
        background: c.bg,
        color: c.text,
        fontSize: 9,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {status}
    </span>
  );
}

function ReviewActionIcon({ action }: { action: ReviewItem["action"] }) {
  if (action === "approved")
    return <CheckCircle size={16} color="#22c55e" weight="fill" />;
  if (action === "commented")
    return <ChatCircle size={16} color="#3b82f6" weight="fill" />;
  return <Pencil size={16} color="#f59e0b" weight="fill" />;
}

function QuickAction({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.2)",
        border: "1px solid rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
      }}
    >
      <span style={{ color: "rgba(255,255,255,0.4)" }}>{icon}</span>
      {label}
    </button>
  );
}


