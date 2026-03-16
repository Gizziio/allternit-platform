"use client";

import { memo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

// Override oneDark so every token is clearly legible on the dark app background.
// The key fix: plain identifiers/variables get an explicit light colour instead of
// inheriting the code-block background (which is nearly invisible in vscDarkPlus).
const codeTheme: Record<string, React.CSSProperties> = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: "#1a1d2e",
    margin: 0,
    borderRadius: 0,
    fontSize: "0.8rem",
    lineHeight: "1.65",
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: "transparent",
    color: "#abb2bf",   // clear light grey for plain identifiers
  },
  // Ensure plain text / identifiers are always visible
  'token': { color: "#abb2bf" },
  'plain': { color: "#abb2bf" },
};
import { cn } from "@/lib/utils";

// Standalone component so it can use React hooks (useState) correctly
function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }, [code]);

  return (
    <button
      onClick={handleCopy}
      style={{
        fontSize: "11px",
        color: copied ? "rgba(74,222,128,0.8)" : "rgba(255,255,255,0.35)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "2px 4px",
        transition: "color 0.15s ease",
        fontWeight: copied ? 600 : 400,
      }}
      onMouseEnter={e => { if (!copied) e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
      onMouseLeave={e => { if (!copied) e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

interface MarkdownProps {
  children: string;
  className?: string;
  isStreaming?: boolean;
}

export const Markdown = memo(function Markdown({ children, className, isStreaming }: MarkdownProps) {
  return (
    // is-streaming class enables the per-block fade-in animation in index.css
    <div className={cn("markdown-content relative", isStreaming && "is-streaming", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";

          if (!inline && language) {
            return (
              <div className="my-3 rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.09)" }}>
                {/* Code block header */}
                <div className="flex items-center justify-between px-4 py-1.5" style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                    {language}
                  </span>
                  <CodeCopyButton code={String(children).replace(/\n$/, "")} />
                </div>
                <SyntaxHighlighter
                  style={codeTheme}
                  language={language}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: 0, background: "#1a1d2e", fontSize: "0.8rem", lineHeight: "1.65" }}
                  {...props}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            );
          }

          // Inline code — amber tint so identifiers stand out from prose
          return (
            <code
              className={cn("font-mono", className)}
              style={{
                fontSize: "0.82em",
                padding: "0.15em 0.4em",
                borderRadius: "4px",
                background: "rgba(212,176,140,0.10)",
                border: "1px solid rgba(212,176,140,0.18)",
                color: "rgba(212,176,140,0.9)",
              }}
              {...props}
            >
              {children}
            </code>
          );
        },
        p({ children, ...props }) {
          return (
            <p style={{ margin: 0, marginBottom: "0.85rem", lineHeight: 1.75 }} className="last:mb-0" {...props}>
              {children}
              {isStreaming && (
                <span
                  className="a2r-stream-cursor inline-block ml-0.5"
                  aria-hidden="true"
                  style={{
                    width: '2px',
                    height: '1em',
                    background: '#D4B08C',
                    animation: 'blink 0.8s step-end infinite',
                    verticalAlign: 'text-bottom',
                  }}
                />
              )}
            </p>
          );
        },
        ul({ children }) {
          return <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>;
        },
        li({ children }) {
          return <li style={{ lineHeight: 1.65 }}>{children}</li>;
        },
        // Headings: scaled for chat message width (not document width)
        h1({ children }) {
          return <h1 style={{ fontSize: "1.2rem", fontWeight: 700, margin: "1.2rem 0 0.6rem", lineHeight: 1.4 }}>{children}</h1>;
        },
        h2({ children }) {
          return <h2 style={{ fontSize: "1.05rem", fontWeight: 700, margin: "1rem 0 0.5rem", lineHeight: 1.4 }}>{children}</h2>;
        },
        h3({ children }) {
          return <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0.9rem 0 0.4rem", lineHeight: 1.4 }}>{children}</h3>;
        },
        h4({ children }) {
          return <h4 style={{ fontSize: "0.875rem", fontWeight: 600, margin: "0.8rem 0 0.3rem" }}>{children}</h4>;
        },
        blockquote({ children }) {
          return (
            <blockquote style={{ borderLeft: "3px solid rgba(212,176,140,0.4)", paddingLeft: "1rem", margin: "0.75rem 0", color: "rgba(236,236,236,0.6)", fontStyle: "italic" }}>
              {children}
            </blockquote>
          );
        },
        a({ children, href }) {
          return (
            <a
              href={href}
              style={{ color: "#D4B08C", textDecoration: "underline", textUnderlineOffset: "3px" }}
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return <thead style={{ background: "rgba(255,255,255,0.04)" }}>{children}</thead>;
        },
        th({ children }) {
          return (
            <th style={{ fontWeight: 600, textAlign: "left", padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td style={{ padding: "5px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {children}
            </td>
          );
        },
        hr() {
          return <hr style={{ margin: "1.25rem 0", border: "none", borderTop: "1px solid rgba(255,255,255,0.08)" }} />;
        },
        strong({ children }) {
          return <strong style={{ fontWeight: 600 }}>{children}</strong>;
        },
        em({ children }) {
          return <em style={{ fontStyle: "italic" }}>{children}</em>;
        },
        del({ children }) {
          return <del style={{ opacity: 0.6, textDecoration: "line-through" }}>{children}</del>;
        },
      }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
});
