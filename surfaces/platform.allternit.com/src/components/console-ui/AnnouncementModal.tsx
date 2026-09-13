import React, { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Megaphone01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/api-client";

interface Announcement {
  id: string;
  title: string;
  body: string;
}

const STORAGE_KEY = "allternit:dismissed-announcements";

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Console announcement modal. Fetches /api/v1/console/announcements on mount
 * and renders at most one un-dismissed announcement. Any error or empty list
 * renders nothing — announcements are a courtesy, never a blocker.
 */
export function AnnouncementModal(): React.ReactNode {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const payload = await api.get<Announcement[] | { announcements: Announcement[] }>(
          "/api/v1/console/announcements"
        );
        const list = Array.isArray(payload) ? payload : payload.announcements ?? [];
        const dismissed = new Set(readDismissed());
        const next = list.find(
          (item) => item?.id && !dismissed.has(item.id)
        );
        if (active && next) setAnnouncement(next);
      } catch {
        // Silently render nothing on error.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!announcement) return null;

  const dismiss = () => {
    try {
      const dismissed = readDismissed();
      dismissed.push(announcement.id);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissed));
    } catch {
      // localStorage unavailable — dismiss for this view only.
    }
    setAnnouncement(null);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={announcement.title}
        className="w-full max-w-md rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Megaphone01Icon}
              size={18}
              className="text-[var(--accent-highlight)]"
            />
            <h2 className="m-0 text-[16px] font-semibold text-[var(--text-primary)]">
              {announcement.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss announcement"
            className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
        <p className="m-0 mt-3 whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-secondary)]">
          {announcement.body}
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--ui-text-inverse)] transition-colors hover:brightness-110"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
