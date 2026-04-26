// ============================================================================
// Phase 2: Medium-Priority Components
// ============================================================================
// RichText, TreeView, SplitPane, Timeline
// ============================================================================

"use client";

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  TextHOne,
  TextHTwo,
  Code,
  Quotes,
  List,
  ListNumbers,
  Link,
  Image,
  Table,
  CaretRight,
  CaretDown,
  MagnifyingGlass,
  DotsSixVertical,
  Clock,
  CheckCircle,
  Warning,
  CircleNotch,
} from '@phosphor-icons/react';

import type {
  RichTextProps,
  TreeViewProps,
  TreeNode,
  SplitPaneProps,
  TimelineProps,
  TimelineItem,
  RenderContext,
} from "../a2ui.types.extended";
import { resolvePath, resolveValue, isVisible } from "../A2UIRenderer";

// ============================================================================
// RichText / MarkdownEditor Component
// ============================================================================

export function RichTextRenderer({
  props,
  context,
}: {
  props: RichTextProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const value = (resolvePath(context.dataModel, props.valuePath) as string) || "";
  const isDisabled = resolveValue(props.disabled, context.dataModel, false);

  const [content, setContent] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleChange = (newContent: string) => {
    setContent(newContent);
    context.updateDataModel(props.valuePath, newContent);
    if (props.onChange) {
      context.onAction(props.onChange, { value: newContent });
    }
  };

  const insertMarkdown = (before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText =
      content.substring(0, start) +
      before +
      selectedText +
      after +
      content.substring(end);

    handleChange(newText);

    // Restore selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const toolbarItems = props.toolbar || [
    "bold",
    "italic",
    "code",
    "unordered-list",
    "link",
  ];

  const toolbarButtons: Record<
    string,
    { icon: React.ReactNode; action: () => void; label: string }
  > = {
    bold: {
      icon: <TextB size={16} />,
      action: () => insertMarkdown("**", "**"),
      label: "Bold",
    },
    italic: {
      icon: <TextItalic size={16} />,
      action: () => insertMarkdown("*", "*"),
      label: "Italic",
    },
    underline: {
      icon: <TextUnderline size={16} />,
      action: () => insertMarkdown("<u>", "</u>"),
      label: "Underline",
    },
    strikethrough: {
      icon: <TextStrikethrough size={16} />,
      action: () => insertMarkdown("~~", "~~"),
      label: "Strikethrough",
    },
    heading: {
      icon: <TextHOne size={16} />,
      action: () => insertMarkdown("# ", ""),
      label: "Heading",
    },
    code: {
      icon: <Code size={16} />,
      action: () => insertMarkdown("`", "`"),
      label: "Code",
    },
    quote: {
      icon: <Quotes size={16} />,
      action: () => insertMarkdown("> ", ""),
      label: "Quote",
    },
    "unordered-list": {
      icon: <List size={16} />,
      action: () => insertMarkdown("- ", ""),
      label: "Unordered List",
    },
    "ordered-list": {
      icon: <ListNumbers size={16} />,
      action: () => insertMarkdown("1. ", ""),
      label: "Ordered List",
    },
    link: {
      icon: <Link size={16} />,
      action: () => insertMarkdown("[", "](url)"),
      label: "Link",
    },
    image: {
      icon: <Image size={16} />,
      action: () => insertMarkdown("![alt text](", ")"),
      label: "Image",
    },
    table: {
      icon: <Table size={16} />,
      action: () =>
        insertMarkdown(
          "| Header 1 | Header 2 |\\n|----------|----------|\\n| Cell 1 | Cell 2 |",
          ""
        ),
      label: "Table",
    },
  };

  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const charCount = content.length;

  return (
    <div className="space-y-1.5">
      {props.label && (
        <Label className="text-sm font-medium">{props.label}</Label>
      )}

      <div className="border rounded-lg overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/50">
          {toolbarItems.map((item) => {
            const button = toolbarButtons[item];
            if (!button) return null;
            return (
              <Button
                key={item}
                variant="ghost"
                size="icon"
                onClick={button.action}
                disabled={isDisabled}
                title={button.label}
              >
                {button.icon}
              </Button>
            );
          })}
        </div>

        {/* Editor */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={props.placeholder}
          disabled={isDisabled}
          className="w-full p-3 resize-none outline-none bg-transparent"
          style={{
            minHeight: props.minHeight || 150,
            maxHeight: props.maxHeight || 400,
          }}
        />

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <div>
            {props.mode === "markdown" ? "Markdown" : "Plain Text"} mode
          </div>
          <div className="flex items-center gap-4">
            {props.wordLimit && (
              <span className={wordCount > props.wordLimit ? "text-destructive" : ""}>
                {wordCount}/{props.wordLimit} words
              </span>
            )}
            {props.charLimit && (
              <span className={charCount > props.charLimit ? "text-destructive" : ""}>
                {charCount}/{props.charLimit} chars
              </span>
            )}
            {!props.wordLimit && !props.charLimit && (
              <span>{wordCount} words</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TreeView Component
// ============================================================================

function TreeNodeItem({
  node,
  level,
  expanded,
  selected,
  onToggle,
  onSelect,
  context,
  searchable,
  searchQuery,
}: {
  node: TreeNode;
  level: number;
  expanded: Set<string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string, node: TreeNode) => void;
  context: RenderContext;
  searchable: boolean;
  searchQuery: string;
}) {
  const isExpanded = expanded.has(node.id);
  const isSelected = selected.has(node.id);
  const hasChildren = node.children && node.children.length > 0;

  // Filter based on search
  if (searchable && searchQuery) {
    const matches = node.label.toLowerCase().includes(searchQuery.toLowerCase());
    const childMatches = node.children?.some((child) =>
      child.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (!matches && !childMatches) return null;
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 rounded cursor-pointer transition-colors",
          isSelected && "bg-primary/10 text-primary",
          !isSelected && "hover:bg-muted",
          node.disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => !node.disabled && onSelect(node.id, node)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="p-0.5 rounded hover:bg-muted"
          >
            {isExpanded ? (
              <CaretDown size={16} />
            ) : (
              <CaretRight size={16} />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {node.icon && <span className="text-muted-foreground">{node.icon}</span>}

        <span className="flex-1 truncate">{node.label}</span>

        {node.badge && (
          <span
            className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: node.badgeColor || "var(--muted)" }}
          >
            {node.badge}
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              expanded={expanded}
              selected={selected}
              onToggle={onToggle}
              onSelect={onSelect}
              context={context}
              searchable={searchable}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeViewRenderer({
  props,
  context,
}: {
  props: TreeViewProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const items = useMemo(() => {
    const rawItems = typeof props.items === "string"
      ? resolvePath(context.dataModel, props.items)
      : props.items;
    return (rawItems as TreeNode[]) || [];
  }, [props.items, context.dataModel]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Sync with data model if paths are provided
  const expandedFromModel = props.expandedPaths
    ? ((typeof props.expandedPaths === "string"
        ? resolvePath(context.dataModel, props.expandedPaths)
        : props.expandedPaths) as string[])
    : null;

  const selectionFromModel = props.selectionPath
    ? (resolvePath(context.dataModel, props.selectionPath) as string | string[])
    : null;

  useEffect(() => {
    if (expandedFromModel) {
      setExpanded(new Set(expandedFromModel));
    }
  }, [expandedFromModel]);

  useEffect(() => {
    if (selectionFromModel) {
      const selections = Array.isArray(selectionFromModel)
        ? selectionFromModel
        : [selectionFromModel];
      setSelected(new Set(selections));
    }
  }, [selectionFromModel]);

  const handleToggle = (id: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
      if (props.onCollapse) {
        context.onAction(props.onCollapse, { id });
      }
    } else {
      newExpanded.add(id);
      if (props.onExpand) {
        context.onAction(props.onExpand, { id });
      }
    }
    setExpanded(newExpanded);
  };

  const handleSelect = (id: string, node: TreeNode) => {
    if (props.multiSelect) {
      const newSelected = new Set(selected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelected(newSelected);
    } else {
      setSelected(new Set([id]));
    }

    if (props.onSelect) {
      context.onAction(props.onSelect, { id, node });
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {props.searchable && (
        <div className="p-2 border-b">
          <div className="relative">
            <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={props.searchPlaceholder || "Search..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      )}

      <div className="p-1 max-h-[400px] overflow-auto">
        {items.map((node) => (
          <TreeNodeItem
            key={node.id}
            node={node}
            level={0}
            expanded={expanded}
            selected={selected}
            onToggle={handleToggle}
            onSelect={handleSelect}
            context={context}
            searchable={props.searchable || false}
            searchQuery={searchQuery}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// SplitPane Component
// ============================================================================

export function SplitPaneRenderer({
  props,
  context,
}: {
  props: SplitPaneProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const [sizes, setSizes] = useState(props.sizes);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (index: number) => (e: React.MouseEvent) => {
    if (!props.resizable) return;
    e.preventDefault();
    setIsDragging(true);

    const startPos = props.direction === "horizontal" ? e.clientX : e.clientY;
    const startSizes = [...sizes];

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerSize =
        props.direction === "horizontal"
          ? containerRect.width
          : containerRect.height;

      const currentPos =
        props.direction === "horizontal" ? e.clientX : e.clientY;
      const delta = ((currentPos - startPos) / containerSize) * 100;

      const newSizes = [...startSizes];
      newSizes[index] = Math.max(10, Math.min(90, startSizes[index] + delta));
      newSizes[index + 1] = Math.max(10, Math.min(90, startSizes[index + 1] - delta));

      setSizes(newSizes);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (props.onResize) {
        context.onAction(props.onResize, { sizes: sizes });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-full h-full",
        props.direction === "vertical" && "flex-col"
      )}
    >
      {props.children.map((child, index) => (
        <React.Fragment key={index}>
          <div
            className="overflow-auto"
            style={{ flex: `0 0 ${sizes[index]}%` }}
          >
            {/* Child content would be rendered here by parent A2UIRenderer */}
          </div>

          {index < props.children.length - 1 && props.resizable && (
            <div
              className={cn(
                "bg-border hover:bg-primary/50 transition-colors cursor-col-resize",
                props.direction === "horizontal"
                  ? "w-1 cursor-col-resize"
                  : "h-1 cursor-row-resize",
                isDragging && "bg-primary"
              )}
              onMouseDown={handleMouseDown(index)}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ============================================================================
// Timeline Component
// ============================================================================

const statusIcons: Record<string, React.ReactNode> = {
  pending: <div className="w-3 h-3 rounded-full border-2 border-muted-foreground" />,
  active: <CircleNotch className="w-4 h-4 animate-spin text-primary" />,
  completed: <CheckCircle className="w-4 h-4 text-green-500" />,
  error: <Warning className="w-4 h-4 text-destructive" />,
  warning: <Warning className="w-4 h-4 text-yellow-500" />,
};

const statusColors: Record<string, string> = {
  pending: "var(--muted-foreground)",
  active: "var(--primary)",
  completed: "#22c55e",
  error: "var(--destructive)",
  warning: "#eab308",
};

export function TimelineRenderer({
  props,
  context,
}: {
  props: TimelineProps;
  context: RenderContext;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const items = useMemo(() => {
    const rawItems = typeof props.items === "string"
      ? resolvePath(context.dataModel, props.items)
      : props.items;
    let result = (rawItems as TimelineItem[]) || [];
    if (props.reverse) {
      result = [...result].reverse();
    }
    return result;
  }, [props.items, props.reverse, context.dataModel]);

  const isLoading = resolveValue(props.loading, context.dataModel, false);

  const handleItemClick = (item: TimelineItem) => {
    if (props.onItemClick) {
      context.onAction(props.onItemClick, { item });
    }
  };

  const isVertical = props.mode !== "horizontal";
  const alignment = props.alignment || "left";

  return (
    <div
      className={cn(
        "relative",
        isVertical ? "flex flex-col gap-4" : "flex flex-row gap-4"
      )}
    >
      {props.showConnectors !== false && (
        <div
          className={cn(
            "absolute bg-border",
            isVertical
              ? "left-4 top-0 bottom-0 w-0.5"
              : "top-4 left-0 right-0 h-0.5"
          )}
        />
      )}

      {items.map((item, index) => (
        <div
          key={item.id}
          className={cn(
            "relative flex",
            isVertical
              ? alignment === "alternate" && index % 2 === 1
                ? "flex-row-reverse"
                : "flex-row"
              : "flex-col items-center"
          )}
          onClick={() => handleItemClick(item)}
        >
          {/* Icon/Marker */}
          <div
            className={cn(
              "relative z-10 flex items-center justify-center w-8 h-8 rounded-full bg-background border-2",
              isVertical ? "mr-4" : "mb-2"
            )}
            style={{ borderColor: statusColors[item.status || "pending"] }}
          >
            {item.icon ? (
              <span>{item.icon}</span>
            ) : (
              statusIcons[item.status || "pending"]
            )}
          </div>

          {/* Content */}
          <Card
            className={cn(
              "flex-1 p-3 cursor-pointer hover:shadow-md transition-shadow",
              isVertical && alignment === "alternate" && index % 2 === 1
                ? "mr-4 text-right"
                : isVertical
                ? "ml-0"
                : "text-center"
            )}
          >
            <div className="text-sm font-medium">{item.title}</div>
            {item.description && (
              <div className="text-xs text-muted-foreground mt-1">
                {item.description}
              </div>
            )}
            {item.timestamp && (
              <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Clock size={12} />
                {format(parseISO(item.timestamp), "PPp")}
              </div>
            )}
            {item.actions && item.actions.length > 0 && (
              <div className="flex gap-2 mt-2">
                {item.actions.map((action, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      context.onAction(action.action, action.payload as Record<string, unknown>);
                    }}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        </div>
      ))}

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <CircleNotch className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading more...</span>
        </div>
      )}
    </div>
  );
}
