"use client";

import {
  Node as FlowNode,
  NodeTypes,
  PanOnScrollMode,
  ReactFlow,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@xyflow/react/dist/style.css";

export type AgentType =
  | "developer_agent"
  | "browser_agent"
  | "document_agent"
  | "research_agent"
  | "multi_modal_agent";

export interface AgentTask {
  id: string;
  title: string;
  status: "waiting" | "running" | "completed" | "failed" | "skipped";
}

export interface CoworkAgent {
  agent_id: string;
  type: AgentType;
  name: string;
  tools: string[];
  tasks: AgentTask[];
  screenshotUrl?: string;
}

interface NodeData {
  agent: CoworkAgent;
  isExpanded?: boolean;
  onExpandChange?: (nodeId: string, isExpanded: boolean) => void;
  onTakeover?: (agentId: string) => void;
  [key: string]: unknown;
}

type CustomNode = FlowNode<NodeData>;

const AGENT_COLORS: Record<AgentType, { bg: string; text: string; border: string }> = {
  developer_agent: { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
  browser_agent: { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6" },
  document_agent: { bg: "#fef9c3", text: "#854d0e", border: "#eab308" },
  research_agent: { bg: "#ede9fe", text: "#5b21b6", border: "#8b5cf6" },
  multi_modal_agent: { bg: "#fae8ff", text: "#86198f", border: "#d946ef" },
};

function AgentNode({ data }: { data: NodeData }) {
  const { agent, isExpanded, onExpandChange, onTakeover } = data;
  const colors = AGENT_COLORS[agent.type] ?? AGENT_COLORS.developer_agent;
  const done = agent.tasks.filter((t) => t.status === "completed").length;
  const running = agent.tasks.filter((t) => t.status === "running").length;
  const failed = agent.tasks.filter((t) => t.status === "failed").length;

  return (
    <div
      style={{
        width: isExpanded ? 684 : 342,
        minHeight: 160,
        borderRadius: 16,
        border: `1.5px solid ${colors.border}`,
        background: colors.bg,
        padding: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "width 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{agent.name}</span>
        <div style={{ display: "flex", gap: 6 }}>
          {agent.screenshotUrl && onTakeover && (
            <button
              onClick={() => onTakeover(agent.agent_id)}
              style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${colors.border}`, background: "white", color: colors.text, cursor: "pointer" }}
            >
              Take Control
            </button>
          )}
          <button
            onClick={() => onExpandChange?.(agent.agent_id, !isExpanded)}
            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: `1px solid ${colors.border}`, background: "white", color: colors.text, cursor: "pointer" }}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, fontSize: 11, color: "#64748b" }}>
        {done > 0 && <span style={{ color: "#10b981" }}>{done} done</span>}
        {running > 0 && <span style={{ color: "#3b82f6" }}>{running} running</span>}
        {failed > 0 && <span style={{ color: "#ef4444" }}>{failed} failed</span>}
        {agent.tasks.length === 0 && <span>idle</span>}
      </div>

      {isExpanded && (
        <>
          {agent.screenshotUrl && (
            <img
              src={agent.screenshotUrl}
              alt={`${agent.name} screenshot`}
              style={{ borderRadius: 8, objectFit: "contain", maxHeight: 300, border: "1px solid #e2e8f0" }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {agent.tasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  borderRadius: 6,
                  background: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      task.status === "completed" ? "#10b981" :
                      task.status === "running" ? "#3b82f6" :
                      task.status === "failed" ? "#ef4444" : "#94a3b8",
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "#1e293b" }}>{task.title}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
            Tools: {agent.tools.join(" · ")}
          </div>
        </>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  agentNode: (props: any) => <AgentNode {...props} />,
};

const VIEWPORT_ANIMATION_DURATION = 400;

interface WorkflowPipelineProps {
  agents: CoworkAgent[];
  onTakeover?: (agentId: string) => void;
}

export function WorkflowPipeline({ agents, onTakeover }: WorkflowPipelineProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CustomNode>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const { setViewport, getViewport } = useReactFlow();

  const totalNodesWidth = useMemo(() => {
    if (!nodes.length) return 0;
    const widths = nodes.map((n) => (n.data.isExpanded ? 684 : 342));
    return widths.reduce((s, w) => s + w, 0) + Math.max(nodes.length - 1, 0) * 20 + 16;
  }, [nodes]);

  const minViewportX = useMemo(() => {
    if (!containerWidth) return 0;
    return Math.min(0, containerWidth - Math.max(totalNodesWidth, containerWidth));
  }, [containerWidth, totalNodesWidth]);

  const clampX = useCallback((x: number) => Math.min(0, Math.max(minViewportX, x)), [minViewportX]);

  const handleExpandChange = useCallback((nodeId: string, isExpanded: boolean) => {
    setNodes((prev: CustomNode[]) => {
      let currentX = 8;
      return prev.map((node) => {
        const expanded = node.id === nodeId ? isExpanded : !!node.data.isExpanded;
        const w = expanded ? 684 : 342;
        const position = { x: currentX, y: 16 };
        currentX += w + 20;
        return { ...node, position, data: { ...node.data, isExpanded: expanded } };
      });
    });
  }, [setNodes]);

  useEffect(() => {
    setNodes(
      agents.map((agent, i) => ({
        id: agent.agent_id,
        type: "agentNode",
        position: { x: i * (342 + 20) + 8, y: 16 },
        data: { agent, isExpanded: false, onExpandChange: handleExpandChange, onTakeover },
      }))
    );
  }, [agents, handleExpandChange, onTakeover, setNodes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const moveViewport = (dx: number) => {
    if (isAnimating) return;
    const v = getViewport();
    setIsAnimating(true);
    setViewport({ x: clampX(v.x + dx), y: v.y, zoom: v.zoom }, { duration: VIEWPORT_ANIMATION_DURATION });
    setTimeout(() => setIsAnimating(false), VIEWPORT_ANIMATION_DURATION);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }} ref={containerRef}>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        proOptions={{ hideAttribution: true }}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        panOnDrag={false}
        panOnScroll
        nodesDraggable={false}
        panOnScrollMode={PanOnScrollMode.Horizontal}
        onMove={(_e, v) => {
          const clamped = clampX(v.x);
          if (clamped !== v.x) setViewport({ ...v, x: clamped });
        }}
      />
      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4, zIndex: 10 }}>
        <button onClick={() => moveViewport(200)} style={navBtnStyle}>←</button>
        <button onClick={() => moveViewport(-200)} style={navBtnStyle}>→</button>
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  background: "white",
  cursor: "pointer",
  fontSize: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
