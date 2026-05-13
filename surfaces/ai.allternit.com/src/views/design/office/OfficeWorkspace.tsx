import React, { useMemo, useState } from 'react';
import { FilePpt, FileXls, FileDoc, ShareNetwork, Table, TextT, Calculator, Broom, Pencil, Pen, List, ChartBar, Layout, Palette, ArrowSquareOut, PlugsConnected, Info, Sparkle } from '@phosphor-icons/react';
import { OFFICE_HOSTS } from '../../../lib/design/office-bridge';
import { UniverDocEditor } from './UniverDocEditor';
import { UniverSheetEditor } from './UniverSheetEditor';
import { SlidesEditor } from './SlidesEditor';
import { useNav } from '../../../nav/useNav';

type OfficeDocType = 'slides' | 'spreadsheet' | 'document';

export function OfficeWorkspace({
  projectName = "New Business Blueprint",
  initialDocType = 'slides',
}: {
  projectName?: string;
  initialDocType?: OfficeDocType;
}) {
  const [activeDoc, setActiveDoc] = useState<OfficeDocType>(initialDocType);
  const { dispatch } = useNav();

  const hostKey = activeDoc === 'slides' ? 'POWERPOINT' : activeDoc === 'spreadsheet' ? 'EXCEL' : 'WORD';
  const hostData = OFFICE_HOSTS[hostKey];
  const hostWebUrl = useMemo(() => {
    if (activeDoc === 'slides') return 'https://powerpoint.office.com';
    if (activeDoc === 'spreadsheet') return 'https://excel.office.com';
    return 'https://word.office.com';
  }, [activeDoc]);
  const addinViewType = activeDoc === 'slides' ? 'addin-ppt' : activeDoc === 'spreadsheet' ? 'addin-excel' : 'addin-word';

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
             <p style={{ fontSize: "10px", color: "var(--text-tertiary)", textTransform: "uppercase", fontWeight: 700, margin: "2px 0 0", letterSpacing: "0.08em" }}>Native Workspace Surface</p>
           </div>
           <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => window.open(hostWebUrl, '_blank', 'noopener,noreferrer')}
                style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-default)", background: "var(--bg-primary)", color: "var(--text-secondary)", fontSize: "11px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                 <ShareNetwork size={13} /> Open {hostData.label} Web
              </button>
              <button
                onClick={() => dispatch({ type: 'OPEN_VIEW', viewType: addinViewType })}
                style={{ padding: "6px 14px", borderRadius: "6px", background: "var(--accent-primary)", border: "none", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
              >
                 <PlugsConnected size={13} /> Open Real Add-in
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

      {/* Right: Native workspace context */}
      <div style={{ width: "280px", borderLeft: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", background: "var(--surface-panel)" }}>
         <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)" }}>
            <h4 style={{ fontSize: "10px", fontWeight: 800, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0 }}>Workspace Context</h4>
         </div>
         <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
            <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)", background: "var(--bg-primary)" }}>
               <div style={{ fontSize: "10px", fontWeight: 800, color: "var(--accent-primary)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Native Capabilities</div>
               <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {hostData.commands.map(cmd => (
                    <MacroItem key={cmd.id} icon={getIcon(cmd.icon)} label={cmd.label} />
                  ))}
               </div>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)", background: "var(--bg-primary)", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-primary)", fontSize: "12px", fontWeight: 700 }}>
                <Info size={14} />
                Surface Boundary
              </div>
              <p style={{ margin: 0, fontSize: "11px", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                This workspace is the platform-native editor surface for {hostData.label}. The actual Microsoft connector and taskpane live in the dedicated add-in view.
              </p>
              <button
                onClick={() => dispatch({ type: 'OPEN_VIEW', viewType: addinViewType })}
                style={{ marginTop: "4px", width: "100%", padding: "11px 12px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)", fontWeight: 700, fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
              >
                <ArrowSquareOut size={14} /> Open Microsoft Add-in Connector
              </button>
            </div>

            <div style={{ padding: "14px", borderRadius: "10px", border: "1px solid var(--border-subtle)", background: "var(--bg-primary)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "var(--text-primary)", fontSize: "12px", fontWeight: 700 }}>
                <Sparkle size={14} />
                Skills Registered
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {hostData.skills.map((skill) => (
                  <span
                    key={skill}
                    style={{
                      padding: "5px 8px",
                      borderRadius: "999px",
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-secondary)",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
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
