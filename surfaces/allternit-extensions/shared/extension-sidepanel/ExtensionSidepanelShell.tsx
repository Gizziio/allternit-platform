"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ExtensionSidepanelActivity,
  ExtensionSidepanelAdapter,
  ExtensionSidepanelComposerProps,
  ExtensionSidepanelConfigViewProps,
  ExtensionSidepanelCopy,
  ExtensionSidepanelHistoricalEvent,
  ExtensionSidepanelHistoryDetailViewProps,
  ExtensionSidepanelHistoryListViewProps,
} from "./ExtensionSidepanelShell.types";

type View = { name: "chat" } | { name: "config" } | { name: "history" } | { name: "history-detail"; sessionId: string };

const EMPTY_STATE_TYPING_WORDS = [
  "Enter a task to automate this page",
  "Call this extension from your web page",
  "Use this extension in your own agents",
] as const;

const EXTENSION_SIDEPANEL_ANIMATIONS = `
@keyframes extension-sidepanel-blink-cursor {
  0%, 49% {
    opacity: 1;
  }
  50%, 100% {
    opacity: 0;
  }
}

@keyframes extension-sidepanel-glow-a {
  0%, 100% {
    opacity: 0.45;
    transform: scale(1);
  }
  50% {
    opacity: 0;
    transform: scale(1.1);
  }
}

@keyframes extension-sidepanel-glow-b {
  0%, 100% {
    opacity: 0;
    transform: scale(1.1);
  }
  50% {
    opacity: 0.45;
    transform: scale(1);
  }
}

@keyframes extension-sidepanel-overlay-glow-a {
  0%, 100% {
    opacity: 0.38;
    transform: scale(1);
  }
  50% {
    opacity: 0.2;
    transform: scale(1.025);
  }
}

@keyframes extension-sidepanel-overlay-glow-b {
  0%, 100% {
    opacity: 0.16;
    transform: scale(1.02);
  }
  50% {
    opacity: 0.34;
    transform: scale(1);
  }
}

@keyframes extension-sidepanel-overlay-border {
  0%, 100% {
    opacity: 0.58;
    box-shadow: inset 0 0 0 1px rgba(91, 153, 255, 0.3), 0 0 24px rgba(91, 153, 255, 0.12);
  }
  50% {
    opacity: 0.9;
    box-shadow: inset 0 0 0 1px rgba(179, 96, 255, 0.34), 0 0 32px rgba(69, 201, 255, 0.18);
  }
}
`;

const DEFAULT_COPY: ExtensionSidepanelCopy = {
  title: "A2R Extension",
  subtitle: "Chrome Sidepanel",
  emptyStateTitle: "A2R Extension",
  emptyStateDescription: "Execute multi-page tasks",
  readyLabel: "Ready",
  contextLabel: "Current Browser Tab",
  settingsEyebrow: "Sidepanel Settings",
  settingsTitle: "Configure how the sidepanel executes tasks.",
  settingsDescription:
    "This view is adapter-driven in browser mode, but the sidepanel layout stays aligned to the packaged extension.",
  settingsContextLabel: "Runtime",
};

const LIGHT_THEME = {
  "--background": "0 0% 100%",
  "--foreground": "0 0% 14.5%",
  "--card": "0 0% 100%",
  "--card-foreground": "0 0% 14.5%",
  "--popover": "0 0% 100%",
  "--popover-foreground": "0 0% 14.5%",
  "--primary": "0 0% 20.5%",
  "--primary-foreground": "0 0% 98.5%",
  "--secondary": "0 0% 97%",
  "--secondary-foreground": "0 0% 20.5%",
  "--muted": "0 0% 97%",
  "--muted-foreground": "0 0% 55.6%",
  "--accent": "0 0% 97%",
  "--accent-foreground": "0 0% 20.5%",
  "--destructive": "0 84.2% 60.2%",
  "--destructive-foreground": "0 84.2% 60.2%",
  "--border": "0 0% 92.2%",
  "--input": "0 0% 92.2%",
  "--ring": "0 0% 70.8%",
  "--radius": "0.625rem",
} satisfies Record<string, string>;

const DARK_THEME = {
  "--background": "0 0% 19%",
  "--foreground": "0 0% 98.5%",
  "--card": "0 0% 14.5%",
  "--card-foreground": "0 0% 98.5%",
  "--popover": "0 0% 14.5%",
  "--popover-foreground": "0 0% 98.5%",
  "--primary": "0 0% 98.5%",
  "--primary-foreground": "0 0% 20.5%",
  "--secondary": "0 0% 26.9%",
  "--secondary-foreground": "0 0% 98.5%",
  "--muted": "0 0% 26.9%",
  "--muted-foreground": "0 0% 70.8%",
  "--accent": "0 0% 26.9%",
  "--accent-foreground": "0 0% 98.5%",
  "--destructive": "0 46.8% 39.6%",
  "--destructive-foreground": "0 72.2% 63.7%",
  "--border": "0 0% 26.9%",
  "--input": "0 0% 26.9%",
  "--ring": "0 0% 43.9%",
  "--radius": "0.625rem",
} satisfies Record<string, string>;

const GITHUB_ICON_PATH =
  "M12 .297a12 12 0 0 0-3.794 23.39c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.757-1.333-1.757-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.775.418-1.305.762-1.605-2.665-.304-5.467-1.334-5.467-5.931 0-1.311.469-2.382 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.323 3.301 1.23a11.5 11.5 0 0 1 3.003-.404c1.018.005 2.042.138 3.003.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.839 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.48 5.921.43.371.823 1.102.823 2.222v3.293c0 .319.216.694.825.576A12 12 0 0 0 12 .297Z";

type IconProps = { className?: string };

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SvgIcon({
  className,
  children,
  viewBox = "0 0 24 24",
  fill = "none",
}: React.PropsWithChildren<IconProps & { viewBox?: string; fill?: string }>) {
  return (
    <svg
      aria-hidden="true"
      viewBox={viewBox}
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function ArrowLeft({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </SvgIcon>
  );
}

function BookOpen({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H11a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H5.5A2.5 2.5 0 0 0 3 19.5Z" />
      <path d="M21 6.5A2.5 2.5 0 0 0 18.5 4H13a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h5.5a2.5 2.5 0 0 1 2.5 2.5Z" />
    </SvgIcon>
  );
}

function CheckCircle({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </SvgIcon>
  );
}

function Eye({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </SvgIcon>
  );
}

function Globe({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </SvgIcon>
  );
}

function HistoryIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M3 5v5h5" />
      <path d="M3.5 10a9 9 0 1 0 2.2-4.8L3 10" />
      <path d="M12 7v5l3 2" />
    </SvgIcon>
  );
}

function Keyboard({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="3" y="6" width="18" height="12" rx="2.5" />
      <path d="M7 10h.01" />
      <path d="M10 10h.01" />
      <path d="M13 10h.01" />
      <path d="M16 10h.01" />
      <path d="M7 14h6" />
      <path d="M15 14h2" />
    </SvgIcon>
  );
}

function Mouse({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <rect x="7" y="3" width="10" height="18" rx="5" />
      <path d="M12 7v3" />
    </SvgIcon>
  );
}

function MoveVertical({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M12 5v14" />
      <path d="m8 9 4-4 4 4" />
      <path d="m8 15 4 4 4-4" />
    </SvgIcon>
  );
}

function RefreshCw({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M21 2v6h-6" />
      <path d="M20.5 8A9 9 0 1 0 21 12" />
    </SvgIcon>
  );
}

function Send({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </SvgIcon>
  );
}

function SettingsIcon({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
    </SvgIcon>
  );
}

function Sparkles({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z" />
      <path d="m18.5 14 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" />
      <path d="m5 14 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" />
    </SvgIcon>
  );
}

function Square({ className }: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

function Trash2({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7 7 19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
      <path d="M9 7V4h6v3" />
    </SvgIcon>
  );
}

function XCircle({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </SvgIcon>
  );
}

function Zap({ className }: IconProps) {
  return (
    <SvgIcon className={className}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6Z" />
    </SvgIcon>
  );
}

function usePrefersDarkMode() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setIsDark(mediaQuery.matches);

    syncTheme();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncTheme);
      return () => mediaQuery.removeEventListener("change", syncTheme);
    }

    mediaQuery.addListener(syncTheme);
    return () => mediaQuery.removeListener(syncTheme);
  }, []);

  return isDark;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/assets/page-agent-64.png"
      alt="Page Agent"
      className={className}
      draggable={false}
    />
  );
}

function MotionOverlay({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 rounded-[inherit]"
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          background:
            "linear-gradient(180deg, rgba(5, 7, 10, 0.04), rgba(5, 7, 10, 0.08)), radial-gradient(circle at 16% 18%, rgba(68, 128, 255, 0.16), transparent 30%), radial-gradient(circle at 84% 82%, rgba(51, 216, 168, 0.12), transparent 30%)",
        }}
      />
      <div
        className="absolute inset-[-14px] rounded-[inherit] blur-2xl"
        style={{
          background:
            "conic-gradient(from 180deg, rgba(92, 136, 255, 0.32), rgba(83, 196, 255, 0.12), rgba(179, 96, 255, 0.26), rgba(92, 136, 255, 0.32))",
          animation: "extension-sidepanel-overlay-glow-a 4.8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-[-14px] rounded-[inherit] blur-2xl"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(70, 212, 255, 0.22), rgba(92, 136, 255, 0.12), rgba(74, 208, 157, 0.24), rgba(70, 212, 255, 0.22))",
          animation: "extension-sidepanel-overlay-glow-b 4.8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          animation: "extension-sidepanel-overlay-border 2.2s ease-in-out infinite",
        }}
      />
    </div>
  );
}

function TypingAnimation({
  words,
  className,
  typeSpeed = 20,
  deleteSpeed = 10,
  pauseDelay = 3000,
  cursorStyle = "underscore",
}: {
  words: readonly string[];
  className?: string;
  typeSpeed?: number;
  deleteSpeed?: number;
  pauseDelay?: number;
  cursorStyle?: "line" | "block" | "underscore";
}) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [phase, setPhase] = useState<"typing" | "pause" | "deleting">("typing");

  useEffect(() => {
    if (words.length === 0) return;

    const currentWord = words[currentWordIndex] ?? "";
    const chars = Array.from(currentWord);
    const timeoutDelay =
      phase === "typing" ? typeSpeed : phase === "deleting" ? deleteSpeed : pauseDelay;

    const timeout = window.setTimeout(() => {
      if (phase === "typing") {
        if (currentCharIndex < chars.length) {
          setDisplayedText(chars.slice(0, currentCharIndex + 1).join(""));
          setCurrentCharIndex((value) => value + 1);
        } else {
          setPhase("pause");
        }
        return;
      }

      if (phase === "pause") {
        setPhase("deleting");
        return;
      }

      if (currentCharIndex > 0) {
        setDisplayedText(chars.slice(0, currentCharIndex - 1).join(""));
        setCurrentCharIndex((value) => value - 1);
        return;
      }

      setCurrentWordIndex((value) => (value + 1) % words.length);
      setPhase("typing");
    }, timeoutDelay);

    return () => window.clearTimeout(timeout);
  }, [currentCharIndex, currentWordIndex, deleteSpeed, pauseDelay, phase, typeSpeed, words]);

  const cursorChar =
    cursorStyle === "block" ? "▌" : cursorStyle === "underscore" ? "_" : "|";

  return (
    <span className={className}>
      {displayedText}
      <span
        className="inline-block"
        style={{ animation: "extension-sidepanel-blink-cursor 1.2s step-end infinite" }}
      >
        {cursorChar}
      </span>
    </span>
  );
}

function StatusDot({ status }: { status: ExtensionSidepanelAdapter["status"] }) {
  const colorClass = {
    idle: "bg-muted-foreground",
    running: "bg-blue-500",
    completed: "bg-green-500",
    error: "bg-destructive",
  }[status];

  const label = {
    idle: "Ready",
    running: "Running",
    completed: "Done",
    error: "Error",
  }[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", colorClass, status === "running" && "animate-pulse")} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function EmptyState({
  copy,
  brandIcon,
}: {
  copy: ExtensionSidepanelCopy;
  brandIcon?: React.ReactNode;
}) {
  const typingWords = useMemo(() => {
    const ordered = [
      EMPTY_STATE_TYPING_WORDS[0],
      copy.emptyStateDescription,
      EMPTY_STATE_TYPING_WORDS[1],
      EMPTY_STATE_TYPING_WORDS[2],
    ];

    return ordered.filter((word, index) => ordered.indexOf(word) === index);
  }, [copy.emptyStateDescription]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <style>{EXTENSION_SIDEPANEL_ANIMATIONS}</style>
      <div className="pointer-events-none relative select-none">
        <div
          className="absolute inset-0 -m-6 rounded-full blur-2xl"
          style={{
            background:
              "conic-gradient(from 180deg, oklch(0.55 0.2 280), oklch(0.5 0.15 230), oklch(0.6 0.18 310), oklch(0.55 0.2 280))",
            animation: "extension-sidepanel-glow-a 5s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-0 -m-6 rounded-full blur-2xl"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.55 0.18 160), oklch(0.5 0.2 200), oklch(0.6 0.15 120), oklch(0.55 0.18 160))",
            animation: "extension-sidepanel-glow-b 5s ease-in-out infinite",
          }}
        />
        <div className="relative flex items-center justify-center">
          {brandIcon ?? <Logo className="relative size-20 opacity-80" />}
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-base font-medium text-foreground">
          {copy.emptyStateTitle}
        </h2>
        <TypingAnimation
          className="text-sm text-muted-foreground"
          words={typingWords}
          cursorStyle="underscore"
          typeSpeed={20}
          deleteSpeed={10}
          pauseDelay={3000}
        />
      </div>

      <div className="mt-1 flex items-center gap-3 text-muted-foreground">
        <a
          href="https://github.com/alibaba/page-agent"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-foreground"
          title="GitHub"
        >
          <svg role="img" viewBox="0 0 24 24" className="size-4 fill-current">
            <path d={GITHUB_ICON_PATH} />
          </svg>
        </a>
        <a
          href="https://alibaba.github.io/page-agent/docs/features/chrome-extension"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-foreground"
          title="Documentation"
        >
          <BookOpen className="size-4" />
        </a>
        <a
          href="https://alibaba.github.io/page-agent"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-foreground"
          title="Website"
        >
          <Globe className="size-4" />
        </a>
      </div>
    </div>
  );
}

function ResultCard({
  success,
  text,
}: {
  success: boolean;
  text: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        success ? "border-green-500/30 bg-green-500/10" : "border-destructive/30 bg-destructive/10",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        {success ? (
          <CheckCircle className="size-3.5 text-green-500" />
        ) : (
          <XCircle className="size-3.5 text-destructive" />
        )}
        <span
          className={cn(
            "text-xs font-medium",
            success ? "text-green-600 dark:text-green-400" : "text-destructive",
          )}
        >
          Result: {success ? "Success" : "Failed"}
        </span>
      </div>
      <p className="pl-5 text-[11px] text-muted-foreground whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function ReflectionItem({ icon, value }: { icon: string; value: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <span className="flex justify-center text-xs">{icon}</span>
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={cn(
          "cursor-pointer text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground",
          !expanded && "line-clamp-1",
        )}
      >
        {value}
      </button>
    </>
  );
}

function ReflectionSection({
  reflection,
}: {
  reflection: {
    evaluation_previous_goal?: string;
    memory?: string;
    next_goal?: string;
  };
}) {
  const items = [
    { icon: "☑️", label: "eval", value: reflection.evaluation_previous_goal },
    { icon: "🧠", label: "memory", value: reflection.memory },
    { icon: "🎯", label: "goal", value: reflection.next_goal },
  ].filter((item): item is { icon: string; label: string; value: string } => Boolean(item.value));

  if (items.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="grid grid-cols-[14px_1fr] gap-x-2 gap-y-2">
        {items.map((item) => (
          <ReflectionItem key={item.label} icon={item.icon} value={item.value} />
        ))}
      </div>
    </div>
  );
}

function ActionIcon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    click_element_by_index: <Mouse className={className} />,
    input: <Keyboard className={className} />,
    scroll: <MoveVertical className={className} />,
    go_to_url: <Globe className={className} />,
  };

  return icons[name] ?? <Zap className={className} />;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(text);
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded border px-1 text-[9px] text-muted-foreground backdrop-blur-xs transition-colors hover:text-foreground"
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

function extractPrompt(rawRequest: unknown, role: "system" | "user"): string | null {
  const messages = (rawRequest as { messages?: { role: string; content?: unknown }[] } | null)?.messages;
  if (!messages) return null;

  const match =
    role === "system"
      ? messages.find((message) => message.role === role)
      : [...messages].reverse().find((message) => message.role === role);

  if (!match?.content) return null;
  return typeof match.content === "string" ? match.content : JSON.stringify(match.content, null, 2);
}

function RawSection({ rawRequest, rawResponse }: { rawRequest?: unknown; rawResponse?: unknown }) {
  const [activeTab, setActiveTab] = useState<"request" | "response" | null>(null);

  if (!rawRequest && !rawResponse) return null;

  const content =
    activeTab === "request" ? rawRequest : activeTab === "response" ? rawResponse : null;
  const systemPrompt = activeTab === "request" ? extractPrompt(rawRequest, "system") : null;
  const userPrompt = activeTab === "request" ? extractPrompt(rawRequest, "user") : null;

  return (
    <div className="mt-2 border-t border-dashed pt-2">
      <div className="-my-1 flex items-center gap-3">
        {rawRequest != null && (
          <button
            type="button"
            onClick={() => setActiveTab((tab) => (tab === "request" ? null : "request"))}
            className={cn(
              "cursor-pointer border-b text-[10px] transition-colors",
              activeTab === "request"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Raw Request
          </button>
        )}
        {rawResponse != null && (
          <button
            type="button"
            onClick={() => setActiveTab((tab) => (tab === "response" ? null : "response"))}
            className={cn(
              "cursor-pointer border-b text-[10px] transition-colors",
              activeTab === "response"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Raw Response
          </button>
        )}
      </div>

      {content != null && (
        <div className="relative mt-1.5">
          <div className="absolute right-1 top-1 flex gap-1">
            {systemPrompt && <CopyButton text={systemPrompt} label="Copy System" />}
            {userPrompt && <CopyButton text={userPrompt} label="Copy User" />}
            <CopyButton text={JSON.stringify(content, null, 4)} label="Copy" />
          </div>
          <pre className="max-h-60 overflow-x-auto overflow-y-auto rounded bg-muted p-2 pt-5 text-[10px] text-foreground/70">
            {JSON.stringify(content, null, 4)}
          </pre>
        </div>
      )}
    </div>
  );
}

function StepCard({ event }: { event: Extract<ExtensionSidepanelHistoricalEvent, { type: "step" }> }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2.5 border-l-2 border-l-blue-500/50">
      <div className="mb-2 text-[11px] font-semibold tracking-wide text-foreground">
        Step #{(event.stepIndex ?? 0) + 1}
      </div>

      {event.reflection && <ReflectionSection reflection={event.reflection} />}

      {event.action && (
        <div>
          <div className="mb-1 text-[11px] font-semibold tracking-wide text-foreground">Actions</div>
          <div className="flex items-start gap-2">
            <ActionIcon
              name={event.action.name}
              className="mt-0.5 size-3.5 shrink-0 text-blue-500"
            />
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 line-clamp-1 break-all text-xs text-foreground/80 hover:line-clamp-none">
                <span className="font-medium text-foreground/70">{event.action.name}</span>
                {event.action.name !== "done" && (
                  <span className="ml-1.5 text-muted-foreground/70">
                    {JSON.stringify(event.action.input)}
                  </span>
                )}
              </p>
              <p className="grid grid-cols-[auto_1fr] gap-1.5 text-[11px] text-muted-foreground/70">
                <span>└</span>
                <span className="line-clamp-1 break-all hover:line-clamp-3">
                  {event.action.output}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <RawSection rawRequest={event.rawRequest} rawResponse={event.rawResponse} />
    </div>
  );
}

function ObservationCard({
  event,
}: {
  event: Extract<ExtensionSidepanelHistoricalEvent, { type: "observation" }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-2.5 border-l-2 border-l-green-500/50">
      <div className="flex items-start gap-2">
        <Eye className="mt-0.5 size-3.5 shrink-0 text-green-500" />
        <span className="text-[11px] text-muted-foreground">{event.content}</span>
      </div>
    </div>
  );
}

function RetryCard({ event }: { event: Extract<ExtensionSidepanelHistoricalEvent, { type: "retry" }> }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
      <div className="flex items-start gap-1.5">
        <RefreshCw className="mt-0.5 size-3 shrink-0 text-amber-500" />
        <span className="text-xs text-amber-600 dark:text-amber-400">
          {event.message} ({event.attempt}/{event.maxAttempts})
        </span>
      </div>
    </div>
  );
}

function ErrorCard({ event }: { event: Extract<ExtensionSidepanelHistoricalEvent, { type: "error" }> }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5">
      <div className="flex items-start gap-1.5">
        <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
        <span className="text-xs text-destructive">{event.message}</span>
      </div>
      <RawSection rawResponse={event.rawResponse} />
    </div>
  );
}

function UserTakeoverCard({
  event,
}: {
  event: Extract<ExtensionSidepanelHistoricalEvent, { type: "user_takeover" }>;
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5">
      <span className="text-xs text-amber-700 dark:text-amber-300">
        {event.message ?? "User takeover requested."}
      </span>
    </div>
  );
}

export function EventCard({ event }: { event: ExtensionSidepanelHistoricalEvent }) {
  if (event.type === "step" && event.action?.name === "done") {
    const input = event.action.input as { text?: string; success?: boolean } | undefined;
    return (
      <>
        <StepCard event={event} />
        <ResultCard success={input?.success ?? true} text={input?.text || event.action.output || ""} />
      </>
    );
  }

  if (event.type === "step") return <StepCard event={event} />;
  if (event.type === "observation") return <ObservationCard event={event} />;
  if (event.type === "retry") return <RetryCard event={event} />;
  if (event.type === "error") return <ErrorCard event={event} />;
  if (event.type === "user_takeover") return <UserTakeoverCard event={event} />;
  return null;
}

export function ActivityCard({ activity }: { activity: ExtensionSidepanelActivity }) {
  const info =
    activity.type === "thinking"
      ? { text: "Thinking...", color: "text-blue-500", dot: "bg-blue-500" }
      : activity.type === "executing"
        ? { text: `Executing ${activity.tool}...`, color: "text-amber-500", dot: "bg-amber-500" }
        : activity.type === "executed"
          ? { text: `Done: ${activity.tool}`, color: "text-green-500", dot: "bg-green-500" }
          : activity.type === "retrying"
            ? {
                text: `Retrying (${activity.attempt}/${activity.maxAttempts})...`,
                color: "text-amber-500",
                dot: "bg-amber-500",
              }
            : { text: activity.message, color: "text-destructive", dot: "bg-destructive" };

  return (
    <div className="flex animate-pulse items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
      <div className="relative">
        <Sparkles className={cn("size-3.5", info.color)} />
        <span className={cn("absolute -right-0.5 -top-0.5 size-1.5 rounded-full animate-ping", info.dot)} />
      </div>
      <span className={cn("text-xs", info.color)}>{info.text}</span>
    </div>
  );
}

function DefaultHistoryListView({
  sessions,
  onSelect,
  onBack,
  onDeleteSession,
  onClearSessions,
}: ExtensionSidepanelHistoryListViewProps) {
  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chat"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="flex-1 text-sm font-medium">History</span>
        {sessions.length > 0 && onClearSessions && (
          <button
            type="button"
            onClick={() => {
              void onClearSessions();
            }}
            className="flex h-6 items-center gap-1 rounded-md px-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-3" />
            Clear All
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
            No history yet
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(session.id)}
              onKeyDown={(event) => event.key === "Enter" && onSelect(session.id)}
              className="group flex cursor-pointer items-start gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
            >
              {session.status === "completed" ? (
                <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-green-500" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{session.task}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {timeAgo(session.createdAt)} · {session.history.length} steps
                </p>
              </div>

              {onDeleteSession && (
                <button
                  type="button"
                  aria-label={`Delete history entry ${session.task}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onDeleteSession(session.id);
                  }}
                  className="shrink-0 p-1 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DefaultHistoryDetailView({ session, onBack }: ExtensionSidepanelHistoryDetailViewProps) {
  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-xs text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to history"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="truncate text-sm font-medium">History</span>
      </header>

      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Task</div>
        <div className="text-xs font-medium" title={session.task}>
          {session.task}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {session.history.map((event, index) => (
          <EventCard key={`${session.id}-${index}`} event={event} />
        ))}
      </div>
    </div>
  );
}

function DefaultConfigView({
  config,
  copy,
  pageLabel,
  onSave,
  onBack,
}: ExtensionSidepanelConfigViewProps) {
  const [permissionMode, setPermissionMode] = useState(config.permissionMode);
  const [language, setLanguage] = useState(config.language);

  useEffect(() => {
    setPermissionMode(config.permissionMode);
    setLanguage(config.language);
  }, [config.language, config.permissionMode]);

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to chat"
          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <span className="text-sm font-medium">Settings</span>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-md border bg-muted/30 p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {copy.settingsEyebrow}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{copy.settingsTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {copy.settingsDescription}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Permission Mode</label>
          <select
            value={permissionMode}
            onChange={(event) => setPermissionMode(event.target.value as "ask" | "act")}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="ask">Ask before acting</option>
            <option value="act">Direct action mode</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Language</label>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="en">English</option>
            <option value="zh">Chinese</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{copy.settingsContextLabel}</label>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground">
            {config.runtimeLabel}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{copy.contextLabel}</label>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground">
            {pageLabel}
          </div>
        </div>
      </div>

      <footer className="border-t p-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ permissionMode, language })}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Save
          </button>
        </div>
      </footer>
    </div>
  );
}

export function ExtensionSidepanelShell({
  adapter,
  copy,
  brandIcon,
  testId = "extension-sidepanel-shell",
  containerClassName,
  renderConfigView,
  renderHistoryListView,
  renderHistoryDetailView,
  renderComposer,
}: {
  adapter: ExtensionSidepanelAdapter;
  copy?: Partial<ExtensionSidepanelCopy>;
  brandIcon?: React.ReactNode;
  testId?: string;
  containerClassName?: string;
  renderConfigView?: (props: ExtensionSidepanelConfigViewProps) => React.ReactNode;
  renderHistoryListView?: (props: ExtensionSidepanelHistoryListViewProps) => React.ReactNode;
  renderHistoryDetailView?: (props: ExtensionSidepanelHistoryDetailViewProps) => React.ReactNode;
  renderComposer?: (props: ExtensionSidepanelComposerProps) => React.ReactNode;
}) {
  const shellCopy = { ...DEFAULT_COPY, ...copy };
  const [view, setView] = useState<View>({ name: "chat" });
  const [inputValue, setInputValue] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefersDark = usePrefersDarkMode();

  const themeStyle = useMemo(
    () =>
      ({
        ...(prefersDark ? DARK_THEME : LIGHT_THEME),
        colorScheme: prefersDark ? "dark" : "light",
      }) as React.CSSProperties,
    [prefersDark],
  );

  const selectedSession = useMemo(() => {
    return view.name === "history-detail"
      ? adapter.sessions.find((session) => session.id === view.sessionId) ?? null
      : null;
  }, [adapter.sessions, view]);

  const isRunning = adapter.status === "running";
  const showEmptyState =
    adapter.currentTask.length === 0 && adapter.history.length === 0 && !isRunning;
  const composerPlaceholder = "Describe your task... (Enter to send)";

  useEffect(() => {
    if (view.name !== "chat" || !historyRef.current) return;
    historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [adapter.activity, adapter.history, view]);

  const handleSubmit = useCallback(
    (valueOrEvent?: string | React.FormEvent) => {
      if (typeof valueOrEvent !== "string") {
        valueOrEvent?.preventDefault();
      }
      const task = (typeof valueOrEvent === "string" ? valueOrEvent : inputValue).trim();
      if (!task || isRunning) return;
      adapter.execute(task);
      setInputValue("");
      if (!renderComposer) {
        textareaRef.current?.focus();
      }
    },
    [adapter, inputValue, isRunning, renderComposer],
  );

  const handleStop = useCallback(() => {
    adapter.stop();
    if (!renderComposer) {
      textareaRef.current?.focus();
    }
  }, [adapter, renderComposer]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  if (view.name === "config") {
    return (
      <section
        data-testid={testId}
        className={cn(
          "relative flex flex-col overflow-hidden bg-background text-foreground",
          prefersDark && "dark",
          containerClassName ?? "h-dvh",
        )}
        style={themeStyle}
      >
        {renderConfigView ? (
          renderConfigView({
            config: adapter.config,
            copy: shellCopy,
            pageLabel: adapter.pageLabel,
            onBack: () => setView({ name: "chat" }),
            onSave: (nextConfig) => {
              adapter.configure(nextConfig);
              setView({ name: "chat" });
            },
          })
        ) : (
          <DefaultConfigView
            config={adapter.config}
            copy={shellCopy}
            pageLabel={adapter.pageLabel}
            onBack={() => setView({ name: "chat" })}
            onSave={(nextConfig) => {
              adapter.configure(nextConfig);
              setView({ name: "chat" });
            }}
          />
        )}
      </section>
    );
  }

  if (view.name === "history") {
    return (
      <section
        data-testid={testId}
        className={cn(
          "relative flex flex-col overflow-hidden bg-background text-foreground",
          prefersDark && "dark",
          containerClassName ?? "h-dvh",
        )}
        style={themeStyle}
      >
        {renderHistoryListView ? (
          renderHistoryListView({
            sessions: adapter.sessions,
            onBack: () => setView({ name: "chat" }),
            onSelect: (sessionId) => setView({ name: "history-detail", sessionId }),
            onDeleteSession: adapter.deleteSession,
            onClearSessions: adapter.clearSessions,
          })
        ) : (
          <DefaultHistoryListView
            sessions={adapter.sessions}
            onBack={() => setView({ name: "chat" })}
            onSelect={(sessionId) => setView({ name: "history-detail", sessionId })}
            onDeleteSession={adapter.deleteSession}
            onClearSessions={adapter.clearSessions}
          />
        )}
      </section>
    );
  }

  if (view.name === "history-detail") {
    return (
      <section
        data-testid={testId}
        className={cn(
          "relative flex flex-col overflow-hidden bg-background text-foreground",
          prefersDark && "dark",
          containerClassName ?? "h-dvh",
        )}
        style={themeStyle}
      >
        {renderHistoryDetailView ? (
          renderHistoryDetailView({
            session: selectedSession,
            sessionId: view.sessionId,
            onBack: () => setView({ name: "history" }),
          })
        ) : (
          <DefaultHistoryDetailView
            session={selectedSession}
            sessionId={view.sessionId}
            onBack={() => setView({ name: "history" })}
          />
        )}
      </section>
    );
  }

  return (
    <section
      data-testid={testId}
      className={cn(
        "relative flex min-h-0 flex-col bg-transparent p-2 text-foreground",
        prefersDark && "dark",
        containerClassName ?? "h-dvh",
      )}
      style={themeStyle}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-border/80 bg-card shadow-2xl">
        <MotionOverlay active={isRunning} />

        <header className="flex items-center justify-between border-b border-border/80 px-4 py-3">
          <div className="flex items-center gap-2.5">
            {brandIcon ?? <Logo className="size-5" />}
            <span className="text-sm font-semibold">{shellCopy.title}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <StatusDot status={adapter.status} />
            <button
              type="button"
              aria-label="Open history"
              onClick={() => setView({ name: "history" })}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <HistoryIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Open settings"
              onClick={() => setView({ name: "config" })}
              className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SettingsIcon className="size-3.5" />
            </button>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          {adapter.currentTask && (
            <div className="border-b bg-muted/20 px-4 py-2.5">
              <div className="text-[10px] text-muted-foreground">Task</div>
              <div className="truncate text-xs font-medium" title={adapter.currentTask}>
                {adapter.currentTask}
              </div>
            </div>
          )}

          <div ref={historyRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {showEmptyState && <EmptyState copy={shellCopy} brandIcon={brandIcon} />}
            {adapter.history.map((event, index) => (
              <EventCard key={`extension-event-${index}`} event={event} />
            ))}
            {adapter.activity && <ActivityCard activity={adapter.activity} />}
          </div>
        </main>

        <footer className="border-t border-border/80 p-3.5">
          {renderComposer ? (
            renderComposer({
              isRunning,
              value: inputValue,
              placeholder: composerPlaceholder,
              onValueChange: setInputValue,
              onSubmit: (taskValue) => handleSubmit(taskValue),
              onStop: handleStop,
            })
          ) : (
            <form
              onSubmit={handleSubmit}
              className="relative rounded-[14px] border border-input bg-background/80 shadow-sm"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                disabled={isRunning}
                placeholder={composerPlaceholder}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-12 w-full resize-none bg-transparent px-4 py-3 pr-14 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              />

              <button
                type={isRunning ? "button" : "submit"}
                onClick={isRunning ? handleStop : undefined}
                disabled={!isRunning && inputValue.trim().length === 0}
                aria-label={isRunning ? "Stop task" : "Send task"}
                className={cn(
                  "absolute bottom-1.5 right-1.5 inline-flex size-10 items-center justify-center rounded-xl transition-colors",
                  isRunning
                    ? "bg-destructive text-white hover:opacity-90"
                    : inputValue.trim().length > 0
                      ? "bg-zinc-300 text-zinc-950 hover:bg-zinc-200"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isRunning ? <Square className="size-3.5 fill-current" /> : <Send className="size-3.5" />}
              </button>
            </form>
          )}
        </footer>
      </div>
    </section>
  );
}

export default ExtensionSidepanelShell;
