"use client";

import ReactMarkdown from "react-markdown";
import { splitOnArtifacts, MessageSegment } from "../../lib/openui/artifact-parser";
import { splitOnQuestionForms, FormSegment } from "../../lib/openui/question-form-parser";
import { ArtifactPreviewPane } from "./ArtifactPreviewPane";
import { QuestionFormView } from "./QuestionFormView";

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
  const clean = text.replace(/\\\?\[v:[\s\S]*/, "").trim();
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
          return (
            <ArtifactPreviewPane
              key={seg.artifact.identifier + i}
              html={seg.artifact.content}
              title={seg.artifact.title}
              identifier={seg.artifact.identifier}
              height={seg.artifact.type === "text/html" ? 520 : 320}
            />
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
