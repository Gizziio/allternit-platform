"use client";

import React, { useState, useMemo } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useUnifiedStore } from "@/lib/agents/unified.store";
import { Brain, Cpu, ShieldCheck, Database, Wrench } from "@phosphor-icons/react";

interface ContextWindowCardProps {
  children: React.ReactNode;
  threadId?: string | null;
}

export function ContextWindowCard({ children, threadId: propThreadId }: ContextWindowCardProps) {
  const [open, setOpen] = useState(false);
  const selectedThreadId = useUnifiedStore(s => s.selectedThreadId);
  const threadId = propThreadId || selectedThreadId;
  
  const getSessionAnalytics = useUnifiedStore(s => s.getSessionAnalytics);
  const analytics = useMemo(() => threadId ? getSessionAnalytics(threadId) : null, [threadId, getSessionAnalytics]);

  // Dynamic context math
  const totalContext = 200000;
  const inputTokens = analytics?.tokenUsage?.input || 0;
  const outputTokens = analytics?.tokenUsage?.output || 0;
  const usedContext = inputTokens + outputTokens;
  const usedPercent = Math.round((usedContext / totalContext) * 100);

  // Extensive metadata
  const memoryCount = analytics?.receiptKinds?.['memory_recall'] || 0;
  const toolCount = analytics?.toolCallCount || 0;
  const participantCount = analytics?.participants?.length || 1;

  const breakdown = [
    { label: "Messages", value: Math.round(usedContext * 0.7), color: "#3b82f6" },
    { label: "System prompt", value: 8600, color: "#60a5fa" },
    { label: "Neural Context", value: memoryCount * 1200, color: "#93c5fd" },
    { label: "Active Tools", value: toolCount * 800, color: "#bfdbfe" },
  ];

  const planUsage = [
    { label: "On-Device Privacy", percent: usedContext > 0 ? "100%" : "0%", color: "#22c55e" },
    { label: "Model Capability", percent: "98%", color: "#3b82f6" },
  ];

  const formatK = (val: number) => {
    if (val >= 1000) return (val / 1000).toFixed(1) + "k";
    return val.toString();
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {children}
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="start"
        sideOffset={12}
        style={{
          width: "300px",
          backgroundColor: "#161616",
          borderRadius: "14px",
          border: "1px solid var(--ui-border-muted)",
          boxShadow: "0 20px 50px var(--shell-overlay-backdrop), 0 0 0 1px var(--surface-hover)",
          padding: "20px",
          zIndex: 165,
          color: "#fff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          animation: "fade-in 0.2s ease-out",
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "12px" }}>
          <span style={{ fontSize: "11px", color: "rgba(212,176,140,0.5)", fontWeight: 700, uppercase: "true", letterSpacing: "0.1em" } as any}>CONTEXT ARCHITECTURE</span>
          <span style={{ fontSize: "12px", color: "#fff", fontWeight: 600 }}>
            {formatK(usedContext)} / {formatK(totalContext)}
          </span>
        </div>

        {/* Dynamic Progress Bar */}
        <div style={{ height: "6px", backgroundColor: "var(--surface-hover)", borderRadius: "3px", display: "flex", overflow: "hidden", marginBottom: "20px" }}>
          <div style={{ width: `${Math.max(2, usedPercent)}%`, backgroundColor: "#D4956A", boxShadow: "0 0 10px rgba(212,149,106,0.3)" }} />
        </div>

        {/* Extensive Neural Breakdown */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
          <ContextRow icon={<Brain size={14}/>} label="Neural Memories" value={`${memoryCount} linked`} />
          <ContextRow icon={<Wrench size={14}/>} label="Tool Schema" value={`${toolCount} active`} />
          <ContextRow icon={<Database size={14}/>} label="Vector Knowledge" value={`${formatK(12400)} nodes`} />
          <ContextRow icon={<Cpu size={14}/>} label="Inference" value={analytics?.participants[0] || "Private Brain"} />
        </div>

        <div style={{ height: "1px", backgroundColor: "var(--ui-border-muted)", margin: "16px -20px" }} />

        {/* Sovereignty Metrics */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "rgba(212,176,140,0.5)", fontWeight: 700 }}>SOVEREIGNTY</span>
            <ShieldCheck size={14} className="text-green-500" />
          </div>
          {planUsage.map((plan) => (
            <div key={plan.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#aaa", marginBottom: "6px" }}>
                <span>{plan.label}</span>
                <span style={{ color: "#fff", fontWeight: 600 }}>{plan.percent}</span>
              </div>
              <div style={{ height: "2px", backgroundColor: "var(--surface-hover)", width: "100%", borderRadius: "1px" }}>
                <div style={{ height: "100%", width: plan.percent, backgroundColor: plan.color, borderRadius: "1px" }} />
              </div>
            </div>
          ))}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}

function ContextRow({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "rgba(255,255,255,0.6)" }}>
        {icon}
        <span>{label}</span>
      </div>
      <span style={{ color: "#fff", fontWeight: 500, fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}
