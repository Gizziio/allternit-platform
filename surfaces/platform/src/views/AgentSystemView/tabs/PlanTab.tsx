/**
 * PlanTab - DAG Planning and Templates
 * 
 * Features:
 * - Natural language DAG creation
 * - Template library
 * - Recent DAGs list
 * - Advanced DAG editor (collapsible)
 */

import React, { useState, useEffect } from "react";
import {
  PaperPlaneTilt,
  FileText,
  Clock,
  CaretDown,
  CaretUp,
  Play,
  DotsThreeOutline,
} from '@phosphor-icons/react';
import { useUnifiedStore } from "@/lib/agents/unified.store";

export function PlanTab() {
  const {
    dags,
    templates,
    currentDag,
    selectedDagId,
    isLoading,
    createDag,
    executeDag,
    selectDag,
    fetchDags,
    executeTemplate,
    setContextMetadata,
  } = useUnifiedStore();

  const [prompt, setPrompt] = useState("");
  const [showTemplates, setShowTemplates] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Fetch DAGs on mount
  useEffect(() => {
    fetchDags();
  }, [fetchDags]);

  const handleCreateDag = async () => {
    if (!prompt.trim()) return;
    try {
      await createDag(prompt);
      setPrompt("");
    } catch (err) {
      // Error handled by store
    }
  };

  const handleExecuteDag = async (dagId: string) => {
    try {
      await executeDag(dagId);
    } catch (err) {
      // Error handled by store
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      const vars: Record<string, string> = {};
      template.variables.forEach((v) => {
        vars[v.name] = v.defaultValue?.toString() || "";
      });
      setTemplateVars(vars);
    }
  };

  const handleExecuteTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await executeTemplate(selectedTemplate, templateVars);
      setSelectedTemplate(null);
      setTemplateVars({});
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Left Panel: Prompt and Templates */}
      <div
        style={{
          width: 400,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border-subtle, #333)",
          background: "var(--bg-secondary, #141414)",
        }}
      >
        {/* Natural Language Input */}
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid var(--border-subtle, #333)",
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              margin: "0 0 12px 0",
              color: "var(--text-primary, #f0f0f0)",
            }}
          >
            Create Plan
          </h3>
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleCreateDag();
                }
              }}
              placeholder="Describe what you want to accomplish..."
              disabled={isLoading}
              style={{
                flex: 1,
                padding: "10px 14px",
                background: "var(--bg-primary, #0a0a0a)",
                border: "1px solid var(--border-subtle, #333)",
                borderRadius: 8,
                color: "var(--text-primary, #f0f0f0)",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              onClick={handleCreateDag}
              disabled={!prompt.trim() || isLoading}
              style={{
                padding: "10px 16px",
                background: "#0a84ff",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                cursor: prompt.trim() && !isLoading ? "pointer" : "not-allowed",
                opacity: prompt.trim() && !isLoading ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PaperPlaneTilt size={16} />
            </button>
          </div>
        </div>

        {/* Template Library */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              cursor: "pointer",
            }}
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <h3
              style={{
                fontSize: 13,
                fontWeight: 600,
                margin: 0,
                color: "var(--text-primary, #f0f0f0)",
              }}
            >
              Templates
            </h3>
            {showTemplates ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </div>

          {showTemplates && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {templates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  isSelected={selectedTemplate === template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  variables={templateVars}
                  onVariableChange={(name, value) =>
                    setTemplateVars((prev) => ({ ...prev, [name]: value }))
                  }
                  onExecute={handleExecuteTemplate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: DAG List and Editor */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Recent DAGs */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 16,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              margin: "0 0 16px 0",
              color: "var(--text-primary, #f0f0f0)",
            }}
          >
            Recent Plans
          </h3>

          {dags.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#666",
              }}
            >
              <FileText size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p>No DAGs yet. Create one using the input on the left.</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {dags.map((dag) => (
                <DagCard
                  key={dag.dagId}
                  dag={dag}
                  isSelected={selectedDagId === dag.dagId}
                  onClick={() => selectDag(dag.dagId)}
                  onExecute={() => handleExecuteDag(dag.dagId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* DAG Editor (Collapsible) */}
        {showEditor && currentDag && (
          <div
            style={{
              height: 300,
              borderTop: "1px solid var(--border-subtle, #333)",
              background: "var(--bg-secondary, #141414)",
              padding: 16,
              overflow: "auto",
            }}
          >
            <h4>DAG Editor: {currentDag.metadata?.title || currentDag.dagId}</h4>
            <pre
              style={{
                fontSize: 12,
                overflow: "auto",
              }}
            >
              {JSON.stringify(currentDag, null, 2)}
            </pre>
          </div>
        )}

        {/* Editor Toggle */}
        <button
          onClick={() => setShowEditor(!showEditor)}
          style={{
            padding: "8px 16px",
            background: "var(--bg-secondary, #141414)",
            border: "none",
            borderTop: "1px solid var(--border-subtle, #333)",
            color: "#888",
            fontSize: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {showEditor ? <CaretDown size={14} /> : <CaretUp size={14} />}
          {showEditor ? "Hide Editor" : "Show Editor"}
        </button>
      </div>
    </div>
  );
}

// Template Card Component
interface TemplateCardProps {
  template: {
    id: string;
    name: string;
    description: string;
    variables: Array<{
      name: string;
      description: string;
      required: boolean;
      defaultValue?: string | number | boolean;
    }>;
  };
  isSelected: boolean;
  onClick: () => void;
  variables: Record<string, string>;
  onVariableChange: (name: string, value: string) => void;
  onExecute: () => void;
}

function TemplateCard({
  template,
  isSelected,
  onClick,
  variables,
  onVariableChange,
  onExecute,
}: TemplateCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 12,
        background: isSelected ? "#0a84ff20" : "var(--bg-primary, #0a0a0a)",
        border: `1px solid ${isSelected ? "#0a84ff" : "var(--border-subtle, #333)"}`,
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary, #f0f0f0)",
          }}
        >
          {template.name}
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: "#888",
          margin: "0 0 8px 0",
        }}
      >
        {template.description}
      </p>

      {isSelected && (
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid var(--border-subtle, #333)",
          }}
        >
          {template.variables.map((variable) => (
            <div
              key={variable.name}
              style={{
                marginBottom: 8,
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#888",
                  marginBottom: 4,
                }}
              >
                {variable.name}
                {variable.required && <span style={{ color: "#ff3b30" }}> *</span>}
              </label>
              <input
                type="text"
                value={variables[variable.name] || ""}
                onChange={(e) => onVariableChange(variable.name, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder={variable.description}
                style={{
                  width: "100%",
                  padding: "6px 10px",
                  background: "var(--bg-primary, #0a0a0a)",
                  border: "1px solid var(--border-subtle, #333)",
                  borderRadius: 6,
                  color: "var(--text-primary, #f0f0f0)",
                  fontSize: 12,
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExecute();
            }}
            style={{
              width: "100%",
              padding: "8px",
              background: "#0a84ff",
              border: "none",
              borderRadius: 6,
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              marginTop: 8,
            }}
          >
            Execute Template
          </button>
        </div>
      )}
    </div>
  );
}

// DAG Card Component
interface DagCardProps {
  dag: {
    dagId: string;
    version: string;
    createdAt: string;
    metadata?: {
      title?: string;
      description?: string;
    };
  };
  isSelected: boolean;
  onClick: () => void;
  onExecute: () => void;
}

function DagCard({ dag, isSelected, onClick, onExecute }: DagCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 16,
        background: isSelected ? "#0a84ff10" : "var(--bg-secondary, #141414)",
        border: `1px solid ${isSelected ? "#0a84ff" : "var(--border-subtle, #333)"}`,
        borderRadius: 8,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          background: "#0a84ff20",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <FileText size={20} color="#0a84ff" />
      </div>

      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary, #f0f0f0)",
            marginBottom: 4,
          }}
        >
          {dag.metadata?.title || dag.dagId}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#888",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>v{dag.version}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Clock size={12} />
            {new Date(dag.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onExecute();
        }}
        style={{
          padding: "8px 16px",
          background: "#10b981",
          border: "none",
          borderRadius: 6,
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Play size={14} />
        Run
      </button>
    </div>
  );
}

export default PlanTab;
