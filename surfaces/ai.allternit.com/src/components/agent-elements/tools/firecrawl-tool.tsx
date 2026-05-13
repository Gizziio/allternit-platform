import { memo } from "react";
import { IconFlame, IconLink, IconExternalLink } from "@tabler/icons-react";
import { ToolRowBase } from "./tool-row-base";
import { cn } from "../utils/cn";

export type ScrapedLink = {
  url: string;
  text?: string;
};

export type ScrapedResult = {
  url?: string;
  markdown?: string;
  html?: string;
  screenshot?: string;
  links?: string[] | ScrapedLink[];
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
  };
  error?: string;
};

export type FirecrawlToolProps = {
  part: {
    id?: string;
    toolCallId?: string;
    type?: string;
    state?: string;
    input?: Record<string, unknown>;
    args?: Record<string, unknown>;
    output?: Record<string, unknown>;
    result?: Record<string, unknown>;
  };
  defaultOpen?: boolean;
};

function normalizeScrapedResult(value: unknown): ScrapedResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const normalizeLinks = (links: unknown): string[] | ScrapedLink[] | undefined => {
    if (!Array.isArray(links)) return undefined;
    const stringLinks: string[] = [];
    const objectLinks: ScrapedLink[] = [];
    for (const item of links) {
      if (typeof item === "string") {
        stringLinks.push(item);
        continue;
      }
      if (item && typeof item === "object") {
        const url = (item as Record<string, unknown>).url;
        if (typeof url === "string") {
          const text = (item as Record<string, unknown>).text;
          objectLinks.push({ url, text: typeof text === "string" ? text : undefined });
        }
      }
    }
    return objectLinks.length > 0 ? objectLinks : stringLinks;
  };

  return {
    url: typeof v.url === "string" ? v.url : undefined,
    markdown: typeof v.markdown === "string" ? v.markdown : undefined,
    html: typeof v.html === "string" ? v.html : undefined,
    screenshot: typeof v.screenshot === "string" ? v.screenshot : undefined,
    links: normalizeLinks(v.links),
    metadata:
      v.metadata && typeof v.metadata === "object"
        ? {
            title: (v.metadata as Record<string, unknown>).title as string | undefined,
            description: (v.metadata as Record<string, unknown>).description as string | undefined,
            sourceURL: (v.metadata as Record<string, unknown>).sourceURL as string | undefined,
          }
        : undefined,
    error: typeof v.error === "string" ? v.error : undefined,
  };
}

export const FirecrawlTool = memo(function FirecrawlTool({
  part,
  defaultOpen = false,
}: FirecrawlToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error";
  const hasError = part.state === "output-error";

  const result =
    normalizeScrapedResult(part.output) ??
    normalizeScrapedResult(part.result) ??
    {};

  const inputUrl =
    (part.input?.url as string) || (part.args?.url as string) || "";
  const url = result.url || inputUrl;
  const title = result.metadata?.title || "";

  const hasContent = !!(
    result.markdown ||
    result.html ||
    result.links?.length ||
    result.error
  );

  const hostname = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  })();

  return (
    <ToolRowBase
      icon={<IconFlame className="w-full h-full text-muted-foreground" />}
      shimmerLabel="Scraping..."
      completeLabel={hasError ? "Scrape failed" : title || hostname || "Scraped"}
      isAnimating={isPending}
      expandable={hasContent}
      defaultOpen={defaultOpen}
      detail={url}
    >
      <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-an-tool-border-color bg-background/50">
          <IconFlame className="size-3.5  text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Firecrawl
          </span>
          {hostname && (
            <span className="text-xs text-muted-foreground/60 truncate">
              {hostname}
            </span>
          )}
        </div>

        {/* Error */}
        {result.error && (
          <div className="px-3 py-2 text-sm text-destructive bg-destructive/5">
            {result.error}
          </div>
        )}

        {/* Content preview */}
        {(result.markdown || result.html) && (
          <div className="px-3 py-2 border-b border-an-tool-border-color">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Content
            </div>
            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-[200px] overflow-y-auto">
              {result.markdown || result.html}
            </div>
          </div>
        )}

        {/* Links */}
        {result.links && result.links.length > 0 && (
          <div className="px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Links ({result.links.length})
            </div>
            <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
              {result.links.map((link, i) => {
                const linkUrl = typeof link === "string" ? link : link.url;
                const linkText = typeof link === "string" ? link : link.text || link.url;
                return (
                  <a
                    key={i}
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-1.5 text-sm px-2 py-1 rounded-[calc(var(--an-tool-border-radius)-4px)]",
                      "hover:bg-muted/50 text-foreground/80"
                    )}
                    title={linkUrl}
                  >
                    <IconLink className="size-3  shrink-0 text-muted-foreground" />
                    <span className="truncate flex-1 min-w-0">{linkText}</span>
                    <IconExternalLink className="size-3  shrink-0 text-muted-foreground/50" />
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ToolRowBase>
  );
});
