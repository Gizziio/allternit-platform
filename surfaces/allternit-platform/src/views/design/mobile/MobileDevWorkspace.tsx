import React, { useState } from 'react';
import { DeviceMobile as Smartphone, Play, DeviceMobileCamera, AppWindow, Cpu, WifiHigh } from '@phosphor-icons/react';
import { GlassCard } from '../../../design/GlassCard';
import { DesignMdRenderer } from '@/lib/openui/DesignMdRenderer';

/**
 * Mobile Dev Workspace
 * 
 * Inspired by react-native-vibe-code-sdk.
 * Provides a specialized environment for building and iterating on mobile apps.
 */
export function MobileDevWorkspace({ 
  designMd, 
  mobileCode,
  projectName = "New Mobile App"
}: { 
  designMd: string, 
  mobileCode?: string,
  projectName?: string 
}) {
  const [device, setDevice] = useState<'iphone' | 'android' | 'tablet'>('iphone');

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: "#050505" }}>
      {/* Left: Device Preview */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--ui-border-muted)", padding: "40px" }}>
        
        <div style={{ marginBottom: "24px", display: "flex", gap: "8px" }}>
           <button onClick={() => setDevice('iphone')} style={{ padding: "8px 16px", borderRadius: "8px", background: device === 'iphone' ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'transparent', border: "1px solid", borderColor: device === 'iphone' ? 'var(--accent-primary)' : 'var(--ui-border-default)', color: device === 'iphone' ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>iOS</button>
           <button onClick={() => setDevice('android')} style={{ padding: "8px 16px", borderRadius: "8px", background: device === 'android' ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'transparent', border: "1px solid", borderColor: device === 'android' ? 'var(--accent-primary)' : 'var(--ui-border-default)', color: device === 'android' ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: "11px", fontWeight: 800, cursor: "pointer" }}>Android</button>
        </div>

        {/* Frame */}
        <div style={{ 
          width: device === 'tablet' ? "480px" : "280px", 
          height: device === 'tablet' ? "640px" : "580px", 
          background: "#000", 
          borderRadius: "40px", 
          border: "8px solid #1a1714", 
          boxShadow: "0 24px 64px var(--shell-overlay-backdrop)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column"
        }}>
           <div style={{ flex: 1, overflowY: "auto", background: "#0a0a0c", padding: "24px 16px" }}>
              {/* This would be the React Native Web bridge output */}
              <DesignMdRenderer designMd={designMd} uiStream={`[v:stack spacing=4 [v:card title="${projectName}" [v:metric label="Device" val="${device.toUpperCase()}"] [v:button label="Scan QR for Real Device"]]]`} />
           </div>
           <div style={{ height: "20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: "80px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.2)" }} />
           </div>
        </div>
      </div>

      {/* Right: Vibe Code Controls */}
      <div style={{ width: "380px", display: "flex", flexDirection: "column", background: "rgba(10, 10, 12, 0.5)" }}>
        <div style={{ padding: "20px", borderBottom: "1px solid var(--ui-border-muted)" }}>
           <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
             <Smartphone size={20} color="var(--accent-primary)" weight="duotone" />
             <h3 style={{ fontSize: "13px", fontWeight: 900, color: "#fff", tracking: "-0.01em" }}>Vibe Mobile SDK</h3>
           </div>
           <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", fontWeight: 800, letterSpacing: "0.05em" }}>Iterative Mobile Generation</p>
        </div>

        <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
           <GlassCard style={{ padding: "16px", background: "rgba(59,130,246,0.05)" }}>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "#60a5fa", marginBottom: "12px", textTransform: "uppercase" }}>Active Capabilities</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                 <StatusItem icon={<Cpu size={14} />} label="Haptic Engine" active />
                 <StatusItem icon={<WifiHigh size={14} />} label="Push Services" active />
                 <StatusItem icon={<DeviceMobileCamera size={14} />} label="Camera API" />
                 <StatusItem icon={<AppWindow size={14} />} label="Deep Links" />
              </div>
           </GlassCard>

           <div style={{ flex: 1 }}>
              <div style={{ fontSize: "10px", fontWeight: 800, color: "rgba(255,255,255,0.3)", marginBottom: "8px", textTransform: "uppercase" }}>Generated Component DNA</div>
              <div style={{ height: "200px", background: "var(--surface-panel)", border: "1px solid var(--ui-border-muted)", borderRadius: "12px", padding: "12px", overflow: "auto" }}>
                 <pre style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", fontMono: "monospace", margin: 0 }}>
                    {mobileCode || `// Expo/React Native logic\n// (Waiting for agent to stream...)\n\nimport { View, Text } from 'react-native';\n\nexport default function App() {\n  return (\n    <View>\n      <Text>Initialized</Text>\n    </View>\n  );\n}`}
                 </pre>
              </div>
           </div>

           <button style={{ width: "100%", padding: "14px", borderRadius: "10px", background: "var(--accent-primary)", color: "#000", fontWeight: 900, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <Play weight="fill" size={16} /> Open in Expo Go
           </button>
        </div>
      </div>
    </div>
  );
}

function StatusItem({ icon, label, active }: { icon: React.ReactNode, label: string, active?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", opacity: active ? 1 : 0.3 }}>
      <div style={{ color: active ? 'var(--accent-primary)' : '#fff' }}>{icon}</div>
      <span style={{ fontSize: "11px", fontWeight: 600, color: "#fff" }}>{label}</span>
    </div>
  );
}
