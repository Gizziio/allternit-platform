"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
const EMPTY_STATE_TYPING_WORDS = [
    "Enter a task to automate this page",
    "Call this extension from your web page",
    "Use this extension in your own agents",
];
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

@keyframes extension-sidepanel-card-enter {
  0% {
    opacity: 0;
    transform: translateY(8px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
`;
const DEFAULT_COPY = {
    title: "Allternit Extension",
    subtitle: "Chrome Sidepanel",
    emptyStateTitle: "Allternit Extension",
    emptyStateDescription: "Execute multi-page tasks",
    readyLabel: "Ready",
    contextLabel: "Current Browser Tab",
    settingsEyebrow: "Sidepanel Settings",
    settingsTitle: "Configure how the sidepanel executes tasks.",
    settingsDescription: "This view is adapter-driven in browser mode, but the sidepanel layout stays aligned to the packaged extension.",
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
};
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
};
const GITHUB_ICON_PATH = "M12 .297a12 12 0 0 0-3.794 23.39c.6.111.82-.261.82-.577v-2.234c-3.338.726-4.042-1.416-4.042-1.416-.546-1.387-1.333-1.757-1.333-1.757-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.775.418-1.305.762-1.605-2.665-.304-5.467-1.334-5.467-5.931 0-1.311.469-2.382 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.323 3.301 1.23a11.5 11.5 0 0 1 3.003-.404c1.018.005 2.042.138 3.003.404 2.291-1.553 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.839 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.48 5.921.43.371.823 1.102.823 2.222v3.293c0 .319.216.694.825.576A12 12 0 0 0 12 .297Z";
function cn(...classes) {
    return classes.filter(Boolean).join(" ");
}
function SvgIcon({ className, children, viewBox = "0 0 24 24", fill = "none", }) {
    return (_jsx("svg", { "aria-hidden": "true", viewBox: viewBox, className: className, fill: fill, stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", children: children }));
}
function ArrowLeft({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M19 12H5" }), _jsx("path", { d: "m12 19-7-7 7-7" })] }));
}
function BookOpen({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M3 6.5A2.5 2.5 0 0 1 5.5 4H11a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H5.5A2.5 2.5 0 0 0 3 19.5Z" }), _jsx("path", { d: "M21 6.5A2.5 2.5 0 0 0 18.5 4H13a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h5.5a2.5 2.5 0 0 1 2.5 2.5Z" })] }));
}
function CheckCircle({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "m9 12 2 2 4-4" })] }));
}
function Eye({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" }), _jsx("circle", { cx: "12", cy: "12", r: "2.5" })] }));
}
function Globe({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M3 12h18" }), _jsx("path", { d: "M12 3a14 14 0 0 1 0 18" }), _jsx("path", { d: "M12 3a14 14 0 0 0 0 18" })] }));
}
function HistoryIcon({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M3 5v5h5" }), _jsx("path", { d: "M3.5 10a9 9 0 1 0 2.2-4.8L3 10" }), _jsx("path", { d: "M12 7v5l3 2" })] }));
}
function Keyboard({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("rect", { x: "3", y: "6", width: "18", height: "12", rx: "2.5" }), _jsx("path", { d: "M7 10h.01" }), _jsx("path", { d: "M10 10h.01" }), _jsx("path", { d: "M13 10h.01" }), _jsx("path", { d: "M16 10h.01" }), _jsx("path", { d: "M7 14h6" }), _jsx("path", { d: "M15 14h2" })] }));
}
function Mouse({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("rect", { x: "7", y: "3", width: "10", height: "18", rx: "5" }), _jsx("path", { d: "M12 7v3" })] }));
}
function MoveVertical({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M12 5v14" }), _jsx("path", { d: "m8 9 4-4 4 4" }), _jsx("path", { d: "m8 15 4 4 4-4" })] }));
}
function RefreshCw({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M21 2v6h-6" }), _jsx("path", { d: "M20.5 8A9 9 0 1 0 21 12" })] }));
}
function Send({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M22 2 11 13" }), _jsx("path", { d: "m22 2-7 20-4-9-9-4Z" })] }));
}
function SettingsIcon({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("circle", { cx: "12", cy: "12", r: "3" }), _jsx("path", { d: "M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" })] }));
}
function Sparkles({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z" }), _jsx("path", { d: "m18.5 14 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" }), _jsx("path", { d: "m5 14 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" })] }));
}
function Square({ className }) {
    return (_jsx("svg", { "aria-hidden": "true", viewBox: "0 0 24 24", className: className, fill: "currentColor", children: _jsx("rect", { x: "6", y: "6", width: "12", height: "12", rx: "1.5" }) }));
}
function Trash2({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M4 7h16" }), _jsx("path", { d: "M10 11v6" }), _jsx("path", { d: "M14 11v6" }), _jsx("path", { d: "M6 7 7 19a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" }), _jsx("path", { d: "M9 7V4h6v3" })] }));
}
function XCircle({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "m9 9 6 6" }), _jsx("path", { d: "m15 9-6 6" })] }));
}
function Zap({ className }) {
    return (_jsx(SvgIcon, { className: className, children: _jsx("path", { d: "M13 2 4 14h6l-1 8 9-12h-6Z" }) }));
}
function Table({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }), _jsx("path", { d: "M3 9h18" }), _jsx("path", { d: "M3 15h18" }), _jsx("path", { d: "M9 3v18" }), _jsx("path", { d: "M15 3v18" })] }));
}
function FileText({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("path", { d: "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.7.7l4.6 4.6a2.4 2.4 0 0 1 .7 1.7V20a2 2 0 0 1-2 2Z" }), _jsx("path", { d: "M14 2v6h6" }), _jsx("path", { d: "M10 9H8" }), _jsx("path", { d: "M16 13H8" }), _jsx("path", { d: "M16 17H8" })] }));
}
function Presentation({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("rect", { width: "18", height: "12", x: "3", y: "4", rx: "2" }), _jsx("path", { d: "M8 20h8" }), _jsx("path", { d: "M12 16v4" })] }));
}
function ChevronDown({ className }) {
    return (_jsx(SvgIcon, { className: className, children: _jsx("path", { d: "m6 9 6 6 6-6" }) }));
}
function ChevronUp({ className }) {
    return (_jsx(SvgIcon, { className: className, children: _jsx("path", { d: "m18 15-6-6-6 6" }) }));
}
function Clock({ className }) {
    return (_jsxs(SvgIcon, { className: className, children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M12 7v5l3 2" })] }));
}
function usePrefersDarkMode() {
    const [isDark, setIsDark] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function")
            return;
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
function timeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60)
        return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
        return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
function Logo({ className }) {
    return (_jsx("img", { src: "/assets/page-agent-64.png", alt: "Page Agent", className: className, draggable: false }));
}
function MotionOverlay({ active }) {
    if (!active)
        return null;
    return (_jsxs("div", { "aria-hidden": "true", className: "pointer-events-none absolute inset-0 z-10 rounded-[inherit]", children: [_jsx("div", { className: "absolute inset-0 rounded-[inherit]", style: {
                    background: "linear-gradient(180deg, rgba(5, 7, 10, 0.04), rgba(5, 7, 10, 0.08)), radial-gradient(circle at 16% 18%, rgba(68, 128, 255, 0.16), transparent 30%), radial-gradient(circle at 84% 82%, rgba(51, 216, 168, 0.12), transparent 30%)",
                } }), _jsx("div", { className: "absolute inset-[-14px] rounded-[inherit] blur-2xl", style: {
                    background: "conic-gradient(from 180deg, rgba(92, 136, 255, 0.32), rgba(83, 196, 255, 0.12), rgba(179, 96, 255, 0.26), rgba(92, 136, 255, 0.32))",
                    animation: "extension-sidepanel-overlay-glow-a 4.8s ease-in-out infinite",
                } }), _jsx("div", { className: "absolute inset-[-14px] rounded-[inherit] blur-2xl", style: {
                    background: "conic-gradient(from 0deg, rgba(70, 212, 255, 0.22), rgba(92, 136, 255, 0.12), rgba(74, 208, 157, 0.24), rgba(70, 212, 255, 0.22))",
                    animation: "extension-sidepanel-overlay-glow-b 4.8s ease-in-out infinite",
                } }), _jsx("div", { className: "absolute inset-0 rounded-[inherit]", style: {
                    animation: "extension-sidepanel-overlay-border 2.2s ease-in-out infinite",
                } })] }));
}
function TypingAnimation({ words, className, typeSpeed = 20, deleteSpeed = 10, pauseDelay = 3000, cursorStyle = "underscore", }) {
    const [displayedText, setDisplayedText] = useState("");
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const [phase, setPhase] = useState("typing");
    useEffect(() => {
        if (words.length === 0)
            return;
        const currentWord = words[currentWordIndex] ?? "";
        const chars = Array.from(currentWord);
        const timeoutDelay = phase === "typing" ? typeSpeed : phase === "deleting" ? deleteSpeed : pauseDelay;
        const timeout = window.setTimeout(() => {
            if (phase === "typing") {
                if (currentCharIndex < chars.length) {
                    setDisplayedText(chars.slice(0, currentCharIndex + 1).join(""));
                    setCurrentCharIndex((value) => value + 1);
                }
                else {
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
    const cursorChar = cursorStyle === "block" ? "▌" : cursorStyle === "underscore" ? "_" : "|";
    return (_jsxs("span", { className: className, children: [displayedText, _jsx("span", { className: "inline-block", style: { animation: "extension-sidepanel-blink-cursor 1.2s step-end infinite" }, children: cursorChar })] }));
}
function StatusDot({ status }) {
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
    return (_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: cn("size-2 rounded-full", colorClass, status === "running" && "animate-pulse") }), _jsx("span", { className: "text-xs text-muted-foreground", children: label })] }));
}
function ConnectivityDot({ state }) {
    if (!state)
        return null;
    const config = {
        online: { color: "bg-green-500", label: "Connected" },
        offline: { color: "bg-destructive", label: "Offline" },
        checking: { color: "bg-amber-500", label: "Checking…" },
    }[state];
    return (_jsx("div", { className: "flex items-center gap-1", title: config.label, children: _jsx("span", { className: cn("size-1.5 rounded-full", config.color, state === "checking" && "animate-pulse") }) }));
}
function EmptyState({ copy, brandIcon, }) {
    const typingWords = useMemo(() => {
        const ordered = [
            EMPTY_STATE_TYPING_WORDS[0],
            copy.emptyStateDescription,
            EMPTY_STATE_TYPING_WORDS[1],
            EMPTY_STATE_TYPING_WORDS[2],
        ];
        return ordered.filter((word, index) => ordered.indexOf(word) === index);
    }, [copy.emptyStateDescription]);
    return (_jsxs("div", { className: "flex h-full flex-col items-center justify-center gap-4 px-6 text-center", children: [_jsx("style", { children: EXTENSION_SIDEPANEL_ANIMATIONS }), _jsxs("div", { className: "pointer-events-none relative select-none", children: [_jsx("div", { className: "absolute inset-0 -m-6 rounded-full blur-2xl", style: {
                            background: "conic-gradient(from 180deg, oklch(0.55 0.2 280), oklch(0.5 0.15 230), oklch(0.6 0.18 310), oklch(0.55 0.2 280))",
                            animation: "extension-sidepanel-glow-a 5s ease-in-out infinite",
                        } }), _jsx("div", { className: "absolute inset-0 -m-6 rounded-full blur-2xl", style: {
                            background: "conic-gradient(from 0deg, oklch(0.55 0.18 160), oklch(0.5 0.2 200), oklch(0.6 0.15 120), oklch(0.55 0.18 160))",
                            animation: "extension-sidepanel-glow-b 5s ease-in-out infinite",
                        } }), _jsx("div", { className: "relative flex items-center justify-center", children: brandIcon ?? _jsx(Logo, { className: "relative size-20 opacity-80" }) })] }), _jsxs("div", { children: [_jsx("h2", { className: "mb-1 text-base font-medium text-foreground", children: copy.emptyStateTitle }), _jsx(TypingAnimation, { className: "text-sm text-muted-foreground", words: typingWords, cursorStyle: "underscore", typeSpeed: 20, deleteSpeed: 10, pauseDelay: 3000 })] }), _jsxs("div", { className: "mt-1 flex items-center gap-3 text-muted-foreground", children: [_jsx("a", { href: "https://github.com/alibaba/page-agent", target: "_blank", rel: "noopener noreferrer", className: "transition-colors hover:text-foreground", title: "GitHub", children: _jsx("svg", { role: "img", viewBox: "0 0 24 24", className: "size-4 fill-current", children: _jsx("path", { d: GITHUB_ICON_PATH }) }) }), _jsx("a", { href: "https://alibaba.github.io/page-agent/docs/features/chrome-extension", target: "_blank", rel: "noopener noreferrer", className: "transition-colors hover:text-foreground", title: "Documentation", children: _jsx(BookOpen, { className: "size-4" }) }), _jsx("a", { href: "https://alibaba.github.io/page-agent", target: "_blank", rel: "noopener noreferrer", className: "transition-colors hover:text-foreground", title: "Website", children: _jsx(Globe, { className: "size-4" }) })] })] }));
}
function ResultCard({ success, text, }) {
    return (_jsxs("div", { className: cn("rounded-lg border p-3", success ? "border-green-500/30 bg-green-500/10" : "border-destructive/30 bg-destructive/10"), children: [_jsxs("div", { className: "mb-2 flex items-center gap-2", children: [success ? (_jsx(CheckCircle, { className: "size-3.5 text-green-500" })) : (_jsx(XCircle, { className: "size-3.5 text-destructive" })), _jsxs("span", { className: cn("text-xs font-medium", success ? "text-green-600 dark:text-green-400" : "text-destructive"), children: ["Result: ", success ? "Success" : "Failed"] })] }), _jsx("p", { className: "pl-5 text-[11px] text-muted-foreground whitespace-pre-wrap", children: text })] }));
}
function ReflectionItem({ icon, value }) {
    const [expanded, setExpanded] = useState(false);
    return (_jsxs(_Fragment, { children: [_jsx("span", { className: "flex justify-center text-xs", children: icon }), _jsx("button", { type: "button", onClick: () => setExpanded((value) => !value), className: cn("cursor-pointer text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground", !expanded && "line-clamp-1"), children: value })] }));
}
function ReflectionSection({ reflection, }) {
    const items = [
        { icon: "☑️", label: "eval", value: reflection.evaluation_previous_goal },
        { icon: "🧠", label: "memory", value: reflection.memory },
        { icon: "🎯", label: "goal", value: reflection.next_goal },
    ].filter((item) => Boolean(item.value));
    if (items.length === 0)
        return null;
    return (_jsx("div", { className: "mb-2", children: _jsx("div", { className: "grid grid-cols-[14px_1fr] gap-x-2 gap-y-2", children: items.map((item) => (_jsx(ReflectionItem, { icon: item.icon, value: item.value }, item.label))) }) }));
}
function ActionIcon({ name, className }) {
    const icons = {
        click_element_by_index: _jsx(Mouse, { className: className }),
        input: _jsx(Keyboard, { className: className }),
        scroll: _jsx(MoveVertical, { className: className }),
        go_to_url: _jsx(Globe, { className: className }),
    };
    return icons[name] ?? _jsx(Zap, { className: className });
}
function CopyButton({ text, label }) {
    const [copied, setCopied] = useState(false);
    return (_jsx("button", { type: "button", onClick: () => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
                void navigator.clipboard.writeText(text);
            }
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        }, className: "shrink-0 rounded border px-1 text-[9px] text-muted-foreground backdrop-blur-xs transition-colors hover:text-foreground", children: copied ? "Copied!" : label }));
}
function extractPrompt(rawRequest, role) {
    const messages = rawRequest?.messages;
    if (!messages)
        return null;
    const match = role === "system"
        ? messages.find((message) => message.role === role)
        : [...messages].reverse().find((message) => message.role === role);
    if (!match?.content)
        return null;
    return typeof match.content === "string" ? match.content : JSON.stringify(match.content, null, 2);
}
function RawSection({ rawRequest, rawResponse }) {
    const [activeTab, setActiveTab] = useState(null);
    if (!rawRequest && !rawResponse)
        return null;
    const content = activeTab === "request" ? rawRequest : activeTab === "response" ? rawResponse : null;
    const systemPrompt = activeTab === "request" ? extractPrompt(rawRequest, "system") : null;
    const userPrompt = activeTab === "request" ? extractPrompt(rawRequest, "user") : null;
    return (_jsxs("div", { className: "mt-2 border-t border-dashed pt-2", children: [_jsxs("div", { className: "-my-1 flex items-center gap-3", children: [rawRequest != null && (_jsx("button", { type: "button", onClick: () => setActiveTab((tab) => (tab === "request" ? null : "request")), className: cn("cursor-pointer border-b text-[10px] transition-colors", activeTab === "request"
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"), children: "Raw Request" })), rawResponse != null && (_jsx("button", { type: "button", onClick: () => setActiveTab((tab) => (tab === "response" ? null : "response")), className: cn("cursor-pointer border-b text-[10px] transition-colors", activeTab === "response"
                            ? "border-foreground text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"), children: "Raw Response" }))] }), content != null && (_jsxs("div", { className: "relative mt-1.5", children: [_jsxs("div", { className: "absolute right-1 top-1 flex gap-1", children: [systemPrompt && _jsx(CopyButton, { text: systemPrompt, label: "Copy System" }), userPrompt && _jsx(CopyButton, { text: userPrompt, label: "Copy User" }), _jsx(CopyButton, { text: JSON.stringify(content, null, 4), label: "Copy" })] }), _jsx("pre", { className: "max-h-60 overflow-x-auto overflow-y-auto rounded bg-muted p-2 pt-5 text-[10px] text-foreground/70", children: JSON.stringify(content, null, 4) })] }))] }));
}
function StepCard({ event }) {
    return (_jsxs("div", { className: "rounded-lg border border-border bg-muted/40 p-2.5 border-l-2 border-l-blue-500/50", style: { animation: "extension-sidepanel-card-enter 0.25s ease-out both" }, children: [_jsxs("div", { className: "mb-2 text-[11px] font-semibold tracking-wide text-foreground", children: ["Step #", (event.stepIndex ?? 0) + 1] }), event.reflection && _jsx(ReflectionSection, { reflection: event.reflection }), event.action && (_jsxs("div", { children: [_jsx("div", { className: "mb-1 text-[11px] font-semibold tracking-wide text-foreground", children: "Actions" }), _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(ActionIcon, { name: event.action.name, className: "mt-0.5 size-3.5 shrink-0 text-blue-500" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "mb-0.5 line-clamp-1 break-all text-xs text-foreground/80 hover:line-clamp-none", children: [_jsx("span", { className: "font-medium text-foreground/70", children: event.action.name }), event.action.name !== "done" && (_jsx("span", { className: "ml-1.5 text-muted-foreground/70", children: JSON.stringify(event.action.input) }))] }), _jsxs("p", { className: "grid grid-cols-[auto_1fr] gap-1.5 text-[11px] text-muted-foreground/70", children: [_jsx("span", { children: "\u2514" }), _jsx("span", { className: "line-clamp-1 break-all hover:line-clamp-3", children: event.action.output })] })] })] })] })), _jsx(RawSection, { rawRequest: event.rawRequest, rawResponse: event.rawResponse })] }));
}
function ObservationCard({ event, }) {
    return (_jsx("div", { className: "rounded-lg border border-border bg-muted/40 p-2.5 border-l-2 border-l-green-500/50", style: { animation: "extension-sidepanel-card-enter 0.25s ease-out both" }, children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Eye, { className: "mt-0.5 size-3.5 shrink-0 text-green-500" }), _jsx("span", { className: "text-[11px] text-muted-foreground", children: event.content })] }) }));
}
function RetryCard({ event }) {
    return (_jsx("div", { className: "rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5", style: { animation: "extension-sidepanel-card-enter 0.25s ease-out both" }, children: _jsxs("div", { className: "flex items-start gap-1.5", children: [_jsx(RefreshCw, { className: "mt-0.5 size-3 shrink-0 text-amber-500" }), _jsxs("span", { className: "text-xs text-amber-600 dark:text-amber-400", children: [event.message, " (", event.attempt, "/", event.maxAttempts, ")"] })] }) }));
}
function ErrorCard({ event }) {
    return (_jsxs("div", { className: "rounded-lg border border-destructive/30 bg-destructive/10 p-2.5", style: { animation: "extension-sidepanel-card-enter 0.25s ease-out both" }, children: [_jsxs("div", { className: "flex items-start gap-1.5", children: [_jsx(XCircle, { className: "mt-0.5 size-3 shrink-0 text-destructive" }), _jsx("span", { className: "text-xs text-destructive", children: event.message })] }), _jsx(RawSection, { rawResponse: event.rawResponse })] }));
}
function UserTakeoverCard({ event, }) {
    return (_jsx("div", { className: "rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5", style: { animation: "extension-sidepanel-card-enter 0.25s ease-out both" }, children: _jsx("span", { className: "text-xs text-amber-700 dark:text-amber-300", children: event.message ?? "User takeover requested." }) }));
}
function ToolExecutionCard({ event, }) {
    const [expanded, setExpanded] = useState(false);
    const statusConfig = {
        pending: { label: "Pending", color: "text-amber-500", dot: "bg-amber-500", border: "border-l-amber-500/50" },
        awaiting_approval: { label: "Awaiting approval", color: "text-amber-500", dot: "bg-amber-500", border: "border-l-amber-500/50" },
        running: { label: "Running", color: "text-blue-500", dot: "bg-blue-500", border: "border-l-blue-500/50" },
        completed: { label: "Done", color: "text-green-500", dot: "bg-green-500", border: "border-l-green-500/50" },
        error: { label: "Error", color: "text-destructive", dot: "bg-destructive", border: "border-l-destructive/50" },
        rejected: { label: "Rejected", color: "text-muted-foreground", dot: "bg-muted-foreground", border: "border-l-muted-foreground/50" },
    };
    const cfg = statusConfig[event.status];
    const ToolIcon = event.tool.startsWith("excel_")
        ? Table
        : event.tool.startsWith("word_")
            ? FileText
            : event.tool.startsWith("ppt_")
                ? Presentation
                : Zap;
    return (_jsxs("div", { className: cn("rounded-lg border border-border bg-muted/40 p-2.5 transition-colors", "border-l-2", cfg.border), style: { animation: "extension-sidepanel-card-enter 0.25s ease-out both" }, children: [_jsxs("div", { className: "flex items-start gap-2", children: [_jsx(ToolIcon, { className: cn("mt-0.5 size-3.5 shrink-0", cfg.color) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-xs font-medium text-foreground/90", children: event.description }), _jsxs("div", { className: "mt-1 flex items-center gap-2", children: [_jsxs("span", { className: "flex items-center gap-1", children: [_jsx("span", { className: cn("size-1.5 rounded-full", cfg.dot, event.status === "running" && "animate-pulse") }), _jsx("span", { className: cn("text-[10px]", cfg.color), children: cfg.label })] }), typeof event.duration === "number" && (_jsxs("span", { className: "flex items-center gap-0.5 text-[10px] text-muted-foreground", children: [_jsx(Clock, { className: "size-2.5" }), event.duration, "ms"] }))] })] }), _jsx("button", { type: "button", onClick: () => setExpanded((v) => !v), className: "shrink-0 text-muted-foreground transition-colors hover:text-foreground", "aria-label": expanded ? "Collapse details" : "Expand details", children: expanded ? _jsx(ChevronUp, { className: "size-3" }) : _jsx(ChevronDown, { className: "size-3" }) })] }), expanded && (_jsx("div", { className: "mt-2 space-y-1.5 border-t border-border/60 pt-2", children: _jsx("pre", { className: "max-h-32 overflow-auto rounded bg-background/60 p-1.5 text-[10px] text-foreground/70", children: JSON.stringify({ tool: event.tool, input: event.input, output: event.output }, null, 2) }) }))] }));
}
export function EventCard({ event }) {
    if (event.type === "step" && event.action?.name === "done") {
        const input = event.action.input;
        return (_jsxs(_Fragment, { children: [_jsx(StepCard, { event: event }), _jsx(ResultCard, { success: input?.success ?? true, text: input?.text || event.action.output || "" })] }));
    }
    if (event.type === "step")
        return _jsx(StepCard, { event: event });
    if (event.type === "observation")
        return _jsx(ObservationCard, { event: event });
    if (event.type === "tool_execution")
        return _jsx(ToolExecutionCard, { event: event });
    if (event.type === "retry")
        return _jsx(RetryCard, { event: event });
    if (event.type === "error")
        return _jsx(ErrorCard, { event: event });
    if (event.type === "user_takeover")
        return _jsx(UserTakeoverCard, { event: event });
    return null;
}
function StreamingCard({ text }) {
    return (_jsx("div", { className: "rounded-lg border border-border/80 bg-muted/40 p-3", style: { animation: "extension-sidepanel-card-enter 0.25s ease-out both" }, children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsxs("div", { className: "relative mt-0.5", children: [_jsx(Sparkles, { className: "size-3.5 text-blue-500" }), _jsx("span", { className: "absolute -right-0.5 -top-0.5 size-1.5 rounded-full animate-ping bg-blue-500" })] }), _jsx("div", { className: "min-w-0 flex-1", children: _jsxs("p", { className: "whitespace-pre-wrap text-xs leading-relaxed text-foreground/90", children: [text, _jsx("span", { className: "ml-0.5 inline-block text-blue-500", style: { animation: "extension-sidepanel-blink-cursor 1s step-end infinite" }, children: "|" })] }) })] }) }));
}
export function ActivityCard({ activity }) {
    if (activity.type === "streaming") {
        return _jsx(StreamingCard, { text: activity.text });
    }
    const info = activity.type === "thinking"
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
    return (_jsxs("div", { className: "flex animate-pulse items-center gap-2 rounded-lg border border-border bg-muted/40 p-2.5", children: [_jsxs("div", { className: "relative", children: [_jsx(Sparkles, { className: cn("size-3.5", info.color) }), _jsx("span", { className: cn("absolute -right-0.5 -top-0.5 size-1.5 rounded-full animate-ping", info.dot) })] }), _jsx("span", { className: cn("text-xs", info.color), children: info.text })] }));
}
function DefaultHistoryListView({ sessions, onSelect, onBack, onDeleteSession, onClearSessions, }) {
    return (_jsxs("div", { className: "flex h-full flex-col bg-background", children: [_jsxs("header", { className: "flex items-center gap-2 border-b px-3 py-2", children: [_jsx("button", { type: "button", onClick: onBack, "aria-label": "Back to chat", className: "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", children: _jsx(ArrowLeft, { className: "size-3.5" }) }), _jsx("span", { className: "flex-1 text-sm font-medium", children: "History" }), sessions.length > 0 && onClearSessions && (_jsxs("button", { type: "button", onClick: () => {
                            void onClearSessions();
                        }, className: "flex h-6 items-center gap-1 rounded-md px-2 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-destructive", children: [_jsx(Trash2, { className: "size-3" }), "Clear All"] }))] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: sessions.length === 0 ? (_jsx("div", { className: "flex h-32 items-center justify-center text-xs text-muted-foreground", children: "No history yet" })) : (sessions.map((session) => (_jsxs("div", { role: "button", tabIndex: 0, onClick: () => onSelect(session.id), onKeyDown: (event) => event.key === "Enter" && onSelect(session.id), className: "group flex cursor-pointer items-start gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted/50", children: [session.status === "completed" ? (_jsx(CheckCircle, { className: "mt-0.5 size-3.5 shrink-0 text-green-500" })) : (_jsx(XCircle, { className: "mt-0.5 size-3.5 shrink-0 text-destructive" })), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate text-xs font-medium", children: session.task }), _jsxs("p", { className: "mt-0.5 text-[10px] text-muted-foreground", children: [timeAgo(session.createdAt), " \u00B7 ", session.history.length, " steps"] })] }), onDeleteSession && (_jsx("button", { type: "button", "aria-label": `Delete history entry ${session.task}`, onClick: (event) => {
                                event.stopPropagation();
                                void onDeleteSession(session.id);
                            }, className: "shrink-0 p-1 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100", children: _jsx(Trash2, { className: "size-3" }) }))] }, session.id)))) })] }));
}
function DefaultHistoryDetailView({ session, onBack }) {
    if (!session) {
        return (_jsx("div", { className: "flex h-full items-center justify-center bg-background text-xs text-muted-foreground", children: "Loading..." }));
    }
    return (_jsxs("div", { className: "flex h-full flex-col bg-background", children: [_jsxs("header", { className: "flex items-center gap-2 border-b px-3 py-2", children: [_jsx("button", { type: "button", onClick: onBack, "aria-label": "Back to history", className: "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", children: _jsx(ArrowLeft, { className: "size-3.5" }) }), _jsx("span", { className: "truncate text-sm font-medium", children: "History" })] }), _jsxs("div", { className: "border-b bg-muted/30 px-3 py-2", children: [_jsx("div", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: "Task" }), _jsx("div", { className: "text-xs font-medium", title: session.task, children: session.task })] }), _jsx("div", { className: "flex-1 space-y-2 overflow-y-auto p-3", children: session.history.map((event, index) => (_jsx(EventCard, { event: event }, `${session.id}-${index}`))) })] }));
}
function DefaultConfigView({ config, copy, pageLabel, onSave, onBack, }) {
    const [permissionMode, setPermissionMode] = useState(config.permissionMode);
    const [language, setLanguage] = useState(config.language);
    useEffect(() => {
        setPermissionMode(config.permissionMode);
        setLanguage(config.language);
    }, [config.language, config.permissionMode]);
    return (_jsxs("div", { className: "flex h-full flex-col bg-background", children: [_jsxs("header", { className: "flex items-center gap-2 border-b px-3 py-2", children: [_jsx("button", { type: "button", onClick: onBack, "aria-label": "Back to chat", className: "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", children: _jsx(ArrowLeft, { className: "size-3.5" }) }), _jsx("span", { className: "text-sm font-medium", children: "Settings" })] }), _jsxs("div", { className: "flex-1 space-y-4 overflow-y-auto p-4", children: [_jsxs("div", { className: "rounded-md border bg-muted/30 p-3", children: [_jsx("div", { className: "text-[10px] uppercase tracking-wide text-muted-foreground", children: copy.settingsEyebrow }), _jsx("p", { className: "mt-1 text-sm font-medium text-foreground", children: copy.settingsTitle }), _jsx("p", { className: "mt-1 text-xs leading-relaxed text-muted-foreground", children: copy.settingsDescription })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs text-muted-foreground", children: "Permission Mode" }), _jsxs("select", { value: permissionMode, onChange: (event) => setPermissionMode(event.target.value), className: "h-8 w-full rounded-md border border-input bg-background px-2 text-xs", children: [_jsx("option", { value: "ask", children: "Ask before acting" }), _jsx("option", { value: "act", children: "Direct action mode" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs text-muted-foreground", children: "Language" }), _jsxs("select", { value: language, onChange: (event) => setLanguage(event.target.value), className: "h-8 w-full rounded-md border border-input bg-background px-2 text-xs", children: [_jsx("option", { value: "en", children: "English" }), _jsx("option", { value: "zh", children: "Chinese" })] })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs text-muted-foreground", children: copy.settingsContextLabel }), _jsx("div", { className: "rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground", children: config.runtimeLabel })] }), _jsxs("div", { className: "space-y-1.5", children: [_jsx("label", { className: "text-xs text-muted-foreground", children: copy.contextLabel }), _jsx("div", { className: "rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground", children: pageLabel })] })] }), _jsx("footer", { className: "border-t p-3", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", onClick: onBack, className: "flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium transition-colors hover:bg-muted", children: "Cancel" }), _jsx("button", { type: "button", onClick: () => onSave({ permissionMode, language }), className: "flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90", children: "Save" })] }) })] }));
}
export function ExtensionSidepanelShell({ adapter, copy, brandIcon, testId = "extension-sidepanel-shell", containerClassName, renderConfigView, renderHistoryListView, renderHistoryDetailView, renderComposer, }) {
    const shellCopy = { ...DEFAULT_COPY, ...copy };
    const [view, setView] = useState({ name: "chat" });
    const [inputValue, setInputValue] = useState("");
    const historyRef = useRef(null);
    const textareaRef = useRef(null);
    const prefersDark = usePrefersDarkMode();
    const themeStyle = useMemo(() => ({
        ...(prefersDark ? DARK_THEME : LIGHT_THEME),
        colorScheme: prefersDark ? "dark" : "light",
    }), [prefersDark]);
    const selectedSession = useMemo(() => {
        return view.name === "history-detail"
            ? adapter.sessions.find((session) => session.id === view.sessionId) ?? null
            : null;
    }, [adapter.sessions, view]);
    const isRunning = adapter.status === "running";
    const showEmptyState = adapter.currentTask.length === 0 && adapter.history.length === 0 && !isRunning;
    const composerPlaceholder = "Describe your task... (Enter to send)";
    useEffect(() => {
        if (view.name !== "chat" || !historyRef.current)
            return;
        historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }, [adapter.activity, adapter.history, view]);
    const handleSubmit = useCallback((valueOrEvent) => {
        if (typeof valueOrEvent !== "string") {
            valueOrEvent?.preventDefault();
        }
        const task = (typeof valueOrEvent === "string" ? valueOrEvent : inputValue).trim();
        if (!task || isRunning)
            return;
        adapter.execute(task);
        setInputValue("");
        if (!renderComposer) {
            textareaRef.current?.focus();
        }
    }, [adapter, inputValue, isRunning, renderComposer]);
    const handleStop = useCallback(() => {
        adapter.stop();
        if (!renderComposer) {
            textareaRef.current?.focus();
        }
    }, [adapter, renderComposer]);
    const handleKeyDown = useCallback((event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            handleSubmit();
        }
    }, [handleSubmit]);
    if (view.name === "config") {
        return (_jsx("section", { "data-testid": testId, className: cn("relative flex flex-col overflow-hidden bg-background text-foreground", prefersDark && "dark", containerClassName ?? "h-dvh"), style: themeStyle, children: renderConfigView ? (renderConfigView({
                config: adapter.config,
                copy: shellCopy,
                pageLabel: adapter.pageLabel,
                onBack: () => setView({ name: "chat" }),
                onSave: (nextConfig) => {
                    adapter.configure(nextConfig);
                    setView({ name: "chat" });
                },
            })) : (_jsx(DefaultConfigView, { config: adapter.config, copy: shellCopy, pageLabel: adapter.pageLabel, onBack: () => setView({ name: "chat" }), onSave: (nextConfig) => {
                    adapter.configure(nextConfig);
                    setView({ name: "chat" });
                } })) }));
    }
    if (view.name === "history") {
        return (_jsx("section", { "data-testid": testId, className: cn("relative flex flex-col overflow-hidden bg-background text-foreground", prefersDark && "dark", containerClassName ?? "h-dvh"), style: themeStyle, children: renderHistoryListView ? (renderHistoryListView({
                sessions: adapter.sessions,
                onBack: () => setView({ name: "chat" }),
                onSelect: (sessionId) => setView({ name: "history-detail", sessionId }),
                onDeleteSession: adapter.deleteSession,
                onClearSessions: adapter.clearSessions,
            })) : (_jsx(DefaultHistoryListView, { sessions: adapter.sessions, onBack: () => setView({ name: "chat" }), onSelect: (sessionId) => setView({ name: "history-detail", sessionId }), onDeleteSession: adapter.deleteSession, onClearSessions: adapter.clearSessions })) }));
    }
    if (view.name === "history-detail") {
        return (_jsx("section", { "data-testid": testId, className: cn("relative flex flex-col overflow-hidden bg-background text-foreground", prefersDark && "dark", containerClassName ?? "h-dvh"), style: themeStyle, children: renderHistoryDetailView ? (renderHistoryDetailView({
                session: selectedSession,
                sessionId: view.sessionId,
                onBack: () => setView({ name: "history" }),
            })) : (_jsx(DefaultHistoryDetailView, { session: selectedSession, sessionId: view.sessionId, onBack: () => setView({ name: "history" }) })) }));
    }
    return (_jsx("section", { "data-testid": testId, className: cn("relative flex min-h-0 flex-col bg-transparent p-2 text-foreground", prefersDark && "dark", containerClassName ?? "h-dvh"), style: themeStyle, children: _jsxs("div", { className: "relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-border/80 bg-card shadow-2xl", children: [_jsx(MotionOverlay, { active: isRunning }), _jsxs("header", { className: "flex items-center justify-between border-b border-border/80 px-4 py-3", children: [_jsxs("div", { className: "flex items-center gap-2.5", children: [brandIcon ?? _jsx(Logo, { className: "size-5" }), _jsx("span", { className: "text-sm font-semibold", children: shellCopy.title })] }), _jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(ConnectivityDot, { state: adapter.connectivity }), _jsx(StatusDot, { status: adapter.status }), _jsx("button", { type: "button", "aria-label": "Open history", onClick: () => setView({ name: "history" }), className: "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", children: _jsx(HistoryIcon, { className: "size-3.5" }) }), _jsx("button", { type: "button", "aria-label": "Open settings", onClick: () => setView({ name: "config" }), className: "inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", children: _jsx(SettingsIcon, { className: "size-3.5" }) })] })] }), _jsxs("main", { className: "flex min-h-0 flex-1 flex-col", children: [adapter.currentTask && (_jsxs("div", { className: "border-b bg-muted/20 px-4 py-2.5", children: [_jsx("div", { className: "text-[10px] text-muted-foreground", children: "Task" }), _jsx("div", { className: "truncate text-xs font-medium", title: adapter.currentTask, children: adapter.currentTask })] })), _jsxs("div", { ref: historyRef, className: "flex-1 space-y-3 overflow-y-auto p-4", children: [showEmptyState && _jsx(EmptyState, { copy: shellCopy, brandIcon: brandIcon }), adapter.history.map((event, index) => (_jsx(EventCard, { event: event }, `extension-event-${index}`))), adapter.activity && _jsx(ActivityCard, { activity: adapter.activity })] })] }), _jsx("footer", { className: "border-t border-border/80 p-3.5", children: renderComposer ? (renderComposer({
                        isRunning,
                        value: inputValue,
                        placeholder: composerPlaceholder,
                        onValueChange: setInputValue,
                        onSubmit: (taskValue) => handleSubmit(taskValue),
                        onStop: handleStop,
                    })) : (_jsxs("form", { onSubmit: handleSubmit, className: "relative rounded-[14px] border border-input bg-background/80 shadow-sm", children: [_jsx("textarea", { ref: textareaRef, rows: 1, value: inputValue, disabled: isRunning, placeholder: composerPlaceholder, onChange: (event) => setInputValue(event.target.value), onKeyDown: handleKeyDown, className: "min-h-12 w-full resize-none bg-transparent px-4 py-3 pr-14 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" }), _jsx("button", { type: isRunning ? "button" : "submit", onClick: isRunning ? handleStop : undefined, disabled: !isRunning && inputValue.trim().length === 0, "aria-label": isRunning ? "Stop task" : "Send task", className: cn("absolute bottom-1.5 right-1.5 inline-flex size-10 items-center justify-center rounded-xl transition-colors", isRunning
                                    ? "bg-destructive text-white hover:opacity-90"
                                    : inputValue.trim().length > 0
                                        ? "bg-zinc-300 text-zinc-950 hover:bg-zinc-200"
                                        : "bg-muted text-muted-foreground"), children: isRunning ? _jsx(Square, { className: "size-3.5 fill-current" }) : _jsx(Send, { className: "size-3.5" }) })] })) })] }) }));
}
export default ExtensionSidepanelShell;
