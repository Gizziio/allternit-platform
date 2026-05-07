import { memo } from "react";
import { IconPhoto, IconExternalLink } from "@tabler/icons-react";
import { ToolRowBase } from "./tool-row-base";
import { cn } from "../utils/cn";

export type ImageSearchResult = {
  url: string;
  title?: string;
  source?: string;
  width?: number;
  height?: number;
};

export type ImageSearchToolProps = {
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

function normalizeImageResults(value: unknown): ImageSearchResult[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const raw = v.results ?? v.images ?? v;
  if (!Array.isArray(raw)) {
    // Maybe it's a single image object
    if (raw && typeof raw === "object" && "url" in raw) {
      const single = normalizeSingleImage(raw);
      return single ? [single] : undefined;
    }
    return undefined;
  }
  return raw
    .map(normalizeSingleImage)
    .filter((item): item is ImageSearchResult => Boolean(item?.url));
}

function normalizeSingleImage(value: unknown): ImageSearchResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const url = typeof v.url === "string" ? v.url : typeof v.imageUrl === "string" ? v.imageUrl : undefined;
  if (!url) return undefined;
  return {
    url,
    title: typeof v.title === "string" ? v.title : undefined,
    source: typeof v.source === "string" ? v.source : undefined,
    width: typeof v.width === "number" ? v.width : undefined,
    height: typeof v.height === "number" ? v.height : undefined,
  };
}

export const ImageSearchTool = memo(function ImageSearchTool({
  part,
  defaultOpen = false,
}: ImageSearchToolProps) {
  const isPending =
    part.state !== "output-available" && part.state !== "output-error";

  const query =
    typeof part.input?.query === "string"
      ? part.input.query
      : typeof part.args?.query === "string"
        ? part.args.query
        : undefined;

  const results =
    normalizeImageResults(part.output) ??
    normalizeImageResults(part.result) ??
    normalizeImageResults(part.input) ??
    normalizeImageResults(part.args) ??
    [];

  return (
    <ToolRowBase
      icon={<IconPhoto className="w-full h-full text-muted-foreground" />}
      shimmerLabel={query ? `Searching images for "${query}"...` : "Searching images..."}
      completeLabel={
        query
          ? `Found ${results.length} image${results.length !== 1 ? "s" : ""} for "${query}"`
          : `Found ${results.length} image${results.length !== 1 ? "s" : ""}`
      }
      isAnimating={isPending}
      expandable={results.length > 0}
      defaultOpen={defaultOpen}
    >
      <div className="rounded-an-tool-border-radius border border-border bg-an-tool-background overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 p-1.5 max-h-[320px] overflow-y-auto">
          {results.map((img, i) => (
            <a
              key={i}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "group relative aspect-square rounded-[calc(var(--an-tool-border-radius)-4px)] overflow-hidden",
                "bg-muted border border-border hover:border-muted-foreground/30 transition-colors"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.title || `Image result ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                {img.title && (
                  <span className="text-[11px] text-white font-medium line-clamp-2">
                    {img.title}
                  </span>
                )}
                <div className="flex items-center gap-1 mt-0.5">
                  <IconExternalLink className="w-3 h-3 text-white/80" />
                  {img.source && (
                    <span className="text-[10px] text-white/70 truncate">{img.source}</span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </ToolRowBase>
  );
});
