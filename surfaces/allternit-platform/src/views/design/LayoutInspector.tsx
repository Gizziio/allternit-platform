import React from 'react';
import { Columns, Rows, ArrowsHorizontal, ArrowsVertical, GridNine, Selection } from '@phosphor-icons/react';
import { GlassCard } from '../../design/GlassCard';

interface LayoutInspectorProps {
  onUpdate: (props: any) => void;
  activeProps: any;
}

/**
 * Layout Inspector
 * 
 * A Penpot-inspired nuance that allows manual override of 
 * CSS Flex and Grid properties on the generative canvas.
 */
export function LayoutInspector({ onUpdate, activeProps }: LayoutInspectorProps) {
  const update = (key: string, val: any) => {
    onUpdate({ ...activeProps, [key]: val });
  };

  return (
    <div style={{
      width: "240px",
      height: "100%",
      background: "rgba(15, 13, 12, 0.98)",
      borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      gap: "24px"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <GridNine size={18} color="var(--accent-primary)" weight="duotone" />
        <h3 style={{ fontSize: "11px", fontWeight: 900, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Layout Engine
        </h3>
      </div>

      {/* Flex Direction */}
      <section>
        <label style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: "12px", display: "block" }}>Direction</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
           <LayoutBtn 
             icon={<Rows size={14} />} 
             active={activeProps.direction === 'vertical'} 
             onClick={() => update('direction', 'vertical')} 
             label="Stack"
           />
           <LayoutBtn 
             icon={<Columns size={14} />} 
             active={activeProps.direction === 'horizontal'} 
             onClick={() => update('direction', 'horizontal')} 
             label="Row"
           />
        </div>
      </section>

      {/* Alignment */}
      <section>
        <label style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: "12px", display: "block" }}>Alignment</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
           <LayoutBtn icon={<Selection size={14} />} active={activeProps.align === 'start'} onClick={() => update('align', 'start')} label="Start" />
           <LayoutBtn icon={<Selection size={14} />} active={activeProps.align === 'center'} onClick={() => update('align', 'center')} label="Center" />
           <LayoutBtn icon={<Selection size={14} />} active={activeProps.align === 'end'} onClick={() => update('align', 'end')} label="End" />
        </div>
      </section>

      {/* Spacing */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
           <label style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>Gap</label>
           <span style={{ fontSize: "10px", color: "var(--accent-primary)", fontWeight: 800 }}>{activeProps.gap || 0}px</span>
        </div>
        <input 
          type="range" 
          min="0" max="64" step="4"
          value={activeProps.gap || 0}
          onChange={(e) => update('gap', parseInt(e.target.value))}
          style={{ width: "100%", accentColor: "var(--accent-primary)" }}
        />
      </section>

      <div style={{ marginTop: "auto" }}>
         <GlassCard style={{ padding: "12px", background: "rgba(59,130,246,0.05)", borderColor: "rgba(59,130,246,0.2)" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, color: "#60a5fa", textTransform: "uppercase", marginBottom: "4px" }}>WASM Engine</div>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", lineHeight: 1.4 }}>
              Using Penpot-optimized Flex/Grid layout algorithm.
            </p>
         </GlassCard>
      </div>
    </div>
  );
}

function LayoutBtn({ icon, active, onClick, label }: any) {
  return (
    <button 
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
        padding: "8px", borderRadius: "8px", border: "1px solid",
        background: active ? "color-mix(in srgb, var(--accent-primary) 10%, transparent)" : "var(--surface-hover)",
        borderColor: active ? "var(--accent-primary)" : "var(--surface-hover)",
        color: active ? "#fff" : "rgba(255,255,255,0.4)",
        cursor: "pointer", transition: "all 0.2s"
      }}
    >
      {icon}
      <span style={{ fontSize: "8px", fontWeight: 800, textTransform: "uppercase" }}>{label}</span>
    </button>
  );
}
