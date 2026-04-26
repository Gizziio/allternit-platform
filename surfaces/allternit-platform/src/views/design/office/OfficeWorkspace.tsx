import React, { useState } from 'react';
import { FilePpt, FileXls, FileDoc, DownloadSimple, ShareNetwork, Eye, MagicWand, Table, ChartPieSlice, TextT, Calculator, Broom, Pencil, Pen, List, ChartBar, Layout, Palette } from '@phosphor-icons/react';
import { GlassCard } from '../../../design/GlassCard';
import { OFFICE_HOSTS } from '../../../lib/design/office-bridge';

type OfficeDocType = 'slides' | 'spreadsheet' | 'document';

/**
 * Office Workspace
 * 
 * Provides a specialized environment for Allternit Office Add-ins.
 * Allows agents to generate and preview Word, Excel, and PowerPoint assets.
 */
export function OfficeWorkspace({ 
  projectName = "New Business Blueprint" 
}: { 
  projectName?: string 
}) {
  const [activeDoc, setActiveDoc] = useState<OfficeDocType>('slides');
  const [isGenerating, setIsGenerating] = useState(false);

  // Map active selection to Bridge data
  const hostKey = activeDoc === 'slides' ? 'POWERPOINT' : activeDoc === 'spreadsheet' ? 'EXCEL' : 'WORD';
  const hostData = OFFICE_HOSTS[hostKey];

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#0a0a0c" }}>
      {/* Left: Document Type Rail */}
      <div style={{ width: "64px", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", py: "20px", gap: "20px" }}>
         <DocTypeBtn icon={<FilePpt size={24} />} active={activeDoc === 'slides'} onClick={() => setActiveDoc('slides')} label="Slides" color="#ff5c5c" />
         <DocTypeBtn icon={<FileXls size={24} />} active={activeDoc === 'spreadsheet'} onClick={() => setActiveDoc('spreadsheet')} label="Excel" color="#21a366" />
         <DocTypeBtn icon={<FileDoc size={24} />} active={activeDoc === 'document'} onClick={() => setActiveDoc('document')} label="Word" color="#2b579a" />
      </div>

      {/* Center: Live Document Canvas */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Document Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.01)" }}>
           <div>
             <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#fff" }}>{projectName} - {activeDoc.toUpperCase()}</h3>
             <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontWeight: 800 }}>Office Add-in Protocol v2.4</p>
           </div>
           <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                 <ShareNetwork size={14} style={{ display: "inline", marginRight: "6px" }} /> Open in Web
              </button>
              <button style={{ padding: "6px 16px", borderRadius: "6px", background: "var(--accent-primary)", border: "none", color: "#000", fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>
                 <DownloadSimple size={14} style={{ display: "inline", marginRight: "6px" }} /> Export .{activeDoc === 'slides' ? 'pptx' : activeDoc === 'spreadsheet' ? 'xlsx' : 'docx'}
              </button>
           </div>
        </div>

        {/* The Viewport */}
        <div style={{ flex: 1, p: "40px", overflowY: "auto", display: "flex", justifyContent: "center", background: "rgba(0,0,0,0.2)" }}>
           <div style={{ width: "100%", maxWidth: "800px", aspectRatio: activeDoc === 'slides' ? "16/9" : "1/1.4", background: "#fff", borderRadius: "4px", boxShadow: "0 24px 64px rgba(0,0,0,0.5)", overflow: "hidden", position: "relative" }}>
              {activeDoc === 'slides' && <SlidePreview />}
              {activeDoc === 'spreadsheet' && <ExcelPreview />}
              {activeDoc === 'document' && <WordPreview />}
           </div>
        </div>
      </div>

      {/* Right: Add-in Controls */}
      <div style={{ width: "300px", borderLeft: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", background: "rgba(15, 13, 12, 0.5)" }}>
         <div style={{ padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <h4 style={{ fontSize: "11px", fontWeight: 900, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Add-in Intelligence</h4>
         </div>
         <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <GlassCard style={{ padding: "16px", background: "rgba(212,176,140,0.05)" }}>
               <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--accent-primary)", marginBottom: "12px", textTransform: "uppercase" }}>Registered Commands</div>
               <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {hostData.commands.map(cmd => (
                    <MacroItem key={cmd.id} icon={getIcon(cmd.icon)} label={cmd.label} />
                  ))}
               </div>
            </GlassCard>
            
            <button style={{ marginTop: "auto", width: "100%", padding: "14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", fontWeight: 800, fontSize: "12px", cursor: "pointer" }}>
               <MagicWand size={16} style={{ display: "inline", marginRight: "8px" }} /> Execute Add-in Plugin
            </button>
         </div>
      </div>
    </div>
  );
}

function getIcon(name: string) {
  const icons: any = {
    ChartLine: <Table size={14} />,
    Calculator: <Calculator size={14} />,
    ChartBar: <ChartBar size={14} />,
    Broom: <Broom size={14} />,
    Layout: <Layout size={14} />,
    Palette: <Palette size={14} />,
    Pencil: <Pencil size={14} />,
    TextT: <TextT size={14} />,
    Pen: <Pen size={14} />,
    List: <List size={14} />
  };
  return icons[name] || <Table size={14} />;
}

function DocTypeBtn({ icon, active, onClick, label, color }: any) {
  return (
    <button 
      onClick={onClick}
      title={label}
      style={{
        width: "40px", height: "40px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? `${color}20` : "transparent",
        border: "1px solid",
        borderColor: active ? color : "transparent",
        color: active ? color : "rgba(255,255,255,0.2)",
        cursor: "pointer", transition: "all 0.2s"
      }}
    >
      {icon}
    </button>
  );
}

function MacroItem({ icon, label }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px", borderRadius: "6px", background: "rgba(255,255,255,0.02)", cursor: "pointer" }}>
       <div style={{ color: "rgba(255,255,255,0.4)" }}>{icon}</div>
       <span style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{label}</span>
    </div>
  );
}

// Visual Placeholders for Office Content
const SlidePreview = () => (
  <div style={{ height: "100%", padding: "48px", display: "flex", flexDirection: "column", gap: "24px", color: "#111" }}>
     <div style={{ width: "80px", height: "4px", background: "var(--accent-primary)" }} />
     <h1 style={{ fontSize: "48px", fontWeight: 900, letterSpacing: "-0.03em" }}>Project Blueprint</h1>
     <p style={{ fontSize: "20px", color: "#666" }}>Strategic Visual Engineering with Allternit Studio.</p>
  </div>
);

const ExcelPreview = () => (
  <div style={{ height: "100%", display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gridTemplateRows: "repeat(20, 30px)", color: "#333", fontSize: "10px" }}>
     {Array.from({ length: 200 }).map((_, i) => (
       <div key={i} style={{ border: "0.5px solid #eee", padding: "4px" }}>{i % 12 === 0 ? "METRIC_" + i : ""}</div>
     ))}
  </div>
);

const WordPreview = () => (
  <div style={{ height: "100%", padding: "64px", color: "#222", lineHeight: 1.6, fontSize: "14px" }}>
     <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>Executive Summary</h2>
     <p>The integration of Office Add-ins into the Allternit Studio workspace provides a unified pipeline for document generation...</p>
  </div>
);
