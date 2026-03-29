// ============================================================================
// Phase 4: Layout Components
// ============================================================================
// ResponsiveContainer, DockPanel
// ============================================================================

"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  Sidebar,
  SidebarSimple,
  Rows,
} from '@phosphor-icons/react';

import type {
  ResponsiveContainerProps,
  DockPanelProps,
  RenderContext,
  AnimationConfig,
} from "../a2ui.types.extended";
import { isVisible } from "../A2UIRenderer";

// ============================================================================
// ResponsiveContainer Component
// ============================================================================

type BreakpointKey = "xs" | "sm" | "md" | "lg" | "xl";

const breakpointValues: Record<BreakpointKey, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export function ResponsiveContainerRenderer({
  props,
  context,
  children,
}: {
  props: ResponsiveContainerProps;
  context: RenderContext;
  children?: React.ReactNode;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const [currentBreakpoint, setCurrentBreakpoint] = useState<BreakpointKey>("xs");

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      if (width >= breakpointValues.xl) setCurrentBreakpoint("xl");
      else if (width >= breakpointValues.lg) setCurrentBreakpoint("lg");
      else if (width >= breakpointValues.md) setCurrentBreakpoint("md");
      else if (width >= breakpointValues.sm) setCurrentBreakpoint("sm");
      else setCurrentBreakpoint("xs");
    };

    updateBreakpoint();
    window.addEventListener("resize", updateBreakpoint);
    return () => window.removeEventListener("resize", updateBreakpoint);
  }, []);

  const getConfig = () => {
    // Check breakpoints in order: xl -> lg -> md -> sm -> xs
    const order: BreakpointKey[] = ["xl", "lg", "md", "sm", "xs"];
    const currentIndex = order.indexOf(currentBreakpoint);

    for (let i = currentIndex; i < order.length; i++) {
      const bp = order[i];
      if (props.breakpoints[bp]) {
        return props.breakpoints[bp];
      }
    }

    return null;
  };

  const config = getConfig();

  const direction = config?.direction || props.defaultDirection || "column";
  const gap = config?.gap || props.defaultGap || 16;

  return (
    <div
      className={cn(
        "flex w-full",
        direction === "row" ? "flex-row" : "flex-col"
      )}
      style={{ gap: typeof gap === "number" ? `${gap}px` : gap }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// DockPanel Component
// ============================================================================

export function DockPanelRenderer({
  props,
  context,
  children,
}: {
  props: DockPanelProps;
  context: RenderContext;
  children?: React.ReactNode;
}) {
  if (!isVisible(props, context.dataModel)) return null;

  const collapsedFromModel = typeof props.collapsed === "string"
    ? (context.dataModel[props.collapsed] as boolean)
    : props.collapsed;

  const [isCollapsed, setIsCollapsed] = useState(collapsedFromModel ?? false);
  const [size, setSize] = useState(props.size);
  const [isDragging, setIsDragging] = useState(false);

  const isHorizontal = props.position === "left" || props.position === "right";

  const handleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);

    if (newCollapsed && props.onCollapse) {
      context.onAction(props.onCollapse, {});
    } else if (!newCollapsed && props.onExpand) {
      context.onAction(props.onExpand, {});
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    if (!props.resizable || isCollapsed) return;
    e.preventDefault();
    setIsDragging(true);

    const startPos = isHorizontal ? e.clientX : e.clientY;
    const startSize = size;

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = isHorizontal ? e.clientX : e.clientY;
      const delta = currentPos - startPos;

      let newSize = startSize;
      if (props.position === "left" || props.position === "top") {
        newSize = startSize + delta;
      } else {
        newSize = startSize - delta;
      }

      // Apply min/max constraints
      newSize = Math.max(
        props.collapsedSize || 50,
        Math.min(newSize, 800)
      );

      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (props.onResize) {
        context.onAction(props.onResize, { size });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const getCollapseIcon = () => {
    switch (props.position) {
      case "left":
        return isCollapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />;
      case "right":
        return isCollapsed ? <CaretLeft size={16} /> : <CaretRight size={16} />;
      case "top":
        return isCollapsed ? <CaretDown size={16} /> : <CaretUp size={16} />;
      case "bottom":
        return isCollapsed ? <CaretUp size={16} /> : <CaretDown size={16} />;
    }
  };

  const getPositionIcon = () => {
    switch (props.position) {
      case "left":
        return <Sidebar size={16} />;
      case "right":
        return <SidebarSimple size={16} />;
      case "top":
        return <Rows size={16} />;
      case "bottom":
        return <Rows size={16} />;
    }
  };

  return (
    <motion.div
      className={cn(
        "flex bg-background border",
        isHorizontal ? "flex-row" : "flex-col",
        props.position === "left" && "border-r",
        props.position === "right" && "border-l",
        props.position === "top" && "border-b",
        props.position === "bottom" && "border-t"
      )}
      initial={false}
      animate={{
        width: isHorizontal ? (isCollapsed ? props.collapsedSize || 40 : size) : "100%",
        height: !isHorizontal ? (isCollapsed ? props.collapsedSize || 40 : size) : "100%",
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          {props.header && (
            <div
              className="flex items-center justify-between px-3 border-b"
              style={{ height: props.headerHeight || 40 }}
            >
              <div className="flex-1">{/* Header content */}</div>
              {props.collapsible && (
                <Button variant="ghost" size="icon" size={24} onClick={handleCollapse}>
                  {getCollapseIcon()}
                </Button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </div>
      )}

      {/* Collapsed state */}
      {isCollapsed && props.collapsible && (
        <div className="flex flex-col items-center py-2">
          <Button variant="ghost" size="icon" size={32} onClick={handleCollapse}>
            {getPositionIcon()}
          </Button>
        </div>
      )}

      {/* Resize handle */}
      {props.resizable && !isCollapsed && (
        <div
          className={cn(
            "bg-border hover:bg-primary/50 transition-colors",
            isHorizontal
              ? "w-1 cursor-col-resize"
              : "h-1 cursor-row-resize",
            isDragging && "bg-primary"
          )}
          onMouseDown={handleResizeStart}
        />
      )}
    </motion.div>
  );
}

// ============================================================================
// Animation Wrapper
// ============================================================================

interface AnimatedComponentProps {
  animation?: AnimationConfig;
  children: React.ReactNode;
}

export function AnimatedComponent({ animation, children }: AnimatedComponentProps) {
  if (!animation || animation.animateIn === "none") {
    return <>{children}</>;
  }

  const getInitialState = () => {
    switch (animation.animateIn) {
      case "fade":
        return { opacity: 0 };
      case "fadeUp":
        return { opacity: 0, y: 20 };
      case "fadeDown":
        return { opacity: 0, y: -20 };
      case "fadeLeft":
        return { opacity: 0, x: 20 };
      case "fadeRight":
        return { opacity: 0, x: -20 };
      case "scale":
        return { opacity: 0, scale: 0.8 };
      case "slideUp":
        return { y: 100 };
      case "slideDown":
        return { y: -100 };
      case "slideLeft":
        return { x: 100 };
      case "slideRight":
        return { x: -100 };
      default:
        return { opacity: 0 };
    }
  };

  const getFinalState = () => {
    switch (animation.animateIn) {
      case "fade":
      case "fadeUp":
      case "fadeDown":
      case "fadeLeft":
      case "fadeRight":
        return { opacity: 1, x: 0, y: 0 };
      case "scale":
        return { opacity: 1, scale: 1 };
      case "slideUp":
      case "slideDown":
        return { y: 0 };
      case "slideLeft":
      case "slideRight":
        return { x: 0 };
      default:
        return { opacity: 1 };
    }
  };

  return (
    <motion.div
      initial={getInitialState()}
      animate={getFinalState()}
      transition={{
        duration: (animation.duration || 300) / 1000,
        delay: (animation.delay || 0) / 1000,
        ease: (animation.easing || "easeOut") as unknown as [number, number, number, number],
      }}
    >
      {children}
    </motion.div>
  );
}
