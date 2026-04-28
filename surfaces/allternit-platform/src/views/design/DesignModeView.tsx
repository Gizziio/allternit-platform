"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, Layout, PresentationChart, Paperclip, Sliders, Monitor, DeviceMobile, TreeStructure, Megaphone, MagicWand, ShieldCheck, Target, WifiHigh, Cpu, UsersThree, Sun, Moon, Scissors
} from "@phosphor-icons/react";
import { DesignClipboardSidebar } from "./DesignClipboardSidebar";
import { useNav } from "../../nav/useNav";
import { useDesignSessionStore, useDesignSessionActions } from "./DesignSessionStore";

// Imports for built features
import { DesignMdRenderer } from "../../lib/openui/DesignMdRenderer";

import { VideoEditorView } from "./video/VideoEditorView";
import { OfficeWorkspace } from "./office/OfficeWorkspace";
import { componentRegistry } from "../../lib/openui/registry";

import { StudioOnboardingWizard } from "./StudioOnboardingWizard";
import { DesignTeamWorkspace } from "./DesignTeamWorkspace";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectType = 'prototype' | 'slides' | 'content-engine' | 'template' | 'other';
type CanvasTab = 'system' | 'files' | 'questions' | 'sketch' | 'mobile' | 'video' | 'docs' | 'handoff' | 'graph' | 'pipeline' | 'team';
type Specialist = 'architect' | 'growth' | 'purist' | 'creative';

interface Project {
  id: string;
  name: string;
  type: ProjectType;
  specialist: Specialist;
  fidelity: 'wireframe' | 'high';
  activeTabId: CanvasTab;
  tabs: {id: string, label: string, type: CanvasTab}[];
}

// ─── High-Fidelity Generative Loader ─────────────────────────────────────────

function GenerativeLoader({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg-primary)", gap: "32px" }}>
       <div style={{ position: "relative", width: "120px", height: "120px" }}>
          <motion.div 
            animate={{ rotate: 360, scale: [1, 1.1, 1] }} 
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            style={{ position: "absolute", inset: 0, border: "2px dashed var(--accent-primary)", borderRadius: "40%", opacity: 0.2 }} 
          />
          <motion.div 
            animate={{ rotate: -360, borderRadius: ["30%", "50%", "30%"] }} 
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            style={{ position: "absolute", inset: "10px", background: "rgba(226,124,89,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
             <MagicWand size={32} color="var(--accent-primary)" weight="fill" />
          </motion.div>
       </div>
       <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h2>
          <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginTop: "12px" }}>
             {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }} style={{ width: "4px", height: "4px", borderRadius: "2px", background: "var(--accent-primary)" }} />
             ))}
          </div>
       </div>
    </div>
  );
}

// ─── Swarm Inspect UI ────────────────────────────────────────────────────────

function SwarmInspect({ logs }: { logs: any[] }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)", borderRadius: "16px", overflow: "hidden", marginBottom: "20px" }}>
       <div style={{ padding: "12px 16px", background: "rgba(0,0,0,0.03)", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: "8px" }}>
          <UsersThree size={14} weight="bold" />
          <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}>Swarm Collaboration</span>
       </div>
       <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {logs.map((log, i) => (
             <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                <div style={{ padding: "4px", borderRadius: "6px", background: log.agent === 'Architect' ? "#3b82f615" : "var(--accent-primary)15", color: log.agent === 'Architect' ? "#3b82f6" : "var(--accent-primary)" }}>
                   {log.agent === 'Architect' ? <TreeStructure size={12} weight="fill" /> : <Target size={12} weight="fill" />}
                </div>
                <div style={{ flex: 1 }}>
                   <div style={{ fontSize: "10px", fontWeight: 800 }}>{log.agent}</div>
                   <div style={{ fontSize: "11px", opacity: 0.6, marginTop: "2px" }}>{log.action}</div>
                </div>
                <div style={{ fontSize: "9px", fontWeight: 700, color: "#22c55e" }}>{log.status}</div>
             </div>
          ))}
       </div>
    </div>
  );
}

// ─── Studio Onboarding (The "Cutscene") ──────────────────────────────────────

function StudioOnboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [typedText, setTypedText] = useState("");

  const sequence = [
    { title: "Manifest your vision", sub: "Import your team's design DNA" },
    { title: "Design to Code", sub: "Build prototypes from a single prompt", prompt: "Mock up a glass-morphism banking dashboard" },
    { title: "Design to Content", sub: "Manifest 10 native social campaigns instantly", prompt: "Turn this design into a social campaign" },
    { title: "One Studio. All Surfaces.", sub: "Web, Mobile, Video, and Docs in one loop." }
  ];

  useEffect(() => {
    if (step === 0) setTimeout(() => setStep(1), 3000);
    if (step === 4) onComplete();
  }, [step, onComplete]);

  useEffect(() => {
    if (sequence[step]?.prompt) {
       setTypedText("");
       let i = 0;
       const interval = setInterval(() => {
          setTypedText(sequence[step].prompt!.slice(0, i + 1));
          i++;
          if (i >= sequence[step].prompt!.length) {
             clearInterval(interval);
             setTimeout(() => setStep(s => s + 1), 2500);
          }
       }, 50);
       return () => clearInterval(interval);
    }
  }, [step, sequence]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "var(--bg-primary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
       <button
          onClick={onComplete}
          style={{ position: "absolute", bottom: "32px", right: "32px", padding: "8px 16px", borderRadius: "20px", background: "rgba(0,0,0,0.05)", border: "none", fontSize: "12px", fontWeight: 700, color: "rgba(0,0,0,0.4)", cursor: "pointer" }}
       >
          Skip intro
       </button>
       <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }} style={{ textAlign: "center", width: "100%", maxWidth: "800px" }}>
             <h1 style={{ fontSize: "42px", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: "16px" }}>{sequence[step]?.title}</h1>
             <p style={{ fontSize: "18px", color: "rgba(0,0,0,0.4)", fontWeight: 500 }}>{sequence[step]?.sub}</p>
             <div style={{ marginTop: "64px", position: "relative", height: "400px", display: "flex", justifyContent: "center" }}>
                {step === 0 && (
                   <div style={{ display: "flex", gap: "24px" }}>
                      {[1, 2, 3].map(i => (
                         <motion.div key={i} animate={{ y: [0, -20, 0], rotate: [0, 5, 0] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }} style={{ width: "120px", height: "140px", background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.03)" }} />
                      ))}
                   </div>
                )}
                {(step === 1 || step === 2) && (
                   <div style={{ width: "100%", maxWidth: "600px" }}>
                      <div style={{ background: "#fff", border: "1px solid var(--border-default)", borderRadius: "24px", padding: "20px", textAlign: "left", boxShadow: "0 20px 50px rgba(0,0,0,0.05)" }}>
                         <div style={{ fontSize: "14px", color: "var(--text-secondary)", minHeight: "24px" }}>{typedText}</div>
                         <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(0,0,0,0.04)" }} />
                            <div style={{ flex: 1 }} />
                            <div style={{ padding: "8px 20px", borderRadius: "10px", background: "var(--accent-primary)", color: "#fff", fontSize: "12px", fontWeight: 800 }}>Send</div>
                         </div>
                      </div>
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.5 }} style={{ marginTop: "40px", height: "200px", background: "#fff", borderRadius: "24px", border: "1px solid var(--border-subtle)", padding: "24px", display: "flex", gap: "12px" }}>
                         {step === 1 && <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}><div style={{ height: "40px", background: "rgba(0,0,0,0.03)", borderRadius: "8px" }} /><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}><div style={{ height: "80px", background: "#f4f7ff", borderRadius: "12px" }} /><div style={{ height: "80px", background: "#f4f7ff", borderRadius: "12px" }} /></div></div>}
                         {step === 2 && <div style={{ flex: 1, display: "flex", gap: "12px", alignItems: "center", justifyContent: "center" }}><Megaphone size={48} color="var(--accent-primary)" weight="duotone" /><div style={{ width: "40px", height: "4px", background: "var(--border-default)", borderRadius: "2px" }} /><TreeStructure size={48} color="var(--border-default)" /></div>}
                      </motion.div>
                   </div>
                )}
                {step === 3 && (
                   <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", width: "100%" }}>
                      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }} style={{ height: "300px", background: "#f4f7ff", borderRadius: "32px", border: "1px solid var(--border-subtle)" }} />
                      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, delay: 1.5 }} style={{ height: "300px", background: "#fff5f2", borderRadius: "32px", border: "1px solid var(--border-subtle)" }} />
                   </div>
                )}
             </div>
          </motion.div>
       </AnimatePresence>
    </div>
  );
}

// ─── Discovery Hub ──────────────────────────────────────────────────────────

function DiscoveryHub({ onStart }: { onStart: (config: any) => void }) {
  const [activeType, setActiveType] = useState<ProjectType>('prototype');
  const [specialist, setSpecialist] = useState<Specialist>('architect');
  const [name, setName] = useState("");

  const types = [
    { id: 'prototype',      label: 'Prototype',      icon: <Layout size={16} /> },
    { id: 'content-engine', label: 'Content engine', icon: <Megaphone size={16} /> },
    { id: 'slides',         label: 'Slide deck',     icon: <PresentationChart size={16} /> },
  ];

  const specialists = [
    { id: 'architect', label: 'Systems Architect', icon: <TreeStructure size={20} />, desc: 'Focus on structure & hierarchy' },
    { id: 'growth',    label: 'Growth Hacker',     icon: <Target size={20} />, desc: 'Optimize for conversion & impact' },
    { id: 'purist',    label: 'UI Purist',         icon: <Palette size={20} />, desc: 'Pixel-perfect aesthetic focus' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", height: "100%", width: "100%", background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}>
      <aside style={{ width: "360px", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", padding: "32px", background: "#fdfcf9" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "40px" }}>
           <Palette size={24} weight="fill" color="var(--accent-primary)" />
           <div style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.02em" }}>Allternit Studio</div>
        </div>
        <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid var(--border-subtle)", marginBottom: "24px" }}>
           {types.map(t => (
             <button key={t.id} onClick={() => setActiveType(t.id as any)} style={{ paddingBottom: "8px", fontSize: "13px", fontWeight: 600, background: "none", border: "none", color: activeType === t.id ? "var(--text-primary)" : "rgba(0,0,0,0.4)", borderBottom: `2px solid ${activeType === t.id ? "var(--accent-primary)" : "transparent"}`, cursor: "pointer" }}>{t.label}</button>
           ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
           <div style={{ background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "16px", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 800, color: "var(--surface-panel)", textTransform: "uppercase", marginBottom: "16px" }}>Project Name</h3>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Apollo Hub" style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-default)", marginBottom: "8px", outline: "none", fontSize: "14px" }} />
           </div>
           <h3 style={{ fontSize: "12px", fontWeight: 800, color: "var(--surface-panel)", textTransform: "uppercase", marginBottom: "12px", marginLeft: "4px" }}>Select Specialist</h3>
           <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {specialists.map(s => (
                <button key={s.id} onClick={() => setSpecialist(s.id as any)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "12px", border: specialist === s.id ? "2px solid var(--accent-primary)" : "1px solid var(--border-subtle)", background: "#fff", textAlign: "left", cursor: "pointer", transition: "all 0.2s" }}>
                   <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: specialist === s.id ? "var(--accent-primary)" : "rgba(0,0,0,0.04)", color: specialist === s.id ? "#fff" : "var(--text-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                   <div><div style={{ fontSize: "13px", fontWeight: 700 }}>{s.label}</div><div style={{ fontSize: "11px", opacity: 0.4 }}>{s.desc}</div></div>
                </button>
              ))}
           </div>
           <button onClick={() => onStart({ name, type: activeType, specialist })} disabled={!name} style={{ width: "100%", marginTop: "32px", padding: "14px", borderRadius: "12px", background: "var(--text-primary)", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", opacity: !name ? 0.5 : 1, cursor: "pointer" }}>Initialize Studio</button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: "64px", background: "var(--bg-primary)", overflowY: "auto" }}>
         <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "48px" }}>
               <h2 style={{ fontSize: "32px", fontWeight: 900, letterSpacing: "-0.04em" }}>Recent Work</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "32px" }}>
               <ProjectCard title="Canopy Onboarding" sub="UI Purist • Updated 2m ago" color="#f4f7ff" icon={<Monitor size={56} color="var(--status-info)" weight="duotone" />} badges={['Web', 'Mobile']} />
               <ProjectCard title="Social Engine v1" sub="Growth Hacker • Active" color="#fff5f2" icon={<Megaphone size={56} color="var(--accent-primary)" weight="duotone" />} badges={['Campaign', 'Drafts']} />
               <ProjectCard title="Apollo Financial" sub="Systems Architect • 1h ago" color="#f1fdf5" icon={<ShieldCheck size={56} color="var(--status-success)" weight="duotone" />} badges={['Secure', 'API']} />
            </div>
         </div>
      </main>
    </motion.div>
  );
}

function ProjectCard({ title, sub, color, icon, badges }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} whileHover={{ y: -6 }} style={{ background: "#fff", border: "1px solid var(--border-subtle)", borderRadius: "28px", overflow: "hidden", cursor: "pointer", boxShadow: hovered ? "0 20px 40px rgba(0,0,0,0.04)" : "0 2px 4px rgba(0,0,0,0.01)", transition: "all 0.3s cubic-bezier(0.2, 0, 0, 1)" }}>
       <div style={{ height: "200px", background: color, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          {icon}
          {badges && <div style={{ position: "absolute", bottom: "16px", left: "16px", display: "flex", gap: "6px" }}>{badges.map((b: string) => <span key={b} style={{ padding: "4px 10px", borderRadius: "12px", background: "rgba(255,255,255,0.8)", backdropFilter: "blur(4px)", fontSize: "10px", fontWeight: 800, color: "var(--shell-overlay-backdrop)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{b}</span>)}</div>}
       </div>
       <div style={{ padding: "24px" }}>
          <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>{title}</div>
          <div style={{ fontSize: "13px", color: "rgba(0,0,0,0.4)", marginTop: "6px", fontWeight: 500 }}>{sub}</div>
       </div>
    </motion.div>
  );
}

// ─── Mobile Simulator ────────────────────────────────────────────────────────

function MobileSimulator({ designMd }: { designMd: string | null }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f1f1", borderRadius: "32px", overflow: "hidden" }}>
       <div style={{ width: "320px", height: "640px", background: "#000", borderRadius: "48px", border: "8px solid #333", position: "relative", boxShadow: "0 40px 100px var(--surface-hover)", display: "flex", flexDirection: "column" }}>
          <div style={{ height: "30px", width: "100%", display: "flex", justifyContent: "space-between", padding: "10px 30px 0" }}>
             <div style={{ fontSize: "10px", color: "#fff", fontWeight: 700, marginLeft: "30px" }}>9:41</div>
             <div style={{ display: "flex", gap: "6px", marginRight: "30px" }}><WifiHigh size={12} color="var(--ui-text-primary)" /><Cpu size={12} color="var(--ui-text-primary)" /></div>
          </div>
          <div style={{ flex: 1, background: "#fff", margin: "4px", borderRadius: "36px", overflowY: "auto", padding: "20px" }}>
             {designMd ? <DesignMdRenderer designMd={designMd} uiStream='[v:stack [v:card title="Mobile View" [v:metric label="Active" val="Simulated"]]]' /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.2 }}><DeviceMobile size={64} /></div>}
          </div>
          <div style={{ position: "absolute", bottom: "10px", left: "50%", transform: "translateX(-50%)", width: "100px", height: "4px", background: "rgba(255,255,255,0.2)", borderRadius: "2px" }} />
       </div>
    </div>
  );
}

// ─── Main Studio Component ───────────────────────────────────────────────────

export default function DesignModeView() {
  useNav();
  const [showWizard, setShowWizard] = useState(true);
  const [showCutscene, setShowCutscene] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<CanvasTab>("questions");
  const [showTweaks, setShowTweaks] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [designMd, setDesignMd] = useState<string | null>(null);
  const [uiStream, setUiStream] = useState<string | null>(null);
  const [tokens, setTokens] = useState({ radius: 12, spacing: 4, primary: 'var(--accent-primary)', font: 'Inter' });
  const [, _setIsManifesting] = useState(false);
  const [graphData] = useState({ nodes: [], links: [] });
  const [darkMode, setDarkMode] = useState(true);
  const [showClipboard, setShowClipboard] = useState(false);

  const { createSession, sendMessageStream, loadSessions } = useDesignSessionActions();
  const activeSessionId = useDesignSessionStore(s => s.activeSessionId);
  const activeSession = useDesignSessionStore(s => s.sessions.find(x => x.id === activeSessionId));
  const backendMessages = activeSession?.messages || [];
  const isStreaming = useDesignSessionStore(s => s.streamingBySession[activeSessionId || '']?.isStreaming);

  const tokenStyles = useMemo(() => ({
    '--design-radius-base': `${tokens.radius}px`,
    '--design-radius-card': `${tokens.radius * 1.5}px`,
    '--design-radius-button': `${tokens.radius * 0.75}px`,
    '--design-color-primary': tokens.primary,
    '--design-spacing-unit': `${tokens.spacing}px`,
    '--design-type-fontFamily': tokens.font
  } as React.CSSProperties), [tokens]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Sync real graph data
  useEffect(() => {
     if (activeTab === 'graph' && activeSessionId) {
        sendMessageStream(activeSessionId, { text: "[Trigger: Graph Data] Please execute skill_graph_ops action='get_graph_data' to update the visual map." });
     }
  }, [activeTab, activeSessionId, sendMessageStream]);

  useEffect(() => {
    if (!backendMessages.length) return;
    const lastAsstMsg = [...backendMessages].reverse().find(m => m.role === 'assistant');
    if (lastAsstMsg) {
      const content = lastAsstMsg.content || '';
      const mdMatch = content.match(/# Brand:[\s\S]*?## Radii[\s\S]*?px/);
      if (mdMatch) setDesignMd(mdMatch[0]);
      const uiMatch = content.match(/\\?\[v:[\s\S]*/);
      if (uiMatch) setUiStream(uiMatch[0]);
    }
  }, [backendMessages]);

  async function startProject(config: any) {
    const isContent = config.type === 'content-engine';
    setActiveProject({
      id: Date.now().toString(), name: config.name, type: config.type, specialist: config.specialist, fidelity: config.fidelity, activeTabId: isContent ? 'graph' : 'questions',
      tabs: [
        { id: 'questions', label: 'Discovery', type: 'questions' as CanvasTab },
        { id: 'mobile', label: 'Mobile View', type: 'mobile' as CanvasTab },
        { id: 'video', label: 'Video Editor', type: 'video' as CanvasTab },
        { id: 'docs', label: 'Documents', type: 'docs' as CanvasTab },
        ...(isContent ? [{ id: 'graph', label: 'Skill Graph', type: 'graph' as CanvasTab }, { id: 'pipeline', label: 'Pipeline', type: 'pipeline' as CanvasTab }] : []),
        { id: 'team', label: 'Team', type: 'team' as CanvasTab },
        { id: 'handoff', label: 'Handoff', type: 'handoff' as CanvasTab }
      ]
    });
    const sessionId = await createSession({ name: config.name, sessionMode: 'agent' });
    if (isContent) {
       await sendMessageStream(sessionId, { text: `[Trigger: Context Sync] I am starting a Content Engine project. Please run skill_graph_ops action="sync" to read /content-skill-graph/index.md.` });
    } else {
       await sendMessageStream(sessionId, { text: `I am the user starting a ${config.type} project. You are the ${config.specialist} agent. Ping the "Growth Hacker" for review.` });
    }
  }

  if (showWizard) return <StudioOnboardingWizard onComplete={() => { setShowWizard(false); setShowCutscene(true); }} onSkip={() => { setShowWizard(false); setShowCutscene(true); }} />;
  if (showCutscene) return <StudioOnboarding onComplete={() => setShowCutscene(false)} />;
  if (!activeProject) return <DiscoveryHub onStart={startProject} />;

  const themeOverride = darkMode ? {} : {
    '--bg-primary': '#fdfcf9',
    '--bg-secondary': '#f4f4f0',
    '--text-primary': '#111',
    '--text-secondary': '#444',
    '--border-subtle': 'rgba(0,0,0,0.07)',
    '--border-default': 'rgba(0,0,0,0.12)',
    '--surface-panel': '#fff',
    '--surface-hover': 'rgba(0,0,0,0.04)',
  } as React.CSSProperties;

  return (
    <div style={{ ...tokenStyles, ...themeOverride, display: "flex", height: "100%", width: "100%", background: "var(--bg-primary)", fontFamily: "var(--font-sans)", color: "var(--text-primary)", transition: "background 0.3s, color 0.3s" }}>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={25} minSize={20}>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", borderRight: "1px solid var(--border-subtle)", background: "var(--surface-panel)" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><MagicWand size={16} color="var(--accent-primary)" weight="fill" /><span style={{ fontSize: "13px", fontWeight: 700 }}>{activeProject.specialist} agent</span></div>
               <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: isStreaming ? "var(--accent-primary)" : "#22c55e", animation: isStreaming ? "pulse 1.5s infinite" : "none" }} />
            </div>
            <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px" }}>
               <SwarmInspect logs={[
                  { agent: 'Architect', action: 'Constructing Layout', status: 'OK' },
                  { agent: 'Growth', action: 'Auditing CTAs', status: 'Ready' }
               ]} />
               {backendMessages.map(m => (
                 <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 800, opacity: 0.3 }}>{m.role.toUpperCase()}</div>
                    <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.content?.replace(/\\?\[v:[\s\S]*/, '[Visual Interface Generated]')}</div>
                 </div>
               ))}
            </div>
            <div style={{ padding: "24px" }}><div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-default)", borderRadius: "16px", padding: "8px" }}><textarea value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message studio agent..." style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: "13px", minHeight: "60px", fontFamily: "inherit" }} /><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><button style={{ background: "none", border: "none", color: "var(--surface-panel)" }}><Paperclip size={18} /></button><button onClick={() => sendMessageStream(activeSessionId!, { text: chatInput })} style={{ padding: "8px 20px", borderRadius: "10px", background: "var(--text-primary)", color: "var(--bg-primary)", fontWeight: 700, border: "none", fontSize: "12px", cursor: "pointer" }}>Send</button></div></div></div>
          </div>
        </Panel>
        <PanelResizeHandle />
        <Panel>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-secondary)" }}>
            <header style={{ height: "56px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-panel)", display: "flex", alignItems: "center", padding: "0 16px", gap: "8px" }}>
               {activeProject.tabs.map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id as CanvasTab)} style={{ border: "none", background: activeTab === tab.id ? "var(--bg-secondary)" : "transparent", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", padding: "8px 16px", borderRadius: "8px 8px 0 0", cursor: "pointer", borderTop: activeTab === tab.id ? "1px solid var(--border-subtle)" : "1px solid transparent" }}>{tab.label}</button>
               ))}
               <div style={{ flex: 1 }} />
               <button onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Light mode" : "Dark mode"} style={{ width: "36px", height: "36px", borderRadius: "18px", background: "var(--surface-panel)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>
               <button onClick={() => { setShowClipboard(!showClipboard); setShowTweaks(false); }} title="Design Clipboard" style={{ width: "36px", height: "36px", borderRadius: "18px", background: showClipboard ? "var(--accent-primary)" : "var(--surface-panel)", color: showClipboard ? "var(--bg-primary)" : "var(--text-primary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Scissors size={16} /></button>
               <button onClick={() => { setShowTweaks(!showTweaks); setShowClipboard(false); }} title="Live Tokens" style={{ width: "36px", height: "36px", borderRadius: "18px", background: showTweaks ? "var(--accent-primary)" : "var(--surface-panel)", color: showTweaks ? "var(--bg-primary)" : "var(--text-primary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Sliders size={18} /></button>
            </header>
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
               <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
                  <div style={{ padding: "40px", height: "100%" }}>
                     {isStreaming && <GenerativeLoader title="Manifesting high-fidelity UI..." />}
                     {!isStreaming && (
                       <>
                        {activeTab === 'mobile' && <MobileSimulator designMd={designMd} />}
                        {activeTab === 'video' && <VideoEditorView />}
                        {activeTab === 'docs' && <OfficeWorkspace />}
                        {activeTab === 'team' && <DesignTeamWorkspace projectName={activeProject?.name} />}
                        {activeTab === 'graph' && <div className="w-full h-full p-12 bg-zinc-950 rounded-3xl border border-white/5 relative">{React.createElement(componentRegistry['v:skill-graph'], { nodes: graphData.nodes.length ? graphData.nodes : [{ id: 'idx', label: 'Command Center', x: 400, y: 50 }, { id: 'x', label: 'X', x: 200, y: 200 }, { id: 'li', label: 'LinkedIn', x: 400, y: 200 }, { id: 'tt', label: 'TikTok', x: 600, y: 200 }], links: graphData.links.length ? graphData.links : [{ from: 'idx', to: 'x' }, { from: 'idx', to: 'li' }, { from: 'idx', to: 'tt' }] })}</div>}
                        {activeTab === 'pipeline' && <div className="max-w-3xl mx-auto flex flex-col gap-6"><h1 className="text-2xl font-black">Ship content nodes</h1>{React.createElement(componentRegistry['v:pipeline'], { items: [{ platform: 'X / Twitter', status: 'Ready' }, { platform: 'LinkedIn', status: 'Ready' }, { platform: 'TikTok', status: 'Generating' }] })}</div>}
                        {(activeTab === 'questions' || activeTab === 'handoff' || !designMd) && (
                           <div className="w-full h-full bg-white rounded-[var(--design-radius-card)] shadow-2xl border border-zinc-100 p-8">
                              {designMd && uiStream ? <DesignMdRenderer designMd={designMd} uiStream={uiStream} /> : <div className="w-full h-full flex flex-col items-center justify-center text-center"><div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-6"><MagicWand size={48} weight="duotone" color="var(--accent-primary)" /></div><h3 className="text-lg font-bold">Awaiting manifestation</h3></div>}
                           </div>
                        )}
                       </>
                     )}
                  </div>
               </div>
               <AnimatePresence>
                 {showTweaks && (
                   <motion.aside initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }} style={{ width: "300px", background: "#16161a", color: "#fff", padding: "24px", display: "flex", flexDirection: "column", gap: "32px", margin: "16px", borderRadius: "16px", border: "1px solid var(--surface-hover)", boxShadow: "0 32px 64px rgba(0,0,0,0.4)" }}>
                     <div><div style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: "0.2em", marginBottom: "20px" }}>LIVE TOKENS</div><div style={{ display: "flex", flexDirection: "column", gap: "24px" }}><TokenSlider label="Corner Radius" value={tokens.radius} unit="px" onChange={(v: any) => setTokens({...tokens, radius: v})} /><TokenSlider label="Grid Spacing" value={tokens.spacing} unit="px" min={2} max={12} onChange={(v: any) => setTokens({...tokens, spacing: v})} /></div></div>
                     <div style={{ marginTop: "auto", padding: "16px", background: "var(--surface-hover)", borderRadius: "12px", border: "1px solid var(--surface-hover)" }}><div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}><ShieldCheck size={14} color="var(--status-success)" /> Agent Link Active</div><div style={{ fontSize: "10px", opacity: 0.4 }}>Changes propagate in real-time.</div></div>
                   </motion.aside>
                 )}
                 {showClipboard && (
                   <motion.div key="clipboard" initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }} style={{ width: "280px", margin: "16px 16px 16px 0", borderRadius: "16px", overflow: "hidden" }}>
                     <DesignClipboardSidebar
                       onPaste={(content) => { setChatInput(content); }}
                       activeContent={{ design: designMd || undefined, ui: uiStream || undefined }}
                     />
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

function TokenSlider({ label, value, unit, onChange, min = 0, max = 32 }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{label}</span><span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{value}{unit}</span></div>
       <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} style={{ width: "100%", accentColor: "var(--accent-primary)", height: "2px" }} />
    </div>
  );
}
