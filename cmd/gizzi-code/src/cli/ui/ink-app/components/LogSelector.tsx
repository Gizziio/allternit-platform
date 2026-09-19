import chalk from '@/shared/util/chalk'
import figures from 'figures';
import Fuse from 'fuse.js';
import React from 'react';
import { getOriginalCwd, getSessionId } from '../bootstrap/state';
import { useExitOnCtrlCDWithKeybindings } from '../hooks/useExitOnCtrlCDWithKeybindings';
import { useSearchInput } from '../hooks/useSearchInput';
import { useTerminalSize } from '../hooks/useTerminalSize';
import { applyColor } from '../ink/colorize';
import type { Color } from '../ink/styles';
import { Box, Text, useInput, useTerminalFocus, useTheme } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
import { logEvent } from '../services/analytics/index';
import type { LogOption, SerializedMessage } from '../types/logs';
import { formatLogMetadata, truncateToWidth } from '../utils/format';
import { getWorktreePaths } from '../utils/getWorktreePaths';
import { getBranch } from '../utils/git';
import { getLogDisplayTitle } from '../utils/log';
import { getFirstMeaningfulUserMessageTextContent, getSessionIdFromLog, isCustomTitleEnabled, saveCustomTitle } from '../utils/sessionStorage';
import { getTheme } from '../utils/theme';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint';
import { Select } from './CustomSelect/select';
import { Byline } from './design-system/Byline';
import { Divider } from './design-system/Divider';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
import { SearchBox } from './SearchBox';
import { SessionPreview } from './SessionPreview';
import { Spinner } from './Spinner';
import { TagTabs } from './TagTabs';
import TextInput from './TextInput';
import { type TreeNode, TreeSelect } from './ui/TreeSelect';
type AgenticSearchState = {
  status: 'idle';
} | {
  status: 'searching';
} | {
  status: 'results';
  results: LogOption[];
  query: string;
} | {
  status: 'error';
  message: string;
};
type DeepSearchResult = {
  log: LogOption;
  score?: number;
  searchableText: string;
};
type DeepSearchResults = {
  results: DeepSearchResult[];
  query: string;
};
export type LogSelectorProps = {
  logs: LogOption[];
  maxHeight?: number;
  forceWidth?: number;
  onCancel?: () => void;
  onSelect: (log: LogOption) => void;
  onLogsChanged?: () => void;
  onLoadMore?: (count: number) => void;
  initialSearchQuery?: string;
  showAllProjects?: boolean;
  onToggleAllProjects?: () => void;
  onAgenticSearch?: (query: string, logs: LogOption[], signal?: AbortSignal) => Promise<LogOption[]>;
};
type LogTreeNode = TreeNode<{
  log: LogOption;
  indexInFiltered: number;
}>;
function normalizeAndTruncateToWidth(text: string, maxWidth: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return truncateToWidth(normalized, maxWidth);
}

// Width of prefixes that TreeSelect will add
const PARENT_PREFIX_WIDTH = 2; // '▼ ' or '▶ '
const CHILD_PREFIX_WIDTH = 4; // '  ▸ '

// Deep search constants
const DEEP_SEARCH_MAX_MESSAGES = 2000;
const DEEP_SEARCH_CROP_SIZE = 1000;
const DEEP_SEARCH_MAX_TEXT_LENGTH = 50000; // Cap searchable text per session
const FUSE_THRESHOLD = 0.3;
const DATE_TIE_THRESHOLD_MS = 60 * 1000; // 1 minute - use relevance as tie-breaker within this window
const SNIPPET_CONTEXT_CHARS = 50; // Characters to show before/after match

type Snippet = {
  before: string;
  match: string;
  after: string;
};
function formatSnippet({
  before,
  match,
  after
}: Snippet, highlightColor: (text: string) => string): string {
  return chalk.dim(before) + highlightColor(match) + chalk.dim(after);
}
function extractSnippet(text: string, query: string, contextChars: number): Snippet | null {
  // Find exact query occurrence (case-insensitive).
  // Note: Fuse does fuzzy matching, so this may miss some fuzzy matches.
  // This is acceptable for now - in the future we could use Fuse's includeMatches
  // option and work with the match indices directly.
  const matchIndex = text.toLowerCase().indexOf(query.toLowerCase());
  if (matchIndex === -1) return null;
  const matchEnd = matchIndex + query.length;
  const snippetStart = Math.max(0, matchIndex - contextChars);
  const snippetEnd = Math.min(text.length, matchEnd + contextChars);
  const beforeRaw = text.slice(snippetStart, matchIndex);
  const matchText = text.slice(matchIndex, matchEnd);
  const afterRaw = text.slice(matchEnd, snippetEnd);
  return {
    before: (snippetStart > 0 ? '…' : '') + beforeRaw.replace(/\s+/g, ' ').trimStart(),
    match: matchText.trim(),
    after: afterRaw.replace(/\s+/g, ' ').trimEnd() + (snippetEnd < text.length ? '…' : '')
  };
}
function buildLogLabel(log: LogOption, maxLabelWidth: number, options?: {
  isGroupHeader?: boolean;
  isChild?: boolean;
  forkCount?: number;
}): string {
  const {
    isGroupHeader = false,
    isChild = false,
    forkCount = 0
  } = options || {};

  // TreeSelect will add the prefix, so we just need to account for its width
  const prefixWidth = isGroupHeader && forkCount > 0 ? PARENT_PREFIX_WIDTH : isChild ? CHILD_PREFIX_WIDTH : 0;
  const sessionCountSuffix = isGroupHeader && forkCount > 0 ? ` (+${forkCount} other ${forkCount === 1 ? 'session' : 'sessions'})` : '';
  const sidechainSuffix = log.isSidechain ? ' (sidechain)' : '';
  const maxSummaryWidth = maxLabelWidth - prefixWidth - sidechainSuffix.length - sessionCountSuffix.length;
  const truncatedSummary = normalizeAndTruncateToWidth(getLogDisplayTitle(log), maxSummaryWidth);
  return `${truncatedSummary}${sidechainSuffix}${sessionCountSuffix}`;
}
function buildLogMetadata(log: LogOption, options?: {
  isChild?: boolean;
  showProjectPath?: boolean;
}): string {
  const {
    isChild = false,
    showProjectPath = false
  } = options || {};
  // Match the child prefix width for proper alignment
  const childPadding = isChild ? '    ' : ''; // 4 spaces to match '  ▸ '
  const baseMetadata = formatLogMetadata(log);
  const projectSuffix = showProjectPath && log.projectPath ? ` · ${log.projectPath}` : '';
  return childPadding + baseMetadata + projectSuffix;
}
export function LogSelector({
    logs,
    maxHeight: t1,
    forceWidth,
    onCancel,
    onSelect,
    onLogsChanged,
    onLoadMore,
    initialSearchQuery,
    showAllProjects: t2,
    onToggleAllProjects,
    onAgenticSearch
}: LogSelectorProps) {
  const maxHeight = t1 === undefined ? Infinity : t1;
  const showAllProjects = t2 === undefined ? false : t2;
  const terminalSize = useTerminalSize();
  const columns = forceWidth === undefined ? terminalSize.columns : forceWidth;
  const exitState = useExitOnCtrlCDWithKeybindings(onCancel);
  const isTerminalFocused = useTerminalFocus();
  const t3 = isCustomTitleEnabled();

  const isResumeWithRenameEnabled = t3;
  const isDeepSearchEnabled = false;
  const [themeName] = useTheme();
  const t4 = getTheme(themeName);

  const theme = t4;
  const t5 = (text: string) => applyColor(text, theme.warning as Color);

  const highlightColor = t5;
  const isAgenticSearchEnabled = false;
  const [currentBranch, setCurrentBranch] = React.useState<string | null>(null);
  const [branchFilterEnabled, setBranchFilterEnabled] = React.useState(false);
  const [showAllWorktrees, setShowAllWorktrees] = React.useState(false);
  const [hasMultipleWorktrees, setHasMultipleWorktrees] = React.useState(false);
  const t6 = getOriginalCwd();

  const currentCwd = t6;
  const [renameValue, setRenameValue] = React.useState("");
  const [renameCursorOffset, setRenameCursorOffset] = React.useState(0);
  const t7 = new Set<string>();

  const [expandedGroupSessionIds, setExpandedGroupSessionIds] = React.useState(t7);
  const [focusedNode, setFocusedNode] = React.useState<LogTreeNode | null>(null);
  const [focusedIndex, setFocusedIndex] = React.useState(1);
  const [viewMode, setViewMode] = React.useState("list");
  const [previewLog, setPreviewLog] = React.useState<LogOption | null>(null);
  const prevFocusedIdRef = React.useRef<string | null>(null);
  const [selectedTagIndex, setSelectedTagIndex] = React.useState(0);
  const [agenticSearchState, setAgenticSearchState] = React.useState<AgenticSearchState>({
      status: "idle"
    });
  const [isAgenticSearchOptionFocused, setIsAgenticSearchOptionFocused] = React.useState(false);
  const agenticSearchAbortRef = React.useRef<AbortController | null>(null);
  const t9 = viewMode === "search" && agenticSearchState.status !== "searching";
  const t10 = () => {
      setViewMode("list");
      logEvent("tengu_session_search_toggled", {
        enabled: false
      });
    };
  const t11 = () => {
      setViewMode("list");
      logEvent("tengu_session_search_toggled", {
        enabled: false
      });
    };
  const t12 = ["n"];

  const t13 = initialSearchQuery || "";
  const t14 = {
      isActive: t9,
      onExit: t10,
      onExitUp: t11,
      passthroughCtrlKeys: t12,
      initialQuery: t13
    };

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    cursorOffset: searchCursorOffset
  } = useSearchInput(t14);
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [debouncedDeepSearchQuery, setDebouncedDeepSearchQuery] = React.useState("");
  const t15 = () => {
      if (!deferredSearchQuery) {
        setDebouncedDeepSearchQuery("");
        return;
      }
      const timeoutId = setTimeout(setDebouncedDeepSearchQuery, 300, deferredSearchQuery);
      return () => clearTimeout(timeoutId);
    };
  const t16 = [deferredSearchQuery];

  React.useEffect(t15, t16);
  const [deepSearchResults, setDeepSearchResults] = React.useState<DeepSearchResults | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const t17 = () => {
      getBranch().then(branch => setCurrentBranch(branch));
      getWorktreePaths(currentCwd).then(paths => {
        setHasMultipleWorktrees(paths.length > 1);
      });
    };
  const t18 = [currentCwd];

  React.useEffect(t17, t18);
  const searchableTextByLog = new Map(logs.map(_temp));
  let t19;
  t19 = null;
  const t20 = getUniqueTags(logs);

  const uniqueTags = t20;
  const hasTags = uniqueTags.length > 0;
  const t21 = hasTags ? ["All", ...uniqueTags] : [];

  const tagTabs = t21;
  const effectiveTagIndex = tagTabs.length > 0 && selectedTagIndex < tagTabs.length ? selectedTagIndex : 0;
  const selectedTab = tagTabs[effectiveTagIndex];
  const tagFilter = selectedTab === "All" ? undefined : selectedTab;
  const tagTabsLines = hasTags ? 1 : 0;
  let filtered = logs;
  if (isResumeWithRenameEnabled) {
    const t22 = logs.filter(_temp2);

    filtered = t22;
  }
  if (tagFilter !== undefined) {
    const t23 = log_2 => log_2.tag === tagFilter;

    const t22 = filtered.filter(t23);

    filtered = t22;
  }
  if (branchFilterEnabled && currentBranch) {
    const t23 = log_3 => log_3.gitBranch === currentBranch;

    const t22 = filtered.filter(t23);

    filtered = t22;
  }
  if (hasMultipleWorktrees && !showAllWorktrees) {
    const t23 = log_4 => log_4.projectPath === currentCwd;

    const t22 = filtered.filter(t23);

    filtered = t22;
  }
  const baseFilteredLogs = filtered;
  let t22;
  bb0: {
    if (!searchQuery) {
      t22 = baseFilteredLogs;
      break bb0;
    }
    const query = searchQuery.toLowerCase();
    const t23 = baseFilteredLogs.filter(log_5 => {
        const displayedTitle = getLogDisplayTitle(log_5).toLowerCase();
        const branch_0 = (log_5.gitBranch || "").toLowerCase();
        const tag = (log_5.tag || "").toLowerCase();
        const prInfo = log_5.prNumber ? `pr #${log_5.prNumber} ${log_5.prRepository || ""}`.toLowerCase() : "";
        return displayedTitle.includes(query) || branch_0.includes(query) || tag.includes(query) || prInfo.includes(query);
      });

    t22 = t23;
  }
  const titleFilteredLogs = t22;
  const t23 = () => {
      if (false && deferredSearchQuery && deferredSearchQuery !== debouncedDeepSearchQuery) {
        setIsSearching(true);
      }
    };
  const t24 = [deferredSearchQuery, debouncedDeepSearchQuery, false];

  React.useEffect(t23, t24);
  const t25 = () => {
      if (true || !debouncedDeepSearchQuery || true) {
        setDeepSearchResults(null);
        setIsSearching(false);
        return;
      }
      const timeoutId_0 = setTimeout(_temp5, 0, null, debouncedDeepSearchQuery, setDeepSearchResults, setIsSearching);
      return () => {
        clearTimeout(timeoutId_0);
      };
    };
  const t26 = [debouncedDeepSearchQuery, null, false];

  React.useEffect(t25, t26);
  const snippetMap = new Map<LogOption, Snippet>();
  let filtered_0 = titleFilteredLogs;
  if (deepSearchResults && debouncedDeepSearchQuery && deepSearchResults.query === debouncedDeepSearchQuery) {
      for (const result of deepSearchResults.results) {
        if (result.searchableText) {
          const snippet = extractSnippet(result.searchableText, debouncedDeepSearchQuery, SNIPPET_CONTEXT_CHARS);
          if (snippet) {
            snippetMap.set(result.log, snippet);
          }
        }
      }
      const t27 = new Set(filtered_0.map(_temp6));

      const titleMatchIds = t27;
      const t29 = (log_7: LogOption) => !titleMatchIds.has(log_7.messages[0]?.uuid);

      const transcriptOnlyMatches = deepSearchResults.results.map(_temp7).filter(t29);
      const t28 = [...filtered_0, ...transcriptOnlyMatches];

      filtered_0 = t28;
    }

  const t27 = {
      filteredLogs: filtered_0,
      snippets: snippetMap
    };

  const {
    filteredLogs,
    snippets
  } = t27;
  let t28;
  bb1: {
    if (agenticSearchState.status === "results" && agenticSearchState.results.length > 0) {
      t28 = agenticSearchState.results;
      break bb1;
    }
    t28 = filteredLogs;
  }
  const displayedLogs = t28;
  const maxLabelWidth = Math.max(30, columns - 4);
  let t29;
  bb2: {
    if (!isResumeWithRenameEnabled) {
      const t30 = [];

      t29 = t30;
      break bb2;
    }
    const sessionGroups = groupLogsBySessionId(displayedLogs);
    const t30 = Array.from(sessionGroups.entries()).map(t31 => {
        const [sessionId, groupLogs] = t31;
        const latestLog = groupLogs[0];
        const indexInFiltered = displayedLogs.indexOf(latestLog);
        const snippet_0 = snippets.get(latestLog);
        const snippetStr = snippet_0 ? formatSnippet(snippet_0, highlightColor) : null;
        if (groupLogs.length === 1) {
          const metadata = buildLogMetadata(latestLog, {
            showProjectPath: showAllProjects
          });
          return {
            id: `log:${sessionId}:0`,
            value: {
              log: latestLog,
              indexInFiltered
            },
            label: buildLogLabel(latestLog, maxLabelWidth),
            description: snippetStr ? `${metadata}\n  ${snippetStr}` : metadata,
            dimDescription: true
          };
        }
        const forkCount = groupLogs.length - 1;
        const children = groupLogs.slice(1).map((log_8, index) => {
          const childIndexInFiltered = displayedLogs.indexOf(log_8);
          const childSnippet = snippets.get(log_8);
          const childSnippetStr = childSnippet ? formatSnippet(childSnippet, highlightColor) : null;
          const childMetadata = buildLogMetadata(log_8, {
            isChild: true,
            showProjectPath: showAllProjects
          });
          return {
            id: `log:${sessionId}:${index + 1}`,
            value: {
              log: log_8,
              indexInFiltered: childIndexInFiltered
            },
            label: buildLogLabel(log_8, maxLabelWidth, {
              isChild: true
            }),
            description: childSnippetStr ? `${childMetadata}\n      ${childSnippetStr}` : childMetadata,
            dimDescription: true
          };
        });
        const parentMetadata = buildLogMetadata(latestLog, {
          showProjectPath: showAllProjects
        });
        return {
          id: `group:${sessionId}`,
          value: {
            log: latestLog,
            indexInFiltered
          },
          label: buildLogLabel(latestLog, maxLabelWidth, {
            isGroupHeader: true,
            forkCount
          }),
          description: snippetStr ? `${parentMetadata}\n  ${snippetStr}` : parentMetadata,
          dimDescription: true,
          children
        };
      });

    t29 = t30;
  }
  const treeNodes = t29;
  let t30;
  bb3: {
    if (isResumeWithRenameEnabled) {
      const t31 = [];

      t30 = t31;
      break bb3;
    }
    const t32 = (log_9, index_0) => {
          const rawSummary = getLogDisplayTitle(log_9);
          const summaryWithSidechain = rawSummary + (log_9.isSidechain ? " (sidechain)" : "");
          const summary = normalizeAndTruncateToWidth(summaryWithSidechain, maxLabelWidth);
          const baseDescription = formatLogMetadata(log_9);
          const projectSuffix = showAllProjects && log_9.projectPath ? ` · ${log_9.projectPath}` : "";
          const snippet_1 = snippets.get(log_9);
          const snippetStr_0 = snippet_1 ? formatSnippet(snippet_1, highlightColor) : null;
          return {
            label: summary,
            description: snippetStr_0 ? `${baseDescription}${projectSuffix}\n  ${snippetStr_0}` : baseDescription + projectSuffix,
            dimDescription: true,
            value: index_0.toString()
          };
        };

    const t31 = displayedLogs.map(t32);

    t30 = t31;
  }
  const flatOptions = t30;
  const focusedLog = focusedNode?.value.log ?? null;
  const t31 = () => {
      if (!isResumeWithRenameEnabled || !focusedLog) {
        return "";
      }
      const sessionId_0 = getSessionIdFromLog(focusedLog);
      if (!sessionId_0) {
        return "";
      }
      const sessionLogs = displayedLogs.filter(log_10 => getSessionIdFromLog(log_10) === sessionId_0);
      const hasMultipleLogs = sessionLogs.length > 1;
      if (!hasMultipleLogs) {
        return "";
      }
      const isExpanded = expandedGroupSessionIds.has(sessionId_0);
      const isChildNode = sessionLogs.indexOf(focusedLog) > 0;
      if (isChildNode) {
        return "\u2190 to collapse";
      }
      return isExpanded ? "\u2190 to collapse" : "\u2192 to expand";
    };

  const getExpandCollapseHint = t31;
  const t32 = async () => {
      const sessionId_1 = focusedLog ? getSessionIdFromLog(focusedLog) : undefined;
      if (!focusedLog || !sessionId_1) {
        setViewMode("list");
        setRenameValue("");
        return;
      }
      if (renameValue.trim()) {
        await saveCustomTitle(sessionId_1, renameValue.trim(), focusedLog.fullPath);
        if (isResumeWithRenameEnabled && onLogsChanged) {
          onLogsChanged();
        }
      }
      setViewMode("list");
      setRenameValue("");
    };

  const handleRenameSubmit = t32;
  const t33 = () => {
      setViewMode("list");
      logEvent("tengu_session_search_toggled", {
        enabled: false
      });
    };

  const exitSearchMode = t33;
  const t34 = () => {
      setViewMode("search");
      logEvent("tengu_session_search_toggled", {
        enabled: true
      });
    };

  const enterSearchMode = t34;
  const t35 = async () => {
      if (!searchQuery.trim() || !onAgenticSearch || true) {
        return;
      }
      agenticSearchAbortRef.current?.abort();
      const abortController = new AbortController();
      agenticSearchAbortRef.current = abortController;
      setAgenticSearchState({
        status: "searching"
      });
      logEvent("tengu_agentic_search_started", {
        query_length: searchQuery.length
      });
      ;
      try {
        const results_0 = await onAgenticSearch(searchQuery, logs, abortController.signal);
        if (abortController.signal.aborted) {
          return;
        }
        setAgenticSearchState({
          status: "results",
          results: results_0,
          query: searchQuery
        });
        logEvent("tengu_agentic_search_completed", {
          query_length: searchQuery.length,
          results_count: results_0.length
        });
      } catch (t36) {
        const error = t36;
        if (abortController.signal.aborted) {
          return;
        }
        setAgenticSearchState({
          status: "error",
          message: error instanceof Error ? error.message : "Search failed"
        });
        logEvent("tengu_agentic_search_error", {
          query_length: searchQuery.length
        });
      }
    };

  const handleAgenticSearch = t35;
  const t36 = () => {
      if (agenticSearchState.status !== "idle" && agenticSearchState.status !== "searching") {
        if (agenticSearchState.status === "results" && agenticSearchState.query !== searchQuery || agenticSearchState.status === "error") {
          setAgenticSearchState({
            status: "idle"
          });
        }
      }
    };

  const t37 = [searchQuery, agenticSearchState];

  React.useEffect(t36, t37);
  const t38 = () => () => {
      agenticSearchAbortRef.current?.abort();
    };
  const t39 = [];

  React.useEffect(t38, t39);
  const prevAgenticStatusRef = React.useRef(agenticSearchState.status);
  const t40 = () => {
      const prevStatus = prevAgenticStatusRef.current;
      prevAgenticStatusRef.current = agenticSearchState.status;
      if (prevStatus === "searching" && agenticSearchState.status === "results") {
        if (isResumeWithRenameEnabled && treeNodes.length > 0) {
          setFocusedNode(treeNodes[0]);
        } else {
          if (!isResumeWithRenameEnabled && displayedLogs.length > 0) {
            const firstLog = displayedLogs[0];
            setFocusedNode({
              id: "0",
              value: {
                log: firstLog,
                indexInFiltered: 0
              },
              label: ""
            });
          }
        }
      }
    };

  const t41 = [agenticSearchState.status, isResumeWithRenameEnabled, treeNodes, displayedLogs];

  React.useEffect(t40, t41);
  const t42 = (value: string) => {
      const index_1 = parseInt(value, 10);
      const log_11 = displayedLogs[index_1];
      if (!log_11 || prevFocusedIdRef.current === index_1.toString()) {
        return;
      }
      prevFocusedIdRef.current = index_1.toString();
      setFocusedNode({
        id: index_1.toString(),
        value: {
          log: log_11,
          indexInFiltered: index_1
        },
        label: ""
      });
      setFocusedIndex(index_1 + 1);
    };

  const handleFlatOptionsSelectFocus = t42;
  const t43 = (node: LogTreeNode) => {
      setFocusedNode(node);
      const index_2 = displayedLogs.findIndex(log_12 => getSessionIdFromLog(log_12) === getSessionIdFromLog(node.value.log));
      if (index_2 >= 0) {
        setFocusedIndex(index_2 + 1);
      }
    };

  const handleTreeSelectFocus = t43;
  const t44 = () => {
      agenticSearchAbortRef.current?.abort();
      setAgenticSearchState({
        status: "idle"
      });
      logEvent("tengu_agentic_search_cancelled", {});
    };

  const t45 = viewMode !== "preview" && agenticSearchState.status === "searching";
  const t46 = {
      context: "Confirmation",
      isActive: t45
    };

  useKeybinding("confirm:no", t44, t46);
  const t47 = () => {
      setViewMode("list");
      setRenameValue("");
    };

  const t48 = viewMode === "rename" && agenticSearchState.status !== "searching";
  const t49 = {
      context: "Settings",
      isActive: t48
    };

  useKeybinding("confirm:no", t47, t49);
  const t50 = () => {
      setSearchQuery("");
      setIsAgenticSearchOptionFocused(false);
      onCancel?.();
    };

  const t51 = viewMode !== "preview" && viewMode !== "rename" && viewMode !== "search" && isAgenticSearchOptionFocused && agenticSearchState.status !== "searching";
  const t52 = {
      context: "Confirmation",
      isActive: t51
    };

  useKeybinding("confirm:no", t50, t52);
  const t53 = (input, key) => {
      if (viewMode === "preview") {
        return;
      }
      if (agenticSearchState.status === "searching") {
        return;
      }
      if (viewMode === "rename") {} else {
        if (viewMode === "search") {
          if (input.toLowerCase() === "n" && key.ctrl) {
            exitSearchMode();
          } else {
            if (key.return || key.downArrow) {
              if (searchQuery.trim() && onAgenticSearch && false && agenticSearchState.status !== "results") {
                setIsAgenticSearchOptionFocused(true);
              }
            }
          }
        } else {
          if (isAgenticSearchOptionFocused) {
            if (key.return) {
              handleAgenticSearch();
              setIsAgenticSearchOptionFocused(false);
              return;
            } else {
              if (key.downArrow) {
                setIsAgenticSearchOptionFocused(false);
                return;
              } else {
                if (key.upArrow) {
                  setViewMode("search");
                  setIsAgenticSearchOptionFocused(false);
                  return;
                }
              }
            }
          }
          if (hasTags && key.tab) {
            const offset = key.shift ? -1 : 1;
            setSelectedTagIndex(prev => {
              const current = prev < tagTabs.length ? prev : 0;
              const newIndex = (current + tagTabs.length + offset) % tagTabs.length;
              const newTab = tagTabs[newIndex];
              logEvent("tengu_session_tag_filter_changed", {
                is_all: newTab === "All",
                tag_count: uniqueTags.length
              });
              return newIndex;
            });
            return;
          }
          const keyIsNotCtrlOrMeta = !key.ctrl && !key.meta;
          const lowerInput = input.toLowerCase();
          if (lowerInput === "a" && key.ctrl && onToggleAllProjects) {
            onToggleAllProjects();
            logEvent("tengu_session_all_projects_toggled", {
              enabled: !showAllProjects
            });
          } else {
            if (lowerInput === "b" && key.ctrl) {
              const newEnabled = !branchFilterEnabled;
              setBranchFilterEnabled(newEnabled);
              logEvent("tengu_session_branch_filter_toggled", {
                enabled: newEnabled
              });
            } else {
              if (lowerInput === "w" && key.ctrl && hasMultipleWorktrees) {
                const newValue = !showAllWorktrees;
                setShowAllWorktrees(newValue);
                logEvent("tengu_session_worktree_filter_toggled", {
                  enabled: newValue
                });
              } else {
                if (lowerInput === "/" && keyIsNotCtrlOrMeta) {
                  setViewMode("search");
                  logEvent("tengu_session_search_toggled", {
                    enabled: true
                  });
                } else {
                  if (lowerInput === "r" && key.ctrl && focusedLog) {
                    setViewMode("rename");
                    setRenameValue("");
                    logEvent("tengu_session_rename_started", {});
                  } else {
                    if (lowerInput === "v" && key.ctrl && focusedLog) {
                      setPreviewLog(focusedLog);
                      setViewMode("preview");
                      logEvent("tengu_session_preview_opened", {
                        messageCount: focusedLog.messageCount
                      });
                    } else {
                      if (focusedLog && keyIsNotCtrlOrMeta && input.length > 0 && !/^\s+$/.test(input)) {
                        setViewMode("search");
                        setSearchQuery(input);
                        logEvent("tengu_session_search_toggled", {
                          enabled: true
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };

  const t54 = {
      isActive: true
    };

  useInput(t53, t54);
  const filterIndicators = [];
  if (branchFilterEnabled && currentBranch) {
      filterIndicators.push(currentBranch);
    }
  if (hasMultipleWorktrees && !showAllWorktrees) {
      filterIndicators.push("current worktree");
    }

  const showAdditionalFilterLine = filterIndicators.length > 0 && viewMode !== "search";
  const headerLines = 8 + (showAdditionalFilterLine ? 1 : 0) + tagTabsLines;
  const visibleCount = Math.max(1, Math.floor((maxHeight - headerLines - 2) / 3));
  const t55 = () => {
      if (!onLoadMore) {
        return;
      }
      const buffer = visibleCount * 2;
      if (focusedIndex + buffer >= displayedLogs.length) {
        onLoadMore(visibleCount * 3);
      }
    };
  const t56 = [focusedIndex, visibleCount, displayedLogs.length, onLoadMore];

  React.useEffect(t55, t56);
  if (logs.length === 0) {
    return null;
  }
  if (viewMode === "preview" && previewLog && isResumeWithRenameEnabled) {
    const t57 = () => {
        setViewMode("list");
        setPreviewLog(null);
      };

    const t58 = <SessionPreview log={previewLog} onExit={t57} onSelect={onSelect} />;

    return t58;
  }
  const t57 = maxHeight - 1;
  const t58 = <Box flexShrink={0}><Divider color="suggestion" /></Box>;

  const t59 = <Box flexShrink={0}><Text> </Text></Box>;

  const t60 = hasTags ? <TagTabs tabs={tagTabs} selectedIndex={effectiveTagIndex} availableWidth={columns} showAllProjects={showAllProjects} /> : <Box flexShrink={0}><Text bold={true} color="suggestion">Resume Session{viewMode === "list" && displayedLogs.length > visibleCount && <Text dimColor={true}>{" "}({focusedIndex} of {displayedLogs.length})</Text>}</Text></Box>;

  const t61 = viewMode === "search";
  const t62 = <SearchBox query={searchQuery} isFocused={t61} isTerminalFocused={isTerminalFocused} cursorOffset={searchCursorOffset} />;

  const t63 = filterIndicators.length > 0 && viewMode !== "search" && <Box flexShrink={0} paddingLeft={2}><Text dimColor={true}><Byline>{filterIndicators}</Byline></Text></Box>;

  const t64 = <Box flexShrink={0}><Text> </Text></Box>;

  const t65 = agenticSearchState.status === "searching" && <Box paddingLeft={1} flexShrink={0}><Spinner /><Text> Searching…</Text></Box>;

  const t66 = agenticSearchState.status === "results" && agenticSearchState.results.length > 0 && <Box paddingLeft={1} marginBottom={1} flexShrink={0}><Text dimColor={true} italic={true}>Gizzi found these results:</Text></Box>;

  const t67 = agenticSearchState.status === "results" && agenticSearchState.results.length === 0 && filteredLogs.length === 0 && <Box paddingLeft={1} marginBottom={1} flexShrink={0}><Text dimColor={true} italic={true}>No matching sessions found.</Text></Box>;

  const t68 = agenticSearchState.status === "error" && filteredLogs.length === 0 && <Box paddingLeft={1} marginBottom={1} flexShrink={0}><Text dimColor={true} italic={true}>No matching sessions found.</Text></Box>;

  const t69 = Boolean(searchQuery.trim()) && onAgenticSearch && false && agenticSearchState.status !== "searching" && agenticSearchState.status !== "results" && agenticSearchState.status !== "error" && <Box flexShrink={0} flexDirection="column"><Box flexDirection="row" gap={1}><Text color={isAgenticSearchOptionFocused ? "suggestion" : undefined}>{isAgenticSearchOptionFocused ? figures.pointer : " "}</Text><Text color={isAgenticSearchOptionFocused ? "suggestion" : undefined} bold={isAgenticSearchOptionFocused}>Search deeply using Gizzi →</Text></Box><Box height={1} /></Box>;

  const t70 = agenticSearchState.status === "searching" ? null : viewMode === "rename" && focusedLog ? <Box paddingLeft={2} flexDirection="column"><Text bold={true}>Rename session:</Text><Box paddingTop={1}><TextInput value={renameValue} onChange={setRenameValue} onSubmit={handleRenameSubmit} placeholder={getLogDisplayTitle(focusedLog, "Enter new session name")} columns={columns} cursorOffset={renameCursorOffset} onChangeCursorOffset={setRenameCursorOffset} showCursor={true} /></Box></Box> : isResumeWithRenameEnabled ? <TreeSelect nodes={treeNodes} onSelect={node_0 => {
      onSelect(node_0.value.log);
    }} onFocus={handleTreeSelectFocus} onCancel={onCancel} focusNodeId={focusedNode?.id} visibleOptionCount={visibleCount} layout="expanded" isDisabled={viewMode === "search" || isAgenticSearchOptionFocused} hideIndexes={false} isNodeExpanded={nodeId => {
      if (viewMode === "search" || branchFilterEnabled) {
        return true;
      }
      const sessionId_2 = typeof nodeId === "string" && nodeId.startsWith("group:") ? nodeId.substring(6) : null;
      return sessionId_2 ? expandedGroupSessionIds.has(sessionId_2) : false;
    }} onExpand={nodeId_0 => {
      const sessionId_3 = typeof nodeId_0 === "string" && nodeId_0.startsWith("group:") ? nodeId_0.substring(6) : null;
      if (sessionId_3) {
        setExpandedGroupSessionIds(prev_0 => new Set(prev_0).add(sessionId_3));
        logEvent("tengu_session_group_expanded", {});
      }
    }} onCollapse={nodeId_1 => {
      const sessionId_4 = typeof nodeId_1 === "string" && nodeId_1.startsWith("group:") ? nodeId_1.substring(6) : null;
      if (sessionId_4) {
        setExpandedGroupSessionIds(prev_1 => {
          const newSet = new Set(prev_1);
          newSet.delete(sessionId_4);
          return newSet;
        });
      }
    }} onUpFromFirstItem={enterSearchMode} /> : <Select options={flatOptions} onChange={value_0 => {
      const itemIndex = parseInt(value_0, 10);
      const log_13 = displayedLogs[itemIndex];
      if (log_13) {
        onSelect(log_13);
      }
    }} visibleOptionCount={visibleCount} onCancel={onCancel} onFocus={handleFlatOptionsSelectFocus} defaultFocusValue={focusedNode?.id.toString()} layout="expanded" isDisabled={viewMode === "search" || isAgenticSearchOptionFocused} onUpFromFirstItem={enterSearchMode} />;

  const t71 = <Box paddingLeft={2}>{exitState.pending ? <Text dimColor={true}>Press {exitState.keyName} again to exit</Text> : viewMode === "rename" ? <Text dimColor={true}><Byline><KeyboardShortcutHint shortcut="Enter" action="save" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text> : agenticSearchState.status === "searching" ? <Text dimColor={true}><Byline><Text>Searching with Gizzi…</Text><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text> : isAgenticSearchOptionFocused ? <Text dimColor={true}><Byline><KeyboardShortcutHint shortcut="Enter" action="search" /><KeyboardShortcutHint shortcut={"\u2193"} action="skip" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline></Text> : viewMode === "search" ? <Text dimColor={true}><Byline><Text>{isSearching && false ? "Searching\u2026" : "Type to Search"}</Text><KeyboardShortcutHint shortcut="Enter" action="select" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="clear" /></Byline></Text> : <Text dimColor={true}><Byline>{onToggleAllProjects && <KeyboardShortcutHint shortcut="Ctrl+A" action={`show ${showAllProjects ? "current dir" : "all projects"}`} />}{currentBranch && <KeyboardShortcutHint shortcut="Ctrl+B" action="toggle branch" />}{hasMultipleWorktrees && <KeyboardShortcutHint shortcut="Ctrl+W" action={`show ${showAllWorktrees ? "current worktree" : "all worktrees"}`} />}<KeyboardShortcutHint shortcut="Ctrl+V" action="preview" /><KeyboardShortcutHint shortcut="Ctrl+R" action="rename" /><Text>Type to search</Text><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" />{getExpandCollapseHint() && <Text>{getExpandCollapseHint()}</Text>}</Byline></Text>}</Box>;

  const t72 = <Box flexDirection="column" height={t57}>{t58}{t59}{t60}{t62}{t63}{t64}{t65}{t66}{t67}{t68}{t69}{t70}{t71}</Box>;

  return t72;
}

/**
 * Extracts searchable text content from a message.
 * Handles both string content and structured content blocks.
 */
function _temp7(r_0: DeepSearchResult) {
  return r_0.log;
}
function _temp6(log_6: LogOption) {
  return log_6.messages[0]?.uuid;
}
function _temp5(fuseIndex_0, debouncedDeepSearchQuery_0: string, setDeepSearchResults_0: (r: DeepSearchResults) => void, setIsSearching_0: (v: boolean) => void) {
  const results = fuseIndex_0.search(debouncedDeepSearchQuery_0);
  results.sort(_temp3);
  setDeepSearchResults_0({
    results: results.map(_temp4),
    query: debouncedDeepSearchQuery_0
  });
  setIsSearching_0(false);
}
function _temp4(r): DeepSearchResult {
  return {
    log: r.item.log,
    score: r.score,
    searchableText: r.item.searchableText
  };
}
function _temp3(a: { item: DeepSearchResult; score?: number }, b: { item: DeepSearchResult; score?: number }) {
  const aTime = new Date(a.item.log.modified).getTime();
  const bTime = new Date(b.item.log.modified).getTime();
  const timeDiff = bTime - aTime;
  if (Math.abs(timeDiff) > DATE_TIE_THRESHOLD_MS) {
    return timeDiff;
  }
  return (a.score ?? 1) - (b.score ?? 1);
}
function _temp2(log_1: LogOption) {
  const currentSessionId = getSessionId();
  const logSessionId = getSessionIdFromLog(log_1);
  const isCurrentSession = currentSessionId && logSessionId === currentSessionId;
  if (isCurrentSession) {
    return true;
  }
  if (log_1.customTitle) {
    return true;
  }
  const fromMessages = getFirstMeaningfulUserMessageTextContent(log_1.messages);
  if (fromMessages) {
    return true;
  }
  if (log_1.firstPrompt || log_1.customTitle) {
    return true;
  }
  return false;
}
function _temp(log: LogOption): [LogOption, string] {
  return [log, buildSearchableText(log)];
}
function extractSearchableText(message: SerializedMessage): string {
  // Only extract from user and assistant messages that have content
  if (message.type !== 'user' && message.type !== 'assistant') {
    return '';
  }
  const content = 'message' in message ? message.message?.content : undefined;
  if (!content) return '';

  // Handle string content (simple messages)
  if (typeof content === 'string') {
    return content;
  }

  // Handle array of content blocks
  if (Array.isArray(content)) {
    return content.map(block => {
      if (typeof block === 'string') return block;
      if ('text' in block && typeof block.text === 'string') return block.text;
      return '';
      // we don't return thinking blocks and tool names here;
      // they're not useful for search, as they can add noise to the fuzzy matching
    }).filter(Boolean).join(' ');
  }
  return '';
}

/**
 * Builds searchable text for a log including messages, titles, summaries, and metadata.
 * Crops long transcripts to first/last N messages for performance.
 */
function buildSearchableText(log: LogOption): string {
  const searchableMessages = log.messages.length <= DEEP_SEARCH_MAX_MESSAGES ? log.messages : [...log.messages.slice(0, DEEP_SEARCH_CROP_SIZE), ...log.messages.slice(-DEEP_SEARCH_CROP_SIZE)];
  const messageText = searchableMessages.map(extractSearchableText).filter(Boolean).join(' ');
  const metadata = [log.customTitle, log.summary, log.firstPrompt, log.gitBranch, log.tag, log.prNumber ? `PR #${log.prNumber}` : undefined, log.prRepository].filter(Boolean).join(' ');
  const fullText = `${metadata} ${messageText}`.trim();
  return fullText.length > DEEP_SEARCH_MAX_TEXT_LENGTH ? fullText.slice(0, DEEP_SEARCH_MAX_TEXT_LENGTH) : fullText;
}
function groupLogsBySessionId(filteredLogs: LogOption[]): Map<string, LogOption[]> {
  const groups = new Map<string, LogOption[]>();
  for (const log of filteredLogs) {
    const sessionId = getSessionIdFromLog(log);
    if (sessionId) {
      const existing = groups.get(sessionId);
      if (existing) {
        existing.push(log);
      } else {
        groups.set(sessionId, [log]);
      }
    }
  }

  // Sort logs within each group by modified date (newest first)
  groups.forEach(logs => logs.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()));
  return groups;
}

/**
 * Get unique tags from a list of logs, sorted alphabetically
 */
function getUniqueTags(logs: LogOption[]): string[] {
  const tags = new Set<string>();
  for (const log of logs) {
    if (log.tag) {
      tags.add(log.tag);
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}
