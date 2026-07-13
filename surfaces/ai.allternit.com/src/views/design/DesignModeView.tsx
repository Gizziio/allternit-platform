// @ts-nocheck
"use client";

import React, { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, MagicWand, Sun, Moon, Scissors,
  TreeStructure, Megaphone, ShieldCheck, UploadSimple, Plus, PuzzlePiece
} from "@phosphor-icons/react";
import { DesignClipboardSidebar } from "./DesignClipboardSidebar";
import { useNav } from "../../nav/useNav";
import { useDesignSessionStore, useDesignSessionActions, createDesignSession } from "./DesignSessionStore";
import { useDesignTabStore } from "../../stores/design-tab.store";
import { NewProjectScreen } from './NewProjectScreen';
import { SkillPicker } from './SkillPicker';
import { SkillParameterPanel } from '../../components/design/SkillParameterPanel';
import { SurgicalEditPanel } from '../../components/design/SurgicalEditPanel';
import { DesignCritiquePanel } from '../../components/design/DesignCritiquePanel';
import { AgentAdapterPanel } from '../../components/design/AgentAdapterPanel';
import { PluginPicker } from './PluginPicker';
import type { SkillRecord } from '../../lib/design/skill-registry';
import type { SurgicalComment } from '../../lib/design/surgical-edit';
import { buildSurgicalEditPrompt } from '../../lib/design/surgical-edit';

// Imports for built features
import { DesignMdRenderer } from "../../lib/openui/DesignMdRenderer";
import { StudioOnboardingWizard } from "./StudioOnboardingWizard";
import { DesignTeamWorkspace } from "./DesignTeamWorkspace";
import { DesignSystemView } from "./DesignSystemView";
import { DesignHandoffView } from "./DesignHandoffView";
import type { DesignSystem } from "../../lib/design/design-registry";
import { DesignImportModal } from "./DesignImportModal";
import { composeStudioSystemPrompt } from "../../lib/design/studio-system-prompt";
import { ErrorBoundary } from "../../components/design/ErrorBoundary";
import { splitOnArtifacts } from "../../lib/openui/artifact-parser";

// Parity with Chat/Cowork composer stack
import { ChatComposer } from "../chat/ChatComposer";
// Integrated Allternit Design component (consumed with Allternit tokens via .ad-tokens)
import { Button as ODButton } from "@/allternit-design/components";


import { useModeCanvasBridge } from "@/hooks/useModeCanvasBridge";
import { type Agent } from "@/lib/agents";
import { useSurfaceAgentSelection } from "@/lib/agents/surface-agent-context";
import { useAgentSurfaceModeStore } from "@/stores/agent-surface-mode.store";
import { HarnessConfigPanel } from "@/views/cowork/HarnessConfigPanel";
import { ChatIdProvider } from "@/providers/chat-id-provider";
import { DataStreamProvider } from "@/providers/data-stream-provider";
import { MessageTreeProvider } from "@/providers/message-tree-provider";
import { ChatInputProvider } from "@/providers/chat-input-provider";
import { PromptInputProvider } from "@/components/ai-elements/prompt-input";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { ModelSelectionProvider } from "@/providers/model-selection-provider";
import { useDefaultModelSelection } from "@/hooks/use-default-model-selection";

const VideoEditorView = lazy(() => import("./video/VideoEditorView").then((m) => ({ default: m.VideoEditorView })));
const OfficeWorkspace = lazy(() => import("./office/OfficeWorkspace").then((m) => ({ default: m.OfficeWorkspace })));
const MobilePreviewView = lazy(() => import("./mobile/MobilePreviewView").then((m) => ({ default: m.MobilePreviewView })));
const DesignRegistryView = lazy(() => import("./DesignRegistryView").then((m) => ({ default: m.DesignRegistryView })));
const BrandKitEditor = lazy(() => import("./office/BrandKitEditor").then((m) => ({ default: m.BrandKitEditor })));
const ContentSkillGraphView = lazy(() => import("./graph/ContentSkillGraphView").then((m) => ({ default: m.ContentSkillGraphView })));
const ContentPipelineView = lazy(() => import("./ContentPipelineView").then((m) => ({ default: m.ContentPipelineView })));
const DesignTldrawCanvas = lazy(() => import("./DesignTldrawCanvas").then((m) => ({ default: m.DesignTldrawCanvas })));
const LiveArtifactEditor = lazy(() => import("./LiveArtifactEditor").then((m) => ({ default: m.LiveArtifactEditor })));
const OrbitView = lazy(() => import("./OrbitView").then((m) => ({ default: m.OrbitView })));
const ProjectFileWorkspace = lazy(() => import("./ProjectFileWorkspace").then((m) => ({ default: m.ProjectFileWorkspace })));
const HyperFramesTimelineEditor = lazy(() => import("./HyperFramesTimelineEditor").then((m) => ({ default: m.HyperFramesTimelineEditor })));

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectType =
  | 'prototype'
  | 'slides'
  | 'mobile'
  | 'brand'
  | 'dashboard'
  | 'content-engine'
  | 'template'
  | 'other';
type CanvasTab = 'files' | 'system' | 'questions' | 'sketch' | 'mobile' | 'video' | 'docs' | 'handoff' | 'graph' | 'pipeline' | 'team' | 'market' | 'brand' | 'live' | 'orbit' | 'hyperframes' | 'critique';
type Specialist = 'architect' | 'growth' | 'purist' | 'creative';
type OfficeDocType = 'slides' | 'spreadsheet' | 'document';

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

function getOfficeDocTypeForProject(type: ProjectType): OfficeDocType {
  switch (type) {
    case 'slides':
      return 'slides';
    case 'dashboard':
      return 'spreadsheet';
    default:
      return 'document';
  }
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
      { id: 'files', label: 'Files', type: 'files' as CanvasTab },
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
      { id: 'critique', label: 'Critique', type: 'critique' as CanvasTab },
      { id: 'live', label: 'Live', type: 'live' as CanvasTab },
      { id: 'orbit', label: 'Orbit', type: 'orbit' as CanvasTab },
      { id: 'hyperframes', label: 'HyperFrames', type: 'hyperframes' as CanvasTab },
    ],
  };
}

// ─── High-Fidelity Generative Loader ─────────────────────────────────────────

function GenerativeLoader({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--shell-view-bg)", gap: "32px" }}>
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

// ─── Studio Onboarding (The "Cutscene") ──────────────────────────────────────

function StudioOnboarding({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [typedText, setTypedText] = useState("");

  const sequence = useMemo(() => [
    { title: "Manifest your vision", sub: "Import your team's design DNA" },
    { title: "Design to Code", sub: "Build prototypes from a single prompt", prompt: "Mock up a glass-morphism banking dashboard" },
    { title: "Design to Content", sub: "Manifest 10 native social campaigns instantly", prompt: "Turn this design into a social campaign" },
    { title: "One Studio. All Surfaces.", sub: "Web, Mobile, Video, and Docs in one loop." }
  ], []);

  useEffect(() => {
    let nextStepTimeout: ReturnType<typeof setTimeout> | null = null;
    if (step === 0) nextStepTimeout = setTimeout(() => setStep(1), 3000);
    if (step === 4) onComplete();
    return () => {
      if (nextStepTimeout) clearTimeout(nextStepTimeout);
    };
  }, [step, onComplete]);

  useEffect(() => {
    if (sequence[step]?.prompt) {
       setTypedText("");
       let i = 0;
       let advanceTimeout: ReturnType<typeof setTimeout> | null = null;
       const interval = setInterval(() => {
          setTypedText(sequence[step].prompt!.slice(0, i + 1));
          i++;
          if (i >= sequence[step].prompt!.length) {
             clearInterval(interval);
             advanceTimeout = setTimeout(() => setStep(s => s + 1), 2500);
          }
       }, 50);
       return () => {
         clearInterval(interval);
         if (advanceTimeout) clearTimeout(advanceTimeout);
       };
    }
  }, [step, sequence]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "var(--shell-view-bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-sans)" }}>
       <button type="button"
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

function TabLoadingState({ label = "Loading workspace…" }: { label?: string }) {
  return (
    <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--shell-view-bg)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600 }}>
      {label}
    </div>
  );
}

// ─── Main Studio Component ───────────────────────────────────────────────────

export default function DesignModeView({ initialTab, initialDesignMd, initialStream }: DesignModeViewProps) {
  useNav();
  const defaultSelection = useDefaultModelSelection();
  // Bridge mode tab selection to canvas/renderer opening (parity with Chat/Cowork)
  useModeCanvasBridge({ surface: 'design' });
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
  const [showTweaks, setShowTweaks] = useState(false);
  const [composerSeed, setComposerSeed] = useState("");
  const [designMd, setDesignMd] = useState<string | null>(initialDesignMd ?? null);
  const [uiStream, setUiStream] = useState<string | null>(initialStream ?? null);
  const [tokens, setTokens] = useState({ radius: 12, spacing: 4, primary: 'var(--accent-primary)', font: 'Allternit Sans' });
  const [darkMode, setDarkMode] = useState(true);
  const [designStudioLook, setDesignStudioLook] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('allternit-design-studio') === '1';
  });
  const toggleDesignStudioLook = () => {
    setDesignStudioLook((prev) => {
      const next = !prev;
      window.localStorage.setItem('allternit-design-studio', next ? '1' : '0');
      return next;
    });
  };
  const [showClipboard, setShowClipboard] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [installedDesignId, setInstalledDesignId] = useState<string | null>(null);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillRecord | null>(null);
  const [skillValues, setSkillValues] = useState<Record<string, unknown>>({});
  const [showPluginPicker, setShowPluginPicker] = useState(false);
  const [surgicalComments, setSurgicalComments] = useState<SurgicalComment[]>([]);
  const { selectedAgent } = useSurfaceAgentSelection('design');
  const [skillParameters, setSkillParameters] = useState<Record<string, number>>({});

  // Initialize parameter defaults when skill selection changes.
  useEffect(() => {
    if (!selectedSkill) {
      setSkillParameters({});
      return;
    }
    const defaults: Record<string, number> = {};
    for (const p of selectedSkill.parameters) {
      defaults[p.name] = p.default;
    }
    setSkillParameters(defaults);
  }, [selectedSkill]);

  const pendingProject = useDesignTabStore(s => s.pendingProject);
  const clearPendingProject = useDesignTabStore(s => s.clearPendingProject);

  const { sendMessageStream, loadSessions } = useDesignSessionActions();
  const activeSessionId = useDesignSessionStore(s => s.activeSessionId);
  const activeSession = useDesignSessionStore((s) => (s.sessions ?? []).find((x) => x.id === activeSessionId));
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

  // Latest artifact HTML for surgical edits / HyperFrames / plugin previews.
  const latestArtifactHtml = useMemo(() => {
    for (let i = backendMessages.length - 1; i >= 0; i--) {
      const msg = backendMessages[i];
      if (msg.role !== 'assistant') continue;
      const content = typeof msg.content === 'string' ? msg.content : '';
      const segments = splitOnArtifacts(content);
      for (let j = segments.length - 1; j >= 0; j--) {
        const seg = segments[j];
        if (seg.kind === 'artifact' && seg.artifact.type === 'text/html') {
          return seg.artifact.content;
        }
      }
    }
    return '';
  }, [backendMessages]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Sync state when initialTab prop changes.
  useEffect(() => {
    if (!initialTab) return;
    setActiveTab(initialTab);
    setShowWizard(false);
    setShowCutscene(false);
    setActiveProject((current) => current ?? buildDirectProject(initialTab));
  }, [initialTab]);

  // Extract design system markdown / UI stream when backend messages change.
  useEffect(() => {
    if (backendMessages.length === 0) return;
    const lastAsstMsg = [...backendMessages].reverse().find(m => m.role === 'assistant');
    if (!lastAsstMsg) return;
    const content = lastAsstMsg.content || '';
    // Extract design system markdown: look for # Brand or # Design System sections
    const mdMatch = content.match(/#\s*(?:Brand|Design System|Tokens)[\s\S]*?(?=\n#\s|\n<artifact|<\/?artifact|\z)/i);
    if (mdMatch) setDesignMd(mdMatch[0].trim());
    // Extract UI stream: look for v:card, v:metric, or similar stream syntax
    const uiMatch = content.match(/(?:\?\[v:|\[v:)[\s\S]*/);
    if (uiMatch) setUiStream(uiMatch[0].trim());
  }, [backendMessages]);

  // Bridge: DesignRailPanel → DesignModeView project creation
  useEffect(() => {
    if (!pendingProject) return;
    clearPendingProject();
    startProject({ name: pendingProject.name, type: pendingProject.type ?? 'prototype' });
  }, [pendingProject]);

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

  async function startProject(config: { name: string; type: string; direction?: import('../../lib/design/directions').DesignDirection; skill?: SkillRecord; skillValues?: Record<string, unknown> }) {
    const isContent = config.type === 'content-engine';
    const skill = config.skill;
    setActiveProject({
      id: Date.now().toString(), name: config.name, type: config.type as ProjectType,
      specialist: 'architect', fidelity: 'high', activeTabId: isContent ? 'graph' : 'questions',
      tabs: [
        { id: 'files',   label: 'Files',          type: 'files'     as CanvasTab },
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
        { id: 'critique', label: 'Critique',    type: 'critique' as CanvasTab },
        { id: 'market',  label: 'Marketplace',  type: 'market'  as CanvasTab },
        { id: 'live',    label: 'Live',         type: 'live'    as CanvasTab },
        { id: 'orbit',   label: 'Orbit',        type: 'orbit'   as CanvasTab },
        { id: 'hyperframes', label: 'HyperFrames', type: 'hyperframes' as CanvasTab },
      ]
    });
    const dir = config.direction;
    const directionMd = dir
      ? `## Visual Direction: ${dir.label}\n${dir.mood}\n\nDisplay font: ${dir.displayFont}\nBody font: ${dir.bodyFont}${dir.monoFont ? `\nMono font: ${dir.monoFont}` : ''}\n\nPalette:\n- Background: ${dir.palette.bg}\n- Surface: ${dir.palette.surface}\n- Foreground: ${dir.palette.fg}\n- Accent: ${dir.palette.accent}\n\nReferences: ${dir.references.join(', ')}\n\nPosture:\n${dir.posture.map(p => `- ${p}`).join('\n')}`
      : undefined;
    const systemPrompt = composeStudioSystemPrompt({
      designSystemBody: designMd ?? directionMd,
      designSystemTitle: installedDesignId ? 'Installed design system' : dir?.label,
      skillBody: skill?.body,
      skillName: skill?.name,
      craftRequirements: skill?.craft.requires,
      skillValues: { ...config.skillValues, ...skillParameters },
      isDeckSession: config.type === 'slides' || skill?.mode === 'deck',
    });
    const sessionId = await createDesignSession({ name: config.name, sessionMode: 'agent', systemPrompt });
    if (isContent) {
      await sendMessageStream(sessionId, { text: `[Trigger: Context Sync] I am starting a Content Engine project called "${config.name}". Please run skill_graph_ops action="sync" to read /content-skill-graph/index.md.` });
    } else if (skill) {
      const opener = skill.examplePrompt ?? `Run the ${skill.name} skill for this project.`;
      const inputs = skill.inputs.map((i) => `${i.label ?? i.name}: ${config.skillValues?.[i.name] ?? i.default ?? ''}`).join('\n');
      const params = skill.parameters.map((p) => `${p.label ?? p.name}: ${skillParameters[p.name] ?? p.default}`).join('\n');
      await sendMessageStream(sessionId, { text: `${opener}\n\nProject: ${config.name}\nType: ${config.type}${dir ? `\nDirection: ${dir.label}` : ''}\n\n${inputs ? `Inputs:\n${inputs}\n\n` : ''}${params ? `Parameters:\n${params}\n\n` : ''}Please begin with the skill workflow.` });
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
  if (!activeProject) return (
    <>
      <NewProjectScreen
        onStart={startProject}
        selectedSkill={selectedSkill}
        onSelectSkill={(skill) => { if (!skill) setShowSkillPicker(true); else setSelectedSkill(skill); }}
        skillValues={skillValues}
        onChangeSkillValues={setSkillValues}
      />
      {showSkillPicker && (
        <SkillPicker
          initialMode={selectedSkill?.mode}
          onSelect={(skill) => { setSelectedSkill(skill); setShowSkillPicker(false); }}
          onClose={() => setShowSkillPicker(false)}
        />
      )}
    </>
  );

  const themeOverride = darkMode ? {} : {
    '--bg-primary': '#fdfcf9',
    '--bg-secondary': '#f4f4f0',
    '--text-primary': '#111',
    '--text-secondary': '#444',
    '--text-tertiary': '#888',
    '--border-subtle': 'rgba(0,0,0,0.07)',
    '--border-default': 'rgba(0,0,0,0.12)',
    '--surface-panel': '#fff',
    '--surface-hover': 'rgba(0,0,0,0.04)',
    '--accent-primary': '#e27c59',
    '--status-success': '#22c55e',
  } as React.CSSProperties;

  return (
    <div className={designStudioLook ? 'od-design-studio' : ''} style={{ ...tokenStyles, ...themeOverride, display: "flex", height: "100%", width: "100%", background: "var(--shell-view-bg)", fontFamily: "var(--font-sans)", color: "var(--text-primary)", transition: "background 0.3s, color 0.3s" }}>
      <PanelGroup direction="horizontal">
        <Panel>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-secondary)" }}>
            <header style={{ height: "56px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface-panel)", display: "flex", alignItems: "center", padding: "0 16px", flexShrink: 0 }}>
               {/* Scrollable tab strip */}
               <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "4px", overflowX: "auto", scrollbarWidth: "none", minWidth: 0 }}>
                 {activeProject.tabs.map(tab => (
                   <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id as CanvasTab)} style={{ flexShrink: 0, border: "none", background: activeTab === tab.id ? "var(--bg-secondary)" : "transparent", fontSize: "12px", fontWeight: 600, color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-secondary)", padding: "8px 14px", borderRadius: "8px 8px 0 0", cursor: "pointer", borderTop: activeTab === tab.id ? "1px solid var(--border-subtle)" : "1px solid transparent", whiteSpace: "nowrap" }}>{tab.label}</button>
                 ))}
               </div>
               {/* Fixed action buttons */}
               <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0, paddingLeft: "12px", borderLeft: "1px solid var(--border-subtle)", marginLeft: "8px" }}>
                 <button type="button" onClick={() => { setActiveProject(null); setActiveTab('questions'); setSelectedSkill(null); setSkillValues({}); }} title="New Project" style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 10px", height: "28px", borderRadius: "8px", background: "var(--surface-hover)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", fontSize: "11px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}><Plus size={12} weight="bold" /> New</button>
                 <button type="button" onClick={() => setShowImport(true)} title="Import design system" style={{ width: "30px", height: "30px", borderRadius: "8px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><UploadSimple size={14} /></button>
                 <button type="button" onClick={() => setShowPluginPicker(true)} title="Plugin marketplace" style={{ width: "30px", height: "30px", borderRadius: "8px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><PuzzlePiece size={14} /></button>
                 <button type="button" onClick={() => setDarkMode(!darkMode)} title={darkMode ? "Light mode" : "Dark mode"} style={{ width: "30px", height: "30px", borderRadius: "8px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>{darkMode ? <Sun size={14} /> : <Moon size={14} />}</button>
                 <button type="button" onClick={toggleDesignStudioLook} title={designStudioLook ? "Allternit look" : "Design Studio look"} style={{ width: "30px", height: "30px", borderRadius: "8px", background: designStudioLook ? 'var(--accent-primary)' : 'transparent', color: designStudioLook ? '#fff' : 'var(--text-secondary)', border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><span style={{ fontSize: 12, fontWeight: 700 }}>AD</span></button>
                 {/* Integrated design component, Allternit-branded via .ad-tokens */}
                 <span className="ad-tokens" style={{ display: "inline-flex" }}>
                   <ODButton variant="primary" onClick={() => setShowImport(true)} title="Allternit Design button (integrated, Allternit tokens)">Allternit Design</ODButton>
                 </span>
                 <button type="button" onClick={() => { setShowClipboard(!showClipboard); setShowTweaks(false); }} title="Design Clipboard" style={{ width: "30px", height: "30px", borderRadius: "8px", background: showClipboard ? "var(--accent-primary)" : "transparent", color: showClipboard ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Scissors size={14} /></button>
                 <button type="button" onClick={() => { setShowTweaks(!showTweaks); setShowClipboard(false); }} title="Live Tokens" style={{ width: "30px", height: "30px", borderRadius: "8px", background: showTweaks ? "var(--accent-primary)" : "transparent", color: showTweaks ? "#fff" : "var(--text-secondary)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Sliders size={14} /></button>
               </div>
            </header>
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
               <div style={{ flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" }}>
                  {isStreaming && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 10, background: 'var(--shell-view-bg)' }}>
                      <GenerativeLoader title="Manifesting high-fidelity UI..." />
                    </div>
                  )}
                  <ErrorBoundary>
                  {/* Full-bleed tabs — no padding wrapper */}
                  {activeTab === 'files' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <Suspense fallback={<TabLoadingState label="Loading file workspace…" />}>
                        <ProjectFileWorkspace projectId={activeProject.id} />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'sketch' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <Suspense fallback={<TabLoadingState label="Loading canvas…" />}>
                        <DesignTldrawCanvas projectName={activeProject?.name} />
                      </Suspense>
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
                      <Suspense fallback={<TabLoadingState label="Loading mobile preview…" />}>
                        <MobilePreviewView projectName={activeProject.name} />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'video' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <Suspense fallback={<TabLoadingState label="Loading video editor…" />}>
                        <VideoEditorView />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'docs' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <Suspense fallback={<TabLoadingState label="Loading documents…" />}>
                        <OfficeWorkspace
                          projectName={activeProject.name}
                          initialDocType={getOfficeDocTypeForProject(activeProject.type)}
                          projectId={activeProject.id}
                        />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'market' && (
                    <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
                      <Suspense fallback={<TabLoadingState label="Loading marketplace…" />}>
                        <DesignRegistryView onInstall={handleInstallDesign} installedId={installedDesignId ?? undefined} />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'brand' && (
                    <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
                      <Suspense fallback={<TabLoadingState label="Loading brand kit…" />}>
                        <BrandKitEditor projectName={activeProject.name} />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'graph' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <Suspense fallback={<TabLoadingState label="Loading skill graph…" />}>
                        <ContentSkillGraphView />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'pipeline' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <Suspense fallback={<TabLoadingState label="Loading pipeline…" />}>
                        <ContentPipelineView projectName={activeProject?.name} />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'live' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <Suspense fallback={<TabLoadingState label="Loading live editor…" />}>
                        <LiveArtifactEditor />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'orbit' && (
                    <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
                      <Suspense fallback={<TabLoadingState label="Loading orbit…" />}>
                        <OrbitView
                          projectName={activeProject?.name}
                          sessionSendMessage={activeSessionId ? (text) => sendMessageStream(activeSessionId, { text }) : undefined}
                          messages={backendMessages}
                        />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'hyperframes' && (
                    <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
                      <Suspense fallback={<TabLoadingState label="Loading HyperFrames timeline…" />}>
                        <HyperFramesTimelineEditor projectId={activeProject.id} artifactHtml={latestArtifactHtml} />
                      </Suspense>
                    </div>
                  )}
                  {activeTab === 'critique' && (
                    <div style={{ flex: 1, height: '100%', overflow: 'hidden' }}>
                      <DesignCritiquePanel artifactHtml={latestArtifactHtml} />
                    </div>
                  )}
                  </ErrorBoundary>
                  {/* Padded tabs */}
                  {!['sketch', 'system', 'handoff', 'mobile', 'video', 'docs', 'market', 'brand', 'graph', 'pipeline', 'live', 'orbit', 'hyperframes', 'critique'].includes(activeTab) && (
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
                                  <button type="button"
                                    key={prompt}
                                    onClick={() => { setComposerSeed(prompt); }}
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
                       onPaste={(content) => { setComposerSeed(content); }}
                       activeContent={{ design: designMd || undefined, ui: uiStream || undefined }}
                     />
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          </div>
        </Panel>
        <PanelResizeHandle />
        <Panel defaultSize={25} minSize={20} style={{ display: 'flex', flexDirection: 'column' }}>
          {selectedSkill && (
            <div style={{ padding: '12px 12px 0' }}>
              <SkillParameterPanel
                skill={selectedSkill}
                values={skillParameters}
                onChange={setSkillParameters}
                onReplan={() => {
                  if (!activeSessionId || !selectedSkill) return;
                  const params = selectedSkill.parameters.map((p) => `${p.label ?? p.name}: ${skillParameters[p.name] ?? p.default}`).join('\n');
                  sendMessageStream(activeSessionId, { text: `Update the ${selectedSkill.name} skill with these revised parameters and continue:\n${params}` });
                }}
              />
            </div>
          )}
          <div style={{ padding: '12px 12px 0' }}>
            <SurgicalEditPanel
              comments={surgicalComments}
              agent={selectedAgent ?? undefined}
              artifactHtml={latestArtifactHtml}
              onChange={setSurgicalComments}
              onApply={() => {
                if (!activeSessionId) return;
                const prompt = buildSurgicalEditPrompt(latestArtifactHtml, surgicalComments);
                if (prompt) sendMessageStream(activeSessionId, { text: prompt });
              }}
            />
          </div>
          <div style={{ padding: '12px 12px 0' }}>
            <AgentAdapterPanel />
          </div>
          <ChatIdProvider
            chatId={activeSessionId || 'design'}
            isPersisted={Boolean(activeSessionId)}
            source="local"
          >
            <DataStreamProvider>
              <MessageTreeProvider>
                <ChatInputProvider>
                  <PromptInputProvider>
                    <ChatModelsProvider>
                      <ModelSelectionProvider defaultSelection={defaultSelection}>
                        <DesignChatPanel
                          activeProject={activeProject}
                          backendMessages={backendMessages}
                          isStreaming={isStreaming}
                          activeSessionId={activeSessionId}
                          sendMessageStream={sendMessageStream}
                          designMd={designMd}
                          uiStream={uiStream}
                          composerSeed={composerSeed}
                          onComposerSeedChange={setComposerSeed}
                        />
                      </ModelSelectionProvider>
                    </ChatModelsProvider>
                  </PromptInputProvider>
                </ChatInputProvider>
              </MessageTreeProvider>
            </DataStreamProvider>
          </ChatIdProvider>
        </Panel>
      </PanelGroup>

      {showImport && (
        <DesignImportModal
          onClose={() => setShowImport(false)}
          onImport={(design) => {
            setShowImport(false);
            setDesignMd(design.designMd);
            setInstalledDesignId(design.id);
            if (activeSessionId) {
              sendMessageStream(activeSessionId, {
                text: `[Design Import] Apply the imported design system: "${design.name}". ${design.designMd}`,
              });
            }
          }}
        />
      )}

      {showPluginPicker && (
        <PluginPicker
          agent={selectedAgent ?? undefined}
          onSelect={(plugin) => {
            setShowPluginPicker(false);
            if (activeSessionId) {
              sendMessageStream(activeSessionId, {
                text: `[Plugin: ${plugin.name}]\n${plugin.description}\n\nRun this plugin workflow for the active project.`,
              });
            }
          }}
          onClose={() => setShowPluginPicker(false)}
        />
      )}
    </div>
  );
}

function DesignChatPanel({
  activeProject,
  backendMessages,
  isStreaming,
  activeSessionId,
  sendMessageStream,
  composerSeed,
  onComposerSeedChange,
}: {
  activeProject: Project | null;
  backendMessages: any[];
  isStreaming: boolean;
  activeSessionId: string | null;
  sendMessageStream: (sessionId: string, message: { text: string }) => Promise<any>;
  designMd: string | null;
  uiStream: string | null;
  composerSeed: string;
  onComposerSeedChange: (seed: string) => void;
}) {
  const { selectedAgentId, selectedAgent, allowedAgents } =
    useSurfaceAgentSelection('design');
  const setSelectedAgent = useAgentSurfaceModeStore((s) => s.setSelectedAgent);
  const [showHarness, setShowHarness] = useState(false);

  const handleSend = async (text: string) => {
    if (!text.trim() || !activeSessionId) return;
    await sendMessageStream(activeSessionId, { text });
    onComposerSeedChange('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
          {activeProject?.name || 'Design Chat'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={selectedAgentId || ''}
            onChange={(e) => setSelectedAgent('design', e.target.value || null)}
            style={{
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 12,
            }}
          >
            <option value="">No agent selected</option>
            {allowedAgents.map((agent: Agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowHarness((s) => !s)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border-primary)',
              background: showHarness ? 'var(--accent-primary)' : 'transparent',
              color: showHarness ? 'var(--ui-text-inverse)' : 'var(--text-primary)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Harness
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {backendMessages.map((message: any, index: number) => (
          <div
            key={message.id || index}
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 12,
              background: message.role === 'user' ? 'var(--accent-primary)' : 'var(--surface-hover)',
              color: message.role === 'user' ? 'var(--ui-text-inverse)' : 'var(--text-primary)',
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}
          >
            {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
          </div>
        ))}
      </div>

      {showHarness && selectedAgent?.id && (
        <div style={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid var(--border-subtle)' }}>
          <HarnessConfigPanel agentId={selectedAgent.id} />
        </div>
      )}

      <div style={{ padding: 16, borderTop: '1px solid var(--border-subtle)' }}>
        <ChatComposer
          onSend={handleSend}
          isLoading={isStreaming}
          placeholder={selectedAgent ? `Message ${selectedAgent.name}...` : 'Describe your design request...'}
          seedText={composerSeed}
          agentModeSurface="design"
        />
      </div>
    </div>
  );
}

interface TokenSliderProps {
  label: string;
  value: number;
  unit: string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

function TokenSlider({ label, value, unit, onChange, min = 0, max = 32 }: TokenSliderProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)" }}>{label}</span><span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>{value}{unit}</span></div>
       <input aria-label="Input" type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} style={{ width: "100%", accentColor: "var(--accent-primary)", height: "2px" }} />
    </div>
  );
}
