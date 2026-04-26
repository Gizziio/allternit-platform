"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palette, MagnifyingGlass, Layout, PresentationChart, Files, ArrowSquareOut, X, CaretDown, Paperclip, Image as ImageIcon, Code, Link, Question, ChatCircle, PencilSimple, Sliders, Check, ShareNetwork, CircleNotch, FolderOpen, Monitor, DownloadSimple, Plus, PlayCircle, DeviceMobile, ArrowCounterClockwise, ArrowClockwise, AppWindow, TextT, FileText, Export, Lightning, Pen, SquaresFour, ClockCounterClockwise, VideoCamera, FileDoc, ChartBar, TreeStructure, RocketLaunch, Megaphone, MagicWand, ShieldCheck, Target, HandPointing
} from "@phosphor-icons/react";
import { useNav } from "../../nav/useNav";
import { useDesignSessionStore, useDesignSessionActions } from "./DesignSessionStore";

// Imports for built features
import { DesignMdRenderer } from "../../lib/openui/DesignMdRenderer";
import { MobileDevWorkspace } from "./mobile/MobileDevWorkspace";
import { VideoEditorView } from "./video/VideoEditorView";
import { OfficeWorkspace } from "./office/OfficeWorkspace";
import { componentRegistry } from "../../lib/openui/registry";
import { compileToReact } from "../../lib/design/code-compiler";
import { parseDesignMd } from "../../lib/openui/design-md-parser";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectType = 'prototype' | 'slides' | 'content-engine' | 'template' | 'other';
type CanvasTab = 'system' | 'files' | 'questions' | 'sketch' | 'mobile' | 'video' | 'docs' | 'handoff' | 'graph' | 'pipeline';
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

interface DesignMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  component?: { tag: string, props: any };
}

// ─── Discovery Hub (Home) ───────────────────────────────────────────────────

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
    <div style={{ display: "flex", height: "100%", width: "100%", background: "#fdfdfb", color: "#1a1714", fontFamily: "Inter, sans-serif" }}>
      <aside style={{ width: "320px", borderRight: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", padding: "32px", background: "#fdfcf9" }}>
        
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "40px" }}>
           <Palette size={24} weight="fill" color="#e27c59" />
           <div style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.02em" }}>Allternit Studio</div>
        </div>

        <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid rgba(0,0,0,0.06)", marginBottom: "24px" }}>
           {types.map(t => (
             <button key={t.id} onClick={() => setActiveType(t.id as any)} style={{ paddingBottom: "8px", fontSize: "13px", fontWeight: 600, background: "none", border: "none", color: activeType === t.id ? "#1a1714" : "rgba(0,0,0,0.4)", borderBottom: `2px solid ${activeType === t.id ? "#e27c59" : "transparent"}`, cursor: "pointer" }}>{t.label}</button>
           ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
           <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "12px", padding: "16px", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 800, color: "rgba(0,0,0,0.3)", textTransform: "uppercase", marginBottom: "16px" }}>Project Name</h3>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Apollo Hub" style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.1)", marginBottom: "8px", outline: "none", fontSize: "14px" }} />
           </div>

           <h3 style={{ fontSize: "12px", fontWeight: 800, color: "rgba(0,0,0,0.3)", textTransform: "uppercase", marginBottom: "12px", marginLeft: "4px" }}>Select Specialist</h3>
           <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {specialists.map(s => (
                <button key={s.id} onClick={() => setSpecialist(s.id as any)} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px", borderRadius: "12px", border: specialist === s.id ? "2px solid #e27c59" : "1px solid rgba(0,0,0,0.06)", background: "#fff", textAlign: "left", cursor: "pointer", transition: "all 0.2s" }}>
                   <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: specialist === s.id ? "#e27c59" : "rgba(0,0,0,0.04)", color: specialist === s.id ? "#fff" : "#1a1714", display: "flex", alignItems: "center", justifyContent: "center" }}>{s.icon}</div>
                   <div>
                      <div style={{ fontSize: "13px", fontWeight: 700 }}>{s.label}</div>
                      <div style={{ fontSize: "11px", opacity: 0.4 }}>{s.desc}</div>
                   </div>
                </button>
              ))}
           </div>

           <button onClick={() => onStart({ name, type: activeType, specialist })} disabled={!name} style={{ width: "100%", marginTop: "32px", padding: "14px", borderRadius: "12px", background: "#1a1714", color: "#fff", fontWeight: 700, fontSize: "14px", border: "none", opacity: !name ? 0.5 : 1, cursor: "pointer" }}>Initialize Manifestation</button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: "64px", background: "#fdfdfb" }}>
         <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
            <h2 style={{ fontSize: "32px", fontWeight: 900, marginBottom: "48px", letterSpacing: "-0.04em" }}>Recent Work</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "32px" }}>
               <ProjectCard title="Canopy Onboarding" sub="Purist • Updated 2m ago" color="#e1f0fa" icon={<Monitor size={48} color="#3b82f6" weight="duotone" />} />
               <ProjectCard title="Social Engine v1" sub="Growth • Active" color="#fcebe9" icon={<Megaphone size={48} color="#e27c59" weight="duotone" />} />
            </div>
         </div>
      </main>
    </div>
  );
}

function ProjectCard({ title, sub, color, icon }: any) {
  return (
    <motion.div whileHover={{ y: -8 }} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "24px", overflow: "hidden", cursor: "pointer" }}>
       <div style={{ height: "180px", background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
       <div style={{ padding: "20px" }}>
          <div style={{ fontSize: "16px", fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: "12px", opacity: 0.4, marginTop: "4px" }}>{sub}</div>
       </div>
    </motion.div>
  );
}

// ─── Main Workspace (The Studio) ─────────────────────────────────────────────

export default function DesignModeView() {
  const { dispatch } = useNav();
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<CanvasTab>("questions");
  const [showTweaks, setShowTweaks] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [designMd, setDesignMd] = useState<string | null>(null);
  const [uiStream, setUiStream] = useState<string | null>(null);
  const [tokens, setTokens] = useState({ radius: 12, spacing: 4, primary: '#e27c59', font: 'Inter' });
  const [isManifesting, setIsManifesting] = useState(false);

  const { createSession, sendMessageStream, loadSessions } = useDesignSessionActions();
  const activeSessionId = useDesignSessionStore(s => s.activeSessionId);

  // Load design sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const activeSession = useDesignSessionStore(s => s.sessions.find(x => x.id === activeSessionId));
  const backendMessages = activeSession?.messages || [];
  const isStreaming = useDesignSessionStore(s => s.streamingBySession[activeSessionId || '']?.isStreaming);

  // Extract openUI logic from messages
  useEffect(() => {
    if (!backendMessages.length) return;
    const lastAsstMsg = [...backendMessages].reverse().find(m => m.role === 'assistant');
    if (lastAsstMsg) {
      const content = lastAsstMsg.content || '';
      // Very basic extraction for demo purposes
      const mdMatch = content.match(/# Brand:[\s\S]*?## Radii[\s\S]*?px/);
      if (mdMatch) setDesignMd(mdMatch[0]);
      
      const uiMatch = content.match(/\[v:[\s\S]*/);
      if (uiMatch) setUiStream(uiMatch[0]);
    }
  }, [backendMessages]);

  async function startProject(config: any) {
    const isContent = config.type === 'content-engine';
    setActiveProject({
      id: Date.now().toString(),
      name: config.name,
      type: config.type,
      specialist: config.specialist,
      fidelity: config.fidelity,
      activeTabId: isContent ? 'graph' : 'questions',
      tabs: [
        { id: 'questions', label: 'Discovery', type: 'questions' as CanvasTab },
        { id: 'mobile', label: 'Mobile View', type: 'mobile' as CanvasTab },
        { id: 'video', label: 'Video Editor', type: 'video' as CanvasTab },
        { id: 'docs', label: 'Documents', type: 'docs' as CanvasTab },
        ...(isContent ? [
          { id: 'graph', label: 'Skill Graph', type: 'graph' as CanvasTab },
          { id: 'pipeline', label: 'Pipeline', type: 'pipeline' as CanvasTab }
        ] : []),
        { id: 'handoff', label: 'Handoff', type: 'handoff' as CanvasTab }
      ]
    });
    
    try {
      const sessionId = await createSession({
        name: config.name,
        sessionMode: 'agent',
      });
      
      await sendMessageStream(sessionId, {
        text: `I want to create a new ${config.type} called ${config.name} using the ${config.specialist} specialist focus. Please confirm your readiness.`,
      });
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  }

  const handleSendChat = async () => {
    if (!chatInput.trim() || !activeSessionId) return;
    const currentInput = chatInput;
    setChatInput("");
    try {
      await sendMessageStream(activeSessionId, { text: currentInput });
      if (activeProject?.type !== 'content-engine') {
        setActiveTab('mobile' as CanvasTab);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const manifestCampaign = async () => {
    if (!activeSessionId) return;
    setActiveTab('pipeline' as CanvasTab);
    setIsManifesting(true);
    try {
      await sendMessageStream(activeSessionId, { 
        text: "Please manifest the campaign distribution nodes using the skill_graph_ops tool to read/write to the /content-skill-graph folder." 
      });
    } finally {
      setIsManifesting(false);
    }
  };

  if (!activeProject) return <DiscoveryHub onStart={startProject} />;

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", background: "#fdfdfb", fontFamily: "Inter, sans-serif", color: "#1a1714" }}>
      <PanelGroup direction="horizontal">
        
        <Panel defaultSize={25} minSize={20}>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", borderRight: "1px solid rgba(0,0,0,0.06)", background: "#fff" }}>
            <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <MagicWand size={16} color="#e27c59" weight="fill" />
                  <span style={{ fontSize: "13px", fontWeight: 700 }}>{activeProject.specialist} agent</span>
               </div>
               <div style={{ width: "8px", height: "8px", borderRadius: "4px", background: isStreaming ? "#e27c59" : "#22c55e", animation: isStreaming ? "pulse 1.5s infinite" : "none" }} />
            </div>
            
            <div style={{ flex: 1, padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px" }}>
               {backendMessages.map(m => (
                 <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "12px", fontWeight: 800, opacity: 0.4 }}>{m.role.toUpperCase()}</div>
                    <div style={{ fontSize: "13px", color: "rgba(0,0,0,0.8)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                      {m.content?.replace(/\[v:[\s\S]*/, '[Visual Interface Generated]')}
                    </div>
                    {m.content?.includes('[v:pipeline') && (
                      <div style={{ padding: "16px", background: "rgba(0,0,0,0.02)", borderRadius: "12px", border: "1px solid rgba(0,0,0,0.05)" }}>
                         {React.createElement(componentRegistry['v:pipeline'], { items: [
                            { platform: 'X / Twitter', status: 'Ready', content: "Preview: you don't need a content team..." },
                            { platform: 'LinkedIn', status: 'Drafting', content: 'Expanding X post into narrative...' },
                            { platform: 'Newsletter', status: 'Queued', content: 'Waiting for narrative completion...' }
                         ]})}
                      </div>
                    )}
                 </div>
               ))}
            </div>

            <div style={{ padding: "24px" }}>
               <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: "16px", padding: "8px" }}>
                  <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Message agent..." style={{ width: "100%", border: "none", outline: "none", resize: "none", fontSize: "13px", minHeight: "60px", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                     <button style={{ background: "none", border: "none", color: "rgba(0,0,0,0.3)" }}><Paperclip size={18} /></button>
                     <button onClick={handleSendChat} style={{ padding: "8px 20px", borderRadius: "10px", background: "#1a1714", color: "#fff", fontWeight: 700, border: "none", fontSize: "12px", cursor: "pointer" }}>Send</button>
                  </div>
               </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle />

        <Panel>
          <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f4f0" }}>
            <header style={{ height: "56px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#fff", display: "flex", alignItems: "center", padding: "0 16px", gap: "8px" }}>
               {activeProject.tabs.map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id as CanvasTab)} style={{ border: "none", background: activeTab === tab.id ? "#f5f4f0" : "transparent", fontSize: "12px", fontWeight: 600, color: "rgba(0,0,0,0.6)", padding: "8px 16px", borderRadius: "8px 8px 0 0", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", marginTop: "16px", borderTop: activeTab === tab.id ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent", borderLeft: activeTab === tab.id ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent", borderRight: activeTab === tab.id ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent" }}>
                   {tab.label}
                 </button>
               ))}
               <div style={{ flex: 1 }} />
               {activeProject.type === 'content-engine' && (
                 <button onClick={manifestCampaign} disabled={isManifesting} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "20px", background: "rgba(226,124,89,0.1)", color: "#cc664a", border: "none", fontSize: "11px", fontWeight: 800, cursor: "pointer", opacity: isManifesting ? 0.5 : 1 }}>
                    {isManifesting ? <CircleNotch className="animate-spin" size={14} /> : <RocketLaunch size={14} />} 
                    Manifest Campaign
                 </button>
               )}
               <button onClick={() => setShowTweaks(!showTweaks)} style={{ width: "36px", height: "36px", borderRadius: "18px", background: showTweaks ? "#e27c59" : "#fff", color: showTweaks ? "#fff" : "#1a1714", border: "1px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Sliders size={18} /></button>
            </header>

            <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
               <div style={{ flex: 1, overflowY: "auto" }}>
                  {activeTab === 'mobile' && <MobileDevWorkspace designMd={designMd || ""} />}
                  {activeTab === 'video' && <VideoEditorView />}
                  {activeTab === 'docs' && <OfficeWorkspace />}
                  
                  {activeTab === 'graph' && (
                    <div style={{ width: "100%", height: "100%", background: "#16161a", position: "relative" }}>
                       <div style={{ position: "absolute", top: "32px", left: "32px", color: "#fff", zIndex: 10 }}>
                          <h2 style={{ fontSize: "24px", fontWeight: 900 }}>Skill Graph: {activeProject.name}</h2>
                          <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                             <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "rgba(255,255,255,0.4)" }}><ShieldCheck size={14} /> Local Folder Connected</div>
                          </div>
                       </div>
                       <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: "80%", height: "80%" }}>
                             {React.createElement(componentRegistry['v:skill-graph'], {
                               nodes: [
                                 { id: 'index', label: 'Command Center', x: 400, y: 50 },
                                 { id: 'x', label: 'X/Twitter Node', x: 150, y: 200 },
                                 { id: 'li', label: 'LinkedIn Node', x: 350, y: 200 },
                                 { id: 'tt', label: 'TikTok Node', x: 550, y: 200 },
                                 { id: 'voice', label: 'Brand Voice Node', x: 400, y: 350 },
                               ],
                               links: [
                                 { from: 'index', to: 'x' }, { from: 'index', to: 'li' }, { from: 'index', to: 'tt' }, { from: 'voice', to: 'index' }
                               ]
                             })}
                          </div>
                       </div>
                    </div>
                  )}

                  {activeTab === 'pipeline' && (
                    <div style={{ padding: "40px", maxWidth: "900px", margin: "0 auto" }}>
                       <h2 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "32px" }}>Manifestation Pipeline</h2>
                       {React.createElement(componentRegistry['v:pipeline'], {
                          items: [
                            { platform: 'X / Twitter', status: 'Ready', content: "Preview: you don't need a content team..." },
                            { platform: 'LinkedIn', status: 'Drafting', content: 'Expanding X post into narrative...' },
                            { platform: 'Newsletter', status: 'Queued', content: 'Waiting for narrative completion...' },
                          ]
                       })}
                    </div>
                  )}

                  {activeTab === 'handoff' && (
                    <div style={{ padding: "40px", height: "100%" }}>
                       <pre style={{ background: "#1e1a16", color: "#fff", padding: "24px", borderRadius: "12px", fontSize: "12px", overflow: "auto", height: "100%" }}>
                          {designMd && uiStream ? compileToReact(uiStream, parseDesignMd(designMd)) : "// Final Handoff Logic\n// Waiting for design stream..."}
                       </pre>
                    </div>
                  )}
               </div>

               <AnimatePresence>
                 {showTweaks && (
                   <motion.aside initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }} style={{ width: "280px", background: "#16161a", color: "#fff", padding: "24px", display: "flex", flexDirection: "column", gap: "32px", margin: "16px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)", boxShadow: "0 24px 64px rgba(0,0,0,0.4)", zIndex: 50 }}>
                      <div>
                        <div style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", marginBottom: "16px" }}>DESIGN TOKENS</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                           <TokenSlider label="Radius" value={tokens.radius} unit="px" onChange={(v: any) => setTokens({...tokens, radius: v})} />
                           <TokenSlider label="Spacing" value={tokens.spacing} unit="x4" min={1} max={8} onChange={(v: any) => setTokens({...tokens, spacing: v})} />
                           <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Primary Color</div>
                              <div style={{ display: "flex", gap: "8px" }}>
                                 {['#e27c59', '#3b82f6', '#22c55e', '#a855f7'].map(c => (
                                   <button key={c} onClick={() => setTokens({...tokens, primary: c})} style={{ width: "24px", height: "24px", borderRadius: "12px", background: c, border: tokens.primary === c ? "2px solid #fff" : "none", cursor: "pointer" }} />
                                 ))}
                              </div>
                           </div>
                        </div>
                      </div>
                      <div style={{ marginTop: "auto", padding: "16px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}>
                         <div style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px" }}>Sync Mode</div>
                         <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ flex: 1, height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px" }}><div style={{ width: "80%", height: "100%", background: "#e27c59", borderRadius: "2px" }} /></div>
                            <span style={{ fontSize: "10px", opacity: 0.4 }}>DESIGN.md</span>
                         </div>
                      </div>
                   </motion.aside>
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
       <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{label}</span>
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>{value}{unit}</span>
       </div>
       <input type="range" min={min} max={max} value={value} onChange={e => onChange(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#fff" }} />
    </div>
  );
}

function QuestionField({ label, sub }: any) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
       <label style={{ fontSize: "14px", fontWeight: 700 }}>{label}</label>
       {sub && <span style={{ fontSize: "12px", opacity: 0.4 }}>{sub}</span>}
       <textarea style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.1)", minHeight: "80px", outline: "none", fontSize: "13px", resize: "none" }} />
    </div>
  );
}
