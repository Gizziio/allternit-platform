"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, Paperclip, Sliders, MagicWand, Sun, Moon, Scissors, ArrowRight,
  UsersThree, TreeStructure, Target, Megaphone, ShieldCheck, UploadSimple, Plus
} from "@phosphor-icons/react";
import { DesignClipboardSidebar } from "./DesignClipboardSidebar";
import { useNav } from "../../nav/useNav";
import { useDesignSessionStore, useDesignSessionActions } from "./DesignSessionStore";
import { NewProjectScreen } from './NewProjectScreen';

// Imports for built features
import { DesignMdRenderer } from "../../lib/openui/DesignMdRenderer";
import { VideoEditorView } from "./video/VideoEditorView";
import { OfficeWorkspace } from "./office/OfficeWorkspace";
import { StudioOnboardingWizard } from "./StudioOnboardingWizard";
import { DesignTeamWorkspace } from "./DesignTeamWorkspace";
import { DesignSystemView } from "./DesignSystemView";
import { DesignHandoffView } from "./DesignHandoffView";
import { MobilePreviewView } from "./mobile/MobilePreviewView";
import { DesignRegistryView } from "./DesignRegistryView";
import type { DesignSystem } from "../../lib/design/design-registry";
import { BrandKitEditor } from "./office/BrandKitEditor";
import { DesignImportModal } from "./DesignImportModal";
import { ContentSkillGraphView } from "./graph/ContentSkillGraphView";
import { ContentPipelineView } from "./ContentPipelineView";
import { StudioMessageRenderer } from "../../components/design/StudioMessageRenderer";
import { composeStudioSystemPrompt } from "../../lib/design/studio-system-prompt";
import { DesignTldrawCanvas } from "./DesignTldrawCanvas";
import { LiveArtifactEditor } from "./LiveArtifactEditor";
import { OrbitView } from "./OrbitView";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectType = 'prototype' | 'slides' | 'content-engine' | 'template' | 'other';
type CanvasTab = 'system' | 'files' | 'questions' | 'sketch' | 'mobile' | 'video' | 'docs' | 'handoff' | 'graph' | 'pipeline' | 'team' | 'market' | 'brand' | 'live' | 'orbit';
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

interface DesignModeViewProps {
  initialTab?: CanvasTab;
  initialDesignMd?: string;
  initialStream?: string;
}

function buildDirectProject(initialTab: CanvasTab): Project {
  const isContent = initialTab === 'graph' || initialTab === 'pipeline';
  return {
    id: `direct-${initialTab}`,
    name: isContent ? 'Content Studio' : 'Design Studio',
    type: isContent ? 'content-engine' : 'prototype',
    specialist: 'architect',
    fidelity: 'high',
    activeTabId: initialTab,
    tabs: [
      { id: 'questions', label: 'Discovery', type: 'questions' },
      { id: 'mobile', label: 'Mobile View', type: 'mobile' },
      { id: 'video', label: 'Video Editor', type: 'video' },
      { id: 'docs', label: 'Documents', type: 'docs' },
      ...(isContent
        ? [
            { id: 'graph', label: 'Skill Graph', type: 'graph' as CanvasTab },
            { id: 'pipeline', label: 'Pipeline', type: 'pipeline' as CanvasTab },
          ]
        : []),
      { id: 'team', label: 'Team', type: 'team' },
      { id: 'handoff', label: 'Handoff', type: 'handoff' },
    ],
  };
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
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "var(--bg-primary)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
       <button
          onClick={onComplete}
          style={{ position: "absolute", bottom: "48px", right: "32px", padding: "8px 16px", borderRadius: "20px", background: "var(--surface-hover)", border: "none", fontSize: "12px", fontWeight: 700, color: "var(--text-tertiary)", cursor: "pointer", zIndex: 1101 }}
       >
          Skip intro
       </button>
       <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }} style={{ textAlign: "center", width: "100%", maxWidth: "800px" }}>
             <h1 style={{ fontSize: "42px", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text-primary)", marginBottom: "16px" }}>{sequence[step]?.title}</h1>
             <p style={{ fontSize: "18px", color: "var(--text-secondary)", fontWeight: 500 }}>{sequence[step]?.sub}</p>
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

// ─── Main Studio Component ───────────────────────────────────────────────────

export default function DesignModeView({ initialTab, initialDesignMd, initialStream }: DesignModeViewProps) {
  useNav();
  const hasInstallContext = Boolean(initialDesignMd || initialStream);
  const [showWizard, setShowWizard] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (hasInstallContext) return false;
    return !localStorage.getItem('allternit-design-onboarded');
  });
  const [showCutscene, setShowCutscene] = useState(false);
  const [activeProject, setActiveProject] = useState<Project | null>(
    initialTab ? buildDirectProject(initialTab)
    : initialDesignMd ? buildDirectProject('system')
    : null,
  );
  const [activeTab, setActiveTab] = useState<CanvasTab>(
    initialTab ?? (initialDesignMd ? 'system' : 'questions')
  );
  const [showTweaks, setShowTweaks] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [designMd, setDesignMd] = useState<string | null>(initialDesignMd ?? null);
  const [uiStream, setUiStream] = useState<string | null>(initialStream ?? null);
  const [tokens, setTokens] = useState({ radius: 12, spacing: 4, primary: 'var(--accent-primary)', font: 'Allternit Sans' });
  const [darkMode, setDarkMode] = useState(true);
  const [showClipboard, setShowClipboard] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [installedDesignId, setInstalledDesignId] = useState<string | null>(null);

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

  useEffect(() => {
    if (!initialTab) return;
    setActiveTab(initialTab);
    setShowWizard(false);
    setShowCutscene(false);
    setActiveProject((current) => current ?? buildDirectProject(initialTab));
  }, [initialTab]);

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

  function handleInstallDesign(design: DesignSystem) {
    setInstalledDesignId(design.id);
    setDesignMd(design.designMd);
    setActiveTab('questions');
    if (activeSessionId) {
      sendMessageStream(activeSessionId, {
        text: `[Design System Installed: ${design.name}]\n\nPlease adopt the following design specification for this project. Use its color palette, typography, spacing, and component patterns as the ground truth for all future generations.\n\n${design.designMd}`,
      });
    }
  }

  async function startProject(config: { name: string; type: string; direction?: import('../../lib/design/directions').DesignDirection }) {
    const isContent = config.type === 'content-engine';
    setActiveProject({
      id: Date.now().toString(), name: config.name, type: config.type as ProjectType,
      specialist: 'architect', fidelity: 'high', activeTabId: isContent ? 'graph' : 'questions',
      tabs: [
        { id: 'questions', label: 'Discovery',     type: 'questions' as CanvasTab },
        { id: 'sketch',    label: 'Canvas',         type: 'sketch'    as CanvasTab },
        { id: 'system',    label: 'Design System',  type: 'system'    as CanvasTab },
        { id: 'mobile',    label: 'Mobile',         type: 'mobile'    as CanvasTab },
        { id: 'video',     label: 'Video',          type: 'video'     as CanvasTab },
        { id: 'docs',      label: 'Documents',      type: 'docs'      as CanvasTab },
        ...(isContent ? [
          { id: 'graph',    label: 'Skill Graph', type: 'graph'    as CanvasTab },
          { id: 'pipeline', label: 'Pipeline',    type: 'pipeline' as CanvasTab },
        ] : []),
        { id: 'brand',   label: 'Brand',       type: 'brand'   as CanvasTab },
        { id: 'team',    label: 'Team',         type: 'team'    as CanvasTab },
        { id: 'handoff', label: 'Handoff',      type: 'handoff' as CanvasTab },
        { id: 'market',  label: 'Marketplace',  type: 'market'  as CanvasTab },
        { id: 'live',    label: 'Live',         type: 'live'    as CanvasTab },
        { id: 'orbit',   label: 'Orbit',        type: 'orbit'   as CanvasTab },
      ]
    });
    const dir = config.direction;
    const directionMd = dir
      ? `## Visual Direction: ${dir.label}\n${dir.mood}\n\nDisplay font: ${dir.displayFont}\nBody font: ${dir.bodyFont}${dir.monoFont ? `\nMono font: ${dir.monoFont}` : ''}\n\nPalette:\n- Background: ${dir.palette.bg}\n- Surface: ${dir.palette.surface}\n- Foreground: ${dir.palette.fg}\n- Accent: ${dir.palette.accent}\n\nReferences: ${dir.references.join(', ')}\n\nPosture:\n${dir.posture.map(p => `- ${p}`).join('\n')}`
      : undefined;
    const systemPrompt = composeStudioSystemPrompt({
      designSystemBody: directionMd,
      designSystemTitle: dir?.label,
      isDeckSession: config.type === 'slides',
    });
    const sessionId = await createSession({ name: config.name, sessionMode: 'agent', systemPrompt });
    if (isContent) {
      await sendMessageStream(sessionId, { text: `[Trigger: Context Sync] I am starting a Content Engine project called "${config.name}". Please run skill_graph_ops action="sync" to read /content-skill-graph/index.md.` });
    } else {
      const dirContext = dir ? ` The visual direction is "${dir.label}" — ${dir.mood}. Key references: ${dir.references.join(', ')}.` : '';
      await sendMessageStream(sessionId, { text: `I am starting a ${config.type} project called "${config.name}".${dirContext} Please begin with a discovery brief.` });
    }
  }

  const completeWizard = () => {
    localStorage.setItem('allternit-design-onboarded', '1');
    setShowWizard(false);
    setShowCutscene(true);
  };
  if (showWizard) return <StudioOnboardingWizard onComplete={completeWizard} onSkip={completeWizard} />;
  if (showCutscene) return <StudioOnboarding onComplete={() => setShowCutscene(false)} />;
  if (!activeProject) return <NewProjectScreen onStart={startProject} />;

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
        <Panel>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-secondary)" }}>
            <header style={{ height: "56px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-panel)", display: "flex", alignItems: "center", padding: "0 16px", gap: "8px" }}>
               {activeProject.tabs.map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id as CanvasTab)} style={{ border: "none", background: activeTab === tab.id ? "var(--bg-secondary)" : "transparent", fontSize: "12px", fontWeight: 600, color: "var(--text-secondary)", padding: "8px 16px", borderRadius: "8px 8px 0 0", cursor: "pointer", borderTop: activeTab === tab.id ? "1px solid var(--border-subtle)" : "1px solid transparent" }}>{tab.label}</button>
               ))}
               <div style={{ flex: 1 }} />
               <button onClick={() => { setActiveProject(null); setActiveTab('questions'); }} title="New Project" style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", height: "30px", borderRadius: "8px", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}><Plus size={12} weight="bold" /> New Project</button>
               <button onClick={() => setShowImport(true)} title="Import design system" style={{ width: "36px", height: "36px", borderRadius: "18px", background: "var(--surface-panel)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><UploadSimple size={16} /></button>
               <button onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Light mode" : "Dark mode"} style={{ width: "36px", height: "36px", borderRadius: "18px", background: "var(--surface-panel)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>
               <button onClick={() => { setShowClipboard(!showClipboard); setShowTweaks(false); }} title="Design Clipboard" style={{ width: "36px", height: "36px", borderRadius: "18px", background: showClipboard ? "var(--accent-primary)" : "var(--surface-panel)", color: showClipboard ? "var(--bg-primary)" : "var(--text-primary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Scissors size={16} /></button>
               <button onClick={() => { setShowTweaks(!showTweaks); setShowClipboard(false); }} title="Live Tokens" style={{ width: "36px", height: "36px", borderRadius: "18px", background: showTweaks ? "var(--accent-primary)" : "var(--surface-panel)", color: showTweaks ? "var(--bg-primary)" : "var(--text-primary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Sliders size={18} /></button>
            </header>
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
               <div style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
                  {isStreaming && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--bg-primary)' }}>
                      <GenerativeLoader title="Manifesting high-fidelity UI..." />
                    </div>
                  )}
                  {/* Full-bleed tabs — no padding wrapper */}
                  {activeTab === 'sketch' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <DesignTldrawCanvas projectName={activeProject?.name} />
                    </div>
                  )}
                  {activeTab === 'system' && (
                    <div style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
                      <DesignSystemView projectName={activeProject.name} />
                    </div>
                  )}
                  {activeTab === 'handoff' && (
                    <div style={{ flex: 1, overflowY: 'auto', height: '100%' }}>
                      <DesignHandoffView projectName={activeProject.name} />
                    </div>
                  )}
                  {activeTab === 'mobile' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <MobilePreviewView projectName={activeProject.name} />
                    </div>
                  )}
                  {activeTab === 'video' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <VideoEditorView />
                    </div>
                  )}
                  {activeTab === 'docs' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <OfficeWorkspace projectName={activeProject.name} />
                    </div>
                  )}
                  {activeTab === 'market' && (
                    <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
                      <DesignRegistryView onInstall={handleInstallDesign} installedId={installedDesignId ?? undefined} />
                    </div>
                  )}
                  {activeTab === 'brand' && (
                    <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
                      <BrandKitEditor projectName={activeProject.name} />
                    </div>
                  )}
                  {activeTab === 'graph' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <ContentSkillGraphView />
                    </div>
                  )}
                  {activeTab === 'pipeline' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <ContentPipelineView projectName={activeProject?.name} />
                    </div>
                  )}
                  {activeTab === 'live' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <LiveArtifactEditor />
                    </div>
                  )}
                  {activeTab === 'orbit' && (
                    <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
                      <OrbitView
                        projectName={activeProject?.name}
                        sessionSendMessage={activeSessionId ? (text) => sendMessageStream(activeSessionId, { text }) : undefined}
                        activeSessionId={activeSessionId}
                      />
                    </div>
                  )}
                  {/* Padded tabs */}
                  {!['sketch', 'system', 'handoff', 'mobile', 'video', 'docs', 'market', 'brand', 'graph', 'pipeline', 'live', 'orbit'].includes(activeTab) && (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '40px' }}>
                      {activeTab === 'team' && <DesignTeamWorkspace projectName={activeProject?.name} />}
                      {activeTab === 'questions' && (
                        <div style={{ width: '100%', height: '100%', borderRadius: 'var(--design-radius-card)', background: 'var(--surface-panel)', border: '1px solid var(--border-subtle)', padding: 32, boxSizing: 'border-box', overflowY: 'auto' }}>
                          {designMd && uiStream ? (
                            <DesignMdRenderer designMd={designMd} uiStream={uiStream} />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: 16 }}>
                              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <MagicWand size={36} weight="duotone" color="var(--accent-primary)" />
                              </div>
                              <div>
                                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Ready to design</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 320 }}>
                                  Describe your project in the chat — the agent will ask discovery questions and build your design system.
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 400, marginTop: 8 }}>
                                {['Wireframe a landing page', 'Build a dashboard UI', 'Design a mobile app', 'Create a brand system'].map(prompt => (
                                  <button
                                    key={prompt}
                                    onClick={() => { setChatInput(prompt); }}
                                    style={{ padding: '7px 14px', borderRadius: 20, border: '1px solid var(--border-default)', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                  >
                                    {prompt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
               </div>
               <AnimatePresence>
                 {showTweaks && (
                   <motion.aside initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }} style={{ width: "300px", background: "var(--surface-panel)", color: "var(--text-primary)", padding: "24px", display: "flex", flexDirection: "column", gap: "32px", margin: "16px", borderRadius: "16px", border: "1px solid var(--border-subtle)", boxShadow: "0 32px 64px rgba(0,0,0,0.15)" }}>
                     <div><div style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-tertiary)", letterSpacing: "0.2em", marginBottom: "20px" }}>LIVE TOKENS</div><div style={{ display: "flex", flexDirection: "column", gap: "24px" }}><TokenSlider label="Corner Radius" value={tokens.radius} unit="px" onChange={(v: any) => setTokens({...tokens, radius: v})} /><TokenSlider label="Grid Spacing" value={tokens.spacing} unit="px" min={2} max={12} onChange={(v: any) => setTokens({...tokens, spacing: v})} /></div></div>
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
        <PanelResizeHandle />
        <Panel defaultSize={25} minSize={20}>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", borderLeft: "1px solid var(--border-subtle)", background: "var(--surface-panel)" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><MagicWand size={16} color="var(--accent-primary)" weight="fill" /><span style={{ fontSize: "13px", fontWeight: 700 }}>{activeProject.specialist} agent</span></div>
               <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: isStreaming ? "var(--accent-primary)" : "#22c55e", animation: isStreaming ? "pulse 1.5s infinite" : "none" }} />
            </div>
            <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px" }}>
               {backendMessages.length === 0 && !isStreaming ? null : (
                 <SwarmInspect logs={[
                   { agent: activeProject.specialist, action: isStreaming ? 'Generating response…' : `${backendMessages.length} message${backendMessages.length !== 1 ? 's' : ''}`, status: isStreaming ? '…' : 'OK' },
                 ]} />
               )}
               {backendMessages.map((m, idx) => (
                 <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 800, opacity: 0.3, letterSpacing: '0.08em' }}>{m.role.toUpperCase()}</div>
                    <StudioMessageRenderer
                      message={m}
                      isLast={idx === backendMessages.length - 1}
                      onSubmitForm={(text) => {
                        if (activeSessionId) {
                          sendMessageStream(activeSessionId, { text });
                        }
                      }}
                    />
                 </div>
               ))}
            </div>
            <div style={{ padding: "24px" }}>
              <div style={{ background: "var(--surface-panel)", border: "1px solid var(--border-default)", borderRadius: "16px", padding: "8px" }}>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message studio agent..." style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: "13px", minHeight: "60px", fontFamily: "inherit", background: "transparent", color: "var(--text-primary)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}><Paperclip size={18} /></button>
                  <button onClick={() => { if (chatInput.trim() && activeSessionId) { sendMessageStream(activeSessionId, { text: chatInput }); setChatInput(''); } }} style={{ padding: "8px 20px", borderRadius: "10px", background: "var(--text-primary)", color: "var(--bg-primary)", fontWeight: 700, border: "none", fontSize: "12px", cursor: "pointer" }}>Send</button>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </PanelGroup>

      {showImport && (
        <DesignImportModal
          onClose={() => setShowImport(false)}
          onImport={(design) => {
            setShowImport(false);
            if (activeSessionId) {
              sendMessageStream(activeSessionId, {
                text: `[Design Import] Apply the imported design system: "${design.name}". ${design.designMd}`,
              });
            }
          }}
        />
      )}
    </div>
  );
}

function TokenSlider({ label, value, unit, onChange, min = 0, max = 32 }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>{label}</span><span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{value}{unit}</span></div>
       <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} style={{ width: "100%", accentColor: "var(--accent-primary)", height: "2px" }} />
    </div>
  );
}
