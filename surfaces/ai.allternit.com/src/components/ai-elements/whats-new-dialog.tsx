"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  IconSparkles,
  IconRocket,
  IconBug,
  IconBulb,
  IconChevronRight,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export type ChangelogEntry = {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  type: "feature" | "improvement" | "fix";
  imageUrl?: string;
};

export type WhatsNewDialogProps = {
  entries: ChangelogEntry[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  lastSeenEntryId?: string;
  onMarkAsSeen?: (entryId: string) => void;
};

const typeConfig = {
  feature: {
    icon: IconSparkles,
    label: "New",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  improvement: {
    icon: IconRocket,
    label: "Improved",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  },
  fix: {
    icon: IconBug,
    label: "Fixed",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
};

export function WhatsNewDialog({
  entries,
  open,
  onOpenChange,
  lastSeenEntryId,
  onMarkAsSeen,
}: WhatsNewDialogProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeEntry = entries[activeIndex];

  const hasUnread = lastSeenEntryId
    ? entries.findIndex((e) => e.id === lastSeenEntryId) > 0
    : entries.length > 0;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
            "w-full max-w-lg gap-0 p-0 shadow-2xl",
            "bg-background border border-border rounded-2xl",
            "focus:outline-none focus:ring-0",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <IconBulb className="w-4 h-4 text-primary" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                  What&apos;s New
                </DialogPrimitive.Title>
                {hasUnread && (
                  <span className="text-[11px] text-muted-foreground">
                    {entries.filter((e) =>
                      lastSeenEntryId
                        ? entries.indexOf(e) <
                          entries.findIndex((x) => x.id === lastSeenEntryId)
                        : true
                    ).length}{" "}
                    new since you last visited
                  </span>
                )}
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-full p-1.5 hover:bg-muted transition-colors">
              <IconX className="w-4 h-4 text-muted-foreground" />
            </DialogPrimitive.Close>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            {activeEntry && (
              <motion.div
                key={activeEntry.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="px-5 pb-4"
              >
                {activeEntry.imageUrl && (
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted mb-4 border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeEntry.imageUrl}
                      alt={activeEntry.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const config = typeConfig[activeEntry.type];
                    const Icon = config.icon;
                    return (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border",
                          config.className
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </span>
                    );
                  })()}
                  <span className="text-[11px] text-muted-foreground">
                    {activeEntry.version} · {activeEntry.date}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {activeEntry.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {activeEntry.description}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer / Navigation */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/30 rounded-b-2xl">
            <div className="flex items-center gap-1.5">
              {entries.map((entry, idx) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    setActiveIndex(idx);
                    onMarkAsSeen?.(entry.id);
                  }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all duration-200",
                    idx === activeIndex
                      ? "bg-primary w-5"
                      : entries.indexOf(entry) <
                        (lastSeenEntryId
                          ? entries.findIndex((e) => e.id === lastSeenEntryId)
                          : entries.length)
                        ? "bg-primary/40"
                        : "bg-muted-foreground/20 hover:bg-muted-foreground/40"
                  )}
                  aria-label={`View ${entry.title}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const prev = Math.max(0, activeIndex - 1);
                  setActiveIndex(prev);
                  onMarkAsSeen?.(entries[prev].id);
                }}
                disabled={activeIndex === 0}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <IconChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
              </button>
              <button
                onClick={() => {
                  const next = Math.min(entries.length - 1, activeIndex + 1);
                  setActiveIndex(next);
                  onMarkAsSeen?.(entries[next].id);
                }}
                disabled={activeIndex === entries.length - 1}
                className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <IconChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
