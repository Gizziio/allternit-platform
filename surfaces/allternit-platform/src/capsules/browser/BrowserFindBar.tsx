"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, CaretUp, CaretDown } from "@phosphor-icons/react";
import {
  BACKGROUND,
  TEXT,
  BORDER,
  RADIUS,
  SHADOW,
  TYPOGRAPHY,
} from "@/design/allternit.tokens";

interface BrowserFindBarProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onClose: () => void;
}

export function BrowserFindBar({ iframeRef, onClose }: BrowserFindBarProps) {
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightsRef = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clearHighlights = useCallback(() => {
    highlightsRef.current.forEach((el) => {
      const parent = el.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(el.textContent || ""), el);
        parent.normalize();
      }
    });
    highlightsRef.current = [];
  }, []);

  const highlightMatches = useCallback(
    (searchQuery: string) => {
      clearHighlights();
      const iframe = iframeRef.current;
      if (!iframe || !searchQuery.trim()) {
        setMatchCount(0);
        setCurrentMatch(0);
        return;
      }
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc || !doc.body) return;
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);
        const textNodes: Text[] = [];
        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node.textContent?.toLowerCase().includes(searchQuery.toLowerCase())) {
            textNodes.push(node as Text);
          }
        }
        let count = 0;
        textNodes.forEach((textNode) => {
          const text = textNode.textContent || "";
          const lowerText = text.toLowerCase();
          const lowerQuery = searchQuery.toLowerCase();
          let idx = 0;
          const fragment = doc.createDocumentFragment();
          let lastIndex = 0;
          while ((idx = lowerText.indexOf(lowerQuery, lastIndex)) !== -1) {
            if (idx > lastIndex) {
              fragment.appendChild(doc.createTextNode(text.slice(lastIndex, idx)));
            }
            const mark = doc.createElement("span");
            mark.style.backgroundColor = "rgba(105,168,200,0.4)";
            mark.style.color = "#fff";
            mark.style.borderRadius = "2px";
            mark.style.padding = "0 2px";
            mark.textContent = text.slice(idx, idx + searchQuery.length);
            fragment.appendChild(mark);
            highlightsRef.current.push(mark);
            count++;
            lastIndex = idx + searchQuery.length;
          }
          if (lastIndex < text.length) {
            fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
          }
          const parent = textNode.parentNode;
          if (parent) {
            parent.replaceChild(fragment, textNode);
          }
        });
        setMatchCount(count);
        setCurrentMatch(count > 0 ? 1 : 0);
        if (count > 0 && highlightsRef.current[0]) {
          highlightsRef.current[0].scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } catch {
        // Cross-origin iframe — can't access content
        setMatchCount(0);
        setCurrentMatch(0);
      }
    },
    [iframeRef, clearHighlights]
  );

  const navigateMatch = useCallback(
    (direction: 1 | -1) => {
      if (matchCount === 0) return;
      const next = ((currentMatch - 1 + direction + matchCount) % matchCount) + 1;
      setCurrentMatch(next);
      const el = highlightsRef.current[next - 1];
      if (el) {
        highlightsRef.current.forEach((h, i) => {
          h.style.backgroundColor = i === next - 1 ? "rgba(105,168,200,0.8)" : "rgba(105,168,200,0.4)";
        });
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [matchCount, currentMatch]
  );

  useEffect(() => {
    const timer = setTimeout(() => highlightMatches(query), 150);
    return () => {
      clearTimeout(timer);
      clearHighlights();
    };
  }, [query, highlightMatches, clearHighlights]);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        background: BACKGROUND.secondary,
        borderBottom: `1px solid ${BORDER.subtle}`,
        backdropFilter: "blur(12px)",
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") navigateMatch(e.shiftKey ? -1 : 1);
          if (e.key === "Escape") onClose();
        }}
        placeholder="Find in page..."
        style={{
          flex: 1,
          maxWidth: 320,
          height: 28,
          padding: "0 10px",
          borderRadius: RADIUS.md,
          border: `1px solid ${BORDER.subtle}`,
          background: BACKGROUND.primary,
          color: TEXT.primary,
          fontSize: TYPOGRAPHY.size.sm,
          outline: "none",
        }}
      />
      {matchCount > 0 && (
        <span style={{ fontSize: TYPOGRAPHY.size.xs, color: TEXT.tertiary, minWidth: 50, textAlign: "center" }}>
          {currentMatch} / {matchCount}
        </span>
      )}
      <button
        onClick={() => navigateMatch(-1)}
        disabled={matchCount === 0}
        style={{
          padding: 4,
          borderRadius: RADIUS.sm,
          border: "none",
          background: "transparent",
          cursor: matchCount === 0 ? "not-allowed" : "pointer",
          color: matchCount === 0 ? TEXT.tertiary : TEXT.secondary,
          opacity: matchCount === 0 ? 0.5 : 1,
          display: "flex",
        }}
      >
        <CaretUp style={{ width: 14, height: 14 }} />
      </button>
      <button
        onClick={() => navigateMatch(1)}
        disabled={matchCount === 0}
        style={{
          padding: 4,
          borderRadius: RADIUS.sm,
          border: "none",
          background: "transparent",
          cursor: matchCount === 0 ? "not-allowed" : "pointer",
          color: matchCount === 0 ? TEXT.tertiary : TEXT.secondary,
          opacity: matchCount === 0 ? 0.5 : 1,
          display: "flex",
        }}
      >
        <CaretDown style={{ width: 14, height: 14 }} />
      </button>
      <button
        onClick={onClose}
        style={{
          padding: 4,
          borderRadius: RADIUS.sm,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: TEXT.tertiary,
          display: "flex",
        }}
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}
