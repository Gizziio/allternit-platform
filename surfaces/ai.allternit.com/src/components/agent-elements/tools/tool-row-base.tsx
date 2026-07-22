import { useEffect, useState, type ReactNode } from "react";
import { Collapsible } from "@base-ui/react/collapsible";
import { TextShimmer } from "../text-shimmer";
import { IconChevronRight } from "@tabler/icons-react";
import { cn } from "../utils/cn";

export type ToolRowBaseProps = {
  icon?: ReactNode;
  shimmerLabel?: string;
  completeLabel: string;
  isAnimating: boolean;
  detail?: string;
  trailingContent?: ReactNode;
  expandable?: boolean;
  expanded?: boolean;
  defaultOpen?: boolean;
  onToggleExpand?: () => void;
  onBackground?: () => void;
  backgroundAfterMs?: number;
  children?: ReactNode;
};

export function ToolRowBase({
  icon,
  shimmerLabel,
  completeLabel,
  isAnimating,
  detail,
  trailingContent,
  expandable = false,
  expanded,
  defaultOpen = false,
  onToggleExpand,
  onBackground,
  backgroundAfterMs = 10_000,
  children,
}: ToolRowBaseProps) {
  const [canBackground, setCanBackground] = useState(false);
  useEffect(() => {
    if (!isAnimating || !onBackground) {
      setCanBackground(false);
      return;
    }
    const timer = window.setTimeout(() => setCanBackground(true), backgroundAfterMs);
    return () => window.clearTimeout(timer);
  }, [backgroundAfterMs, isAnimating, onBackground]);

  const isComplete = !isAnimating;
  const isExpanded = expanded ?? false;
  const canToggle = expandable && (isComplete || isExpanded || isAnimating);
  const backgroundControl = canBackground ? (
    <button
      type="button"
      onClick={onBackground}
      className="shrink-0 rounded-md border border-an-border px-1.5 py-0.5 text-[11px] text-an-foreground-muted hover:bg-an-fill-secondary active:scale-[0.97]"
      title="Let this tool continue while you work"
    >
      Background
    </button>
  ) : null;

  const row = (
    <div
      className={cn(
        "flex items-center max-w-full select-none gap-1 rounded-an-tool-border-radius",
        canToggle ? "cursor-pointer" : "cursor-default",
      )}
    >
      <div className="flex items-center gap-2 min-w-0 text-sm text-muted-foreground">
        {icon && (
          <span className="flex items-center justify-center size-3 shrink-0">
            {icon}
          </span>
        )}
        <span className="font-[450] whitespace-nowrap shrink-0">
          {isAnimating && shimmerLabel ? (
            <TextShimmer
              as="span"
              duration={1.2}
              className="inline-flex items-center leading-none h-4 m-0"
            >
              {shimmerLabel}
            </TextShimmer>
          ) : (
            completeLabel
          )}
        </span>
        {detail && (
          <span className="font-normal truncate min-w-0 flex-1 text-an-foreground-muted/60">
            {detail}
          </span>
        )}
        {trailingContent}
      </div>
      {expandable && (isComplete || isExpanded || isAnimating) && (
        <div>
          <IconChevronRight
            className={cn(
              "shrink-0 text-muted-foreground transition-transform duration-150 ease-out",
              "size-3",
              "rotate-0 group-data-panel-open:rotate-90",
            )}
          />
        </div>
      )}
    </div>
  );

  if (!expandable) {
    return <div className="flex items-start gap-2"><div className="min-w-0 flex-1">{row}</div>{backgroundControl}</div>;
  }

  const rootProps =
    expanded === undefined
      ? { defaultOpen }
      : { open: expanded, onOpenChange: onToggleExpand };

  return (
    <div className="flex min-h-5 items-start gap-2 w-full">
    <Collapsible.Root className="flex min-w-0 flex-1 flex-col gap-2" {...rootProps}>
      <Collapsible.Trigger
        className="group flex"
        disabled={!canToggle}
        aria-disabled={!canToggle}
      >
        {row}
      </Collapsible.Trigger>
      <Collapsible.Panel
        className={cn(
          "overflow-hidden",
          "h-[var(--collapsible-panel-height)] transition-all duration-150 ease-out",
          "data-ending-style:h-0 data-starting-style:h-0",
          "[&[hidden]:not([hidden='until-found'])]:hidden",
        )}
      >
        {children}
      </Collapsible.Panel>
    </Collapsible.Root>
    {backgroundControl}
    </div>
  );
}
