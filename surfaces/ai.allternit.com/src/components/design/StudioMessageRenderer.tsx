"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { splitOnArtifacts, MessageSegment } from "../../lib/openui/artifact-parser";
import { splitOnQuestionForms, FormSegment } from "../../lib/openui/question-form-parser";
import { ArtifactPreviewPane } from "./ArtifactPreviewPane";
import { QuestionFormView } from "./QuestionFormView";
import { lintGeneratedHtml, type LintResult } from "../../lib/design/html-linter";

interface ChatMessage {
  role: string;
  content?: string;
}

interface Props {
  message: ChatMessage;
  isLast: boolean;
  onSubmitForm: (text: string) => void;
}

function ProseBlock({ text }: { text: string }) {
  const clean = text.replace(/\??\[v:[\s\S]*/, "").trim();
  if (!clean) return null;
  return (
    <div
      style={{
        fontSize: "13px",
        color: "var(--text-secondary)",
        lineHeight: 1.6,
      }}
    >
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p style={{ margin: "0 0 8px 0" }}>{children}</p>
          ),
          code: ({ children }) => (
            <code
              style={{
                background: "var(--surface-panel, rgba(255,255,255,0.06))",
                borderRadius: "3px",
                padding: "1px 4px",
                fontSize: "12px",
                fontFamily: 'var(--font-mono)',
              }}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              style={{
                background: "var(--surface-panel, rgba(255,255,255,0.06))",
                border: "1px solid var(--border-default, rgba(255,255,255,0.08))",
                borderRadius: "6px",
                padding: "12px",
                overflowX: "auto",
                fontSize: "12px",
                lineHeight: 1.5,
                margin: "8px 0",
              }}
            >
              {children}
            </pre>
          ),
        }}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}

function LintBadge({ result }: { result: LintResult }) {
  const [expanded, setExpanded] = useState(false);
  const errors = result.violations.filter(v => v.severity === 'error');
  const warnings = result.violations.filter(v => v.severity === 'warning');
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: errors.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
          color: errors.length > 0 ? '#ef4444' : '#ca8a04',
          fontSize: 12, fontWeight: 700,
        }}
      >
        Quality: {result.score}/100
        {errors.length > 0 && ` · ${errors.length} error${errors.length !== 1 ? 's' : ''}`}
        {warnings.length > 0 && ` · ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
      </button>
      {expanded && (
        <div style={{ marginTop: 4, padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
          {result.violations.map((v, i) => (
            <div key={i} style={{ fontSize: 12, color: v.severity === 'error' ? '#ef4444' : '#ca8a04', lineHeight: 1.5, marginBottom: 4 }}>
              <strong>{v.severity.toUpperCase()}</strong> [{v.rule}]: {v.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderFormSegments(
  segments: FormSegment[],
  isLast: boolean,
  onSubmitForm: (text: string) => void,
) {
  return segments.map((seg, i) => {
    if (seg.kind === "text") {
      return <ProseBlock key={i} text={seg.content} />;
    }
    return (
      <QuestionFormView
        key={seg.form.id}
        form={seg.form}
        onSubmit={isLast ? onSubmitForm : () => {}}
      />
    );
  });
}

export function StudioMessageRenderer({ message, isLast, onSubmitForm }: Props) {
  const content = message.content ?? "";
  const [htmlOverrides, setHtmlOverrides] = useState<Record<string, string>>({});

  if (message.role !== "assistant") {
    return (
      <div style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.5 }}>
        {content}
      </div>
    );
  }

  // Layer 1: split on <artifact> blocks
  const artifactSegments: MessageSegment[] = splitOnArtifacts(content);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {artifactSegments.map((seg, i) => {
        if (seg.kind === "artifact") {
          const artifactHtml = htmlOverrides[seg.artifact.identifier] ?? seg.artifact.content;
          const lintResult = lintGeneratedHtml(artifactHtml);
          return (
            <div key={seg.artifact.identifier + i}>
              {lintResult.violations.length > 0 && (
                <LintBadge result={lintResult} />
              )}
              <ArtifactPreviewPane
                html={artifactHtml}
                title={seg.artifact.title}
                identifier={seg.artifact.identifier}
                height={seg.artifact.type === "text/html" ? 520 : 320}
                onHtmlChange={(updatedHtml) => {
                  setHtmlOverrides(prev => ({ ...prev, [seg.artifact.identifier]: updatedHtml }));
                }}
              />
            </div>
          );
        }

        // Layer 2: within text segments, split on <question-form> blocks
        const formSegments = splitOnQuestionForms(seg.content);
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {renderFormSegments(formSegments, isLast, onSubmitForm)}
          </div>
        );
      })}
    </div>
  );
}
