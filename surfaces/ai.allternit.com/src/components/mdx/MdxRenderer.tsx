"use client";

import { useEffect, useState, type ReactNode } from "react";
import { run } from "@mdx-js/mdx";
import * as runtime from "react/jsx-runtime";
import { MDXProvider, useMDXComponents } from "@mdx-js/react";
import {
  Graph,
  GraphBody,
  GraphArrow,
  GraphTable,
  GraphFlow,
  GraphBars,
  GraphRank,
  GraphCells,
  GraphMeter,
  GraphSpark,
  GraphTree,
  GraphTimeline,
  GraphStack,
  GraphFunnel,
  GraphGantt,
  GraphPlot,
  GraphWaffle,
  GraphDiff,
  GraphInvoice,
  GraphCompare,
  GraphStat,
  GraphKpi,
  GraphSpec,
  GraphActivity,
  GraphHeatmap,
  GraphCalendar,
  GraphWaterfall,
  GraphUptime,
  GraphSlope,
  GraphBullet,
  GraphTimer,
  GraphCountdown,
} from "@/lib/index";

export interface MdxRendererProps {
  source: string;
  className?: string;
}

const mdxComponents: Record<string, React.ComponentType<any>> = {
  h1: ({ children, ...props }: { children: ReactNode }) => (
    <h1 className="an-md-h1 text-base font-semibold mt-3 mb-1.5" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: { children: ReactNode }) => (
    <h2 className="an-md-h2 text-base font-semibold mt-3 mb-1.5" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: { children: ReactNode }) => (
    <h3 className="an-md-h3 text-sm font-semibold mt-2 mb-1" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }: { children: ReactNode }) => (
    <p className="an-md-p text-sm leading-relaxed text-an-foreground/80 mb-2" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }: { children: ReactNode }) => (
    <ul className="an-md-ul list-disc list-outside space-y-0.5 text-sm mb-2 pl-4 text-an-foreground/80" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: { children: ReactNode }) => (
    <ol className="an-md-ol list-decimal list-outside space-y-0.5 text-sm mb-2 pl-5 text-an-foreground/80" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: { children: ReactNode }) => (
    <li className="an-md-li text-sm pl-0.5 text-an-foreground/80" {...props}>
      {children}
    </li>
  ),
  strong: ({ children, ...props }: { children: ReactNode }) => (
    <strong className="font-medium text-an-foreground" {...props}>
      {children}
    </strong>
  ),
  a: ({ href, children, ...props }: { href?: string; children: ReactNode }) => {
    if (!href) return <span>{children}</span>;
    const isExternal = href.startsWith("http") || href.startsWith("mailto:");
    return (
      <a
        {...props}
        href={href}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="an-md-link hover:underline underline-offset-2 text-an-primary-color"
      >
        {children}
      </a>
    );
  },
  code: ({ children, ...props }: { children: ReactNode }) => (
    <code className="bg-[var(--surface-panel,rgba(255,255,255,0.06))] rounded-[3px] px-1 py-0.5 text-[12px] font-mono" {...props}>
      {children}
    </code>
  ),
  Graph,
  GraphBody,
  GraphArrow,
  GraphTable,
  GraphFlow,
  GraphBars,
  GraphRank,
  GraphCells,
  GraphMeter,
  GraphSpark,
  GraphTree,
  GraphTimeline,
  GraphStack,
  GraphFunnel,
  GraphGantt,
  GraphPlot,
  GraphWaffle,
  GraphDiff,
  GraphInvoice,
  GraphCompare,
  GraphStat,
  GraphKpi,
  GraphSpec,
  GraphActivity,
  GraphHeatmap,
  GraphCalendar,
  GraphWaterfall,
  GraphUptime,
  GraphSlope,
  GraphBullet,
  GraphTimer,
  GraphCountdown,
};

function MdxContent({ Component }: { Component: React.ComponentType }) {
  return (
    <div className="an-mdx-graphs">
      <Component />
    </div>
  );
}

export function MdxRenderer({ source, className }: MdxRendererProps) {
  const [Content, setContent] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setContent(null);

    run(source, {
      ...runtime,
      useMDXComponents,
    })
      .then((Mod) => {
        if (cancelled) return;
        const Comp = (Mod as { default: React.ComponentType }).default;
        setContent(() => Comp);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (error) {
    return (
      <div
        className={`rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400 ${className ?? ""}`}
      >
        <p className="font-medium">Failed to render MDX</p>
        <p className="mt-1 font-mono text-xs opacity-80">{error}</p>
      </div>
    );
  }

  if (!Content) {
    return (
      <div className={`text-sm text-an-foreground/60 ${className ?? ""}`}>
        Rendering chart…
      </div>
    );
  }

  return (
    <MDXProvider components={mdxComponents}>
      <div className={className}>
        <MdxContent Component={Content} />
      </div>
    </MDXProvider>
  );
}

export default MdxRenderer;
