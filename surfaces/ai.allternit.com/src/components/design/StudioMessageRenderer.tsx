"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { splitOnArtifacts, MessageSegment } from "../../lib/openui/artifact-parser";
import { splitOnQuestionForms, FormSegment } from "../../lib/openui/question-form-parser";
import { ArtifactPreviewPane } from "./ArtifactPreviewPane";
import { QuestionFormView } from "./QuestionFormView";
import { lintGeneratedHtml, type LintResult } from "../../lib/design/html-linter";
import { cn } from "@/lib/utils";

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
    <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">{children}</p>
          ),
          code: ({ children }) => (
            <code className="bg-[var(--surface-panel,rgba(255,255,255,0.06))] rounded-[3px] px-1 py-0.5 text-[12px] font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-[var(--surface-panel,rgba(255,255,255,0.06))] border border-solid border-[var(--border-default,rgba(255,255,255,0.08))] rounded-md p-3 overflow-x-auto text-[12px] leading-relaxed my-2">
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
    <div className="mb-2">
      <button type="button"
        onClick={() => setExpanded(e => !e)}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1 rounded-md border-none cursor-pointer text-[12px] font-bold transition-colors",
          errors.length > 0 ? "bg-red-500/10 text-[#ef4444]" : "bg-amber-500/10 text-[#ca8a04]"
        )}
      >
        Quality: {result.score}/100
        {errors.length > 0 && ` · ${errors.length} error${errors.length !== 1 ? 's' : ''}`}
        {warnings.length > 0 && ` · ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}`}
      </button>
      {expanded && (
        <div className="mt-1 p-[8px_12px] bg-[var(--bg-secondary)] rounded-lg border border-solid border-[var(--border-subtle)] space-y-1">
          {result.violations.map((v) => (
            <div key={`${v.rule}-${v.message}`} className="text-[12px] leading-relaxed">
              <strong className={cn(v.severity === 'error' ? "text-[#ef4444]" : "text-[#ca8a04]")}>
                {v.severity.toUpperCase()}
              </strong>{" "}
              <span className="text-[var(--text-tertiary)]">[{v.rule}]:</span> {v.message}
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
      return <ProseBlock key={`prose-${seg.content.length}-${i}`} text={seg.content} />;
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
      <div className="text-[13px] text-[var(--text-primary)] leading-relaxed">
        {content}
      </div>
    );
  }

  // Layer 1: split on <artifact> blocks
  const artifactSegments: MessageSegment[] = splitOnArtifacts(content);

  return (
    <div className="flex flex-col gap-3">
      {artifactSegments.map((seg, i) => {
        if (seg.kind === "artifact") {
          const artifactHtml = htmlOverrides[seg.artifact.identifier] ?? seg.artifact.content;
          const lintResult = lintGeneratedHtml(artifactHtml);
          return (
            <div key={`${seg.artifact.identifier}-${i}`}>
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
          <div key={`form-seg-${i}`} className="flex flex-col gap-2.5">
            {renderFormSegments(formSegments, isLast, onSubmitForm)}
          </div>
        );
      })}
    </div>
  );
}
