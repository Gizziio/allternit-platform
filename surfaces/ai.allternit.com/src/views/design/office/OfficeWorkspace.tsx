import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { FilePpt, FileXls, FileDoc, DownloadSimple, ShareNetwork, MagicWand, Table, TextT, Calculator, Broom, Pencil, Pen, List, ChartBar, Layout, Palette } from '@phosphor-icons/react';
import { GlassCard } from '../../../design/GlassCard';
import { OFFICE_HOSTS } from '../../../lib/design/office-bridge';
import { UniverDocEditor } from './UniverDocEditor';
import { UniverSheetEditor } from './UniverSheetEditor';

const SlidesEditor = dynamic(() => import('./SlidesEditor').then(m => ({ default: m.SlidesEditor })), { ssr: false });

type OfficeDocType = 'slides' | 'spreadsheet' | 'document';

export function OfficeWorkspace({
  projectName = "New Business Blueprint"
}: {
  projectName?: string
}) {
  const [activeDoc, setActiveDoc] = useState<OfficeDocType>('slides');

  const hostKey = activeDoc === 'slides' ? 'POWERPOINT' : activeDoc === 'spreadsheet' ? 'EXCEL' : 'WORD';
  const hostData = OFFICE_HOSTS[hostKey];

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "var(--bg-primary)" }}>
      {/* Left: Document Type Rail */}
      <div style={{ width: "64px", borderRight: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "20px", gap: "12px", background: "var(--surface-panel)" }}>
         <DocTypeBtn icon={<FilePpt size={22} />} active={activeDoc === 'slides'} onClick={() => setActiveDoc('slides')} label="Slides" color="#ff5c5c" />
         <DocTypeBtn icon={<FileXls size={22} />} active={activeDoc === 'spreadsheet'} onClick={() => setActiveDoc('spreadsheet')} label="Excel" color="#21a366" />
         <DocTypeBtn icon={<FileDoc size={22} />} active={activeDoc === 'document'} onClick={() => setActiveDoc('document')} label="Word" color="#2b579a" />
      </div>

      {/* Center: Live Document Canvas */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Document Header */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface-panel)", flexShrink: 0 }}>
           <div>
             <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{projectName} — {activeDoc.toUpperCase()}</h3>
             <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, margin: "2px 0 0", letterSpacing: "0.08em" }}>Office Suite</p>
           </div>
           <div style={{ display: "flex", gap: "8px" }}>
              <button style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-default)", background: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                 <ShareNetwork size={13} /> Open in Web
              </button>
              <button style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--accent-primary)", border: "none", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                 <DownloadSimple size={13} /> Export .{activeDoc === 'slides' ? 'pptx' : activeDoc === 'spreadsheet' ? 'xlsx' : 'docx'}
              </button>
           </div>
        </div>

        {/* The Viewport — real open-source editors */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {activeDoc === 'slides' && <SlidesEditor projectName={projectName} />}
          {activeDoc === 'spreadsheet' && <UniverSheetEditor projectName={projectName} />}
          {activeDoc === 'document' && <UniverDocEditor projectName={projectName} />}
        </div>
      </div>

      {/* Right: Add-in Controls */}
      <div style={{ width: "280px", borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", background: "var(--surface-panel)" }}>
         <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h4 style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>Add-in Intelligence</h4>
         </div>
         <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
            <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)", background: "var(--bg-primary)" }}>
               <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--accent-primary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Registered Commands</div>
               <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {hostData.commands.map(cmd => (
                    <MacroItem key={cmd.id} icon={getIcon(cmd.icon)} label={cmd.label} />
                  ))}
               </div>
            </div>

            <button style={{ marginTop: "auto", width: "100%", padding: "12px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
               <MagicWand size={14} /> Execute Add-in Plugin
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
        width: "42px", height: "42px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? `${color}18` : "transparent",
        border: "1px solid",
        borderColor: active ? color : "transparent",
        color: active ? color : "var(--text-tertiary)",
        cursor: "pointer", transition: "all 0.15s"
      }}
    >
      {icon}
    </button>
  );
}

function MacroItem({ icon, label }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 9px", borderRadius: "6px", background: "var(--surface-hover)", cursor: "pointer" }}>
       <div style={{ color: "var(--text-tertiary)", flexShrink: 0 }}>{icon}</div>
       <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)" }}>{label}</span>
    </div>
  );
}
