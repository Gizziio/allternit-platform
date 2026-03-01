/**
 * ViewSkeleton - Loading placeholder for views
 * 
 * Used as a fallback for Suspense and lazy-loaded components.
 * Provides a consistent loading experience across the application.
 */

import React from 'react';

export interface ViewSkeletonProps {
  /** Number of skeleton lines to show */
  lines?: number;
  /** Show header skeleton */
  showHeader?: boolean;
  /** Custom className */
  className?: string;
  /** Height variant */
  variant?: 'default' | 'compact' | 'full';
}

/**
 * ViewSkeleton - Consistent loading state for views
 */
export function ViewSkeleton({
  lines = 4,
  showHeader = true,
  className = '',
  variant = 'default',
}: ViewSkeletonProps) {
  const baseClasses = 'animate-pulse bg-muted rounded';
  
  const variantClasses = {
    default: 'h-full flex flex-col p-4 space-y-4',
    compact: 'h-full flex flex-col p-2 space-y-2',
    full: 'h-screen w-full flex flex-col p-6 space-y-6',
  };

  return (
    <div className={`${variantClasses[variant]} ${className}`}>
      {showHeader && (
        <div className="flex items-center space-x-4">
          <div className={`${baseClasses} h-8 w-32`} />
          <div className={`${baseClasses} h-8 w-8 ml-auto`} />
        </div>
      )}
      
      <div className="flex-1 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${baseClasses} h-12 w-full`}
            style={{
              opacity: 1 - i * 0.15,
              width: `${100 - (i % 3) * 15}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Specialized Skeleton Components
// ============================================================================

/**
 * CardSkeleton - Loading state for card components
 */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 border rounded-lg bg-card ${className}`}>
      <div className="flex items-start space-x-4">
        <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
          <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * ListSkeleton - Loading state for list components
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50 animate-pulse"
        >
          <div className="h-10 w-10 rounded bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/4 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * MessageSkeleton - Loading state for chat messages
 */
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} p-4`}>
      <div className={`flex max-w-[80%] space-x-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
        <div className={`space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
          <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          <div className="h-20 w-64 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * CodeEditorSkeleton - Loading state for code editor
 */
export function CodeEditorSkeleton() {
  return (
    <div className="h-64 w-full bg-muted/30 rounded-lg border overflow-hidden">
      <div className="flex items-center px-4 py-2 bg-muted/50 border-b space-x-2">
        <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
        <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
        <div className="h-3 w-3 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-24 bg-muted rounded animate-pulse ml-4" />
      </div>
      <div className="p-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-4 bg-muted rounded animate-pulse"
            style={{ width: `${60 + Math.random() * 40}%`, marginLeft: `${(i % 3) * 20}px` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * TerminalSkeleton - Loading state for terminal component
 */
export function TerminalSkeleton() {
  return (
    <div className="h-48 w-full bg-black rounded-lg overflow-hidden">
      <div className="p-2 space-y-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-2">
            <div className="h-3 w-2 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 w-16 bg-muted/50 rounded animate-pulse" />
            <div className="h-3 flex-1 bg-muted/30 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="px-2 pb-2 flex items-center space-x-2">
        <div className="h-3 w-2 bg-green-500/50 rounded animate-pulse" />
        <div className="h-3 w-3 bg-muted/50 rounded animate-pulse" />
      </div>
    </div>
  );
}

/**
 * FormSkeleton - Loading state for forms
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        </div>
      ))}
      <div className="h-10 w-32 bg-muted rounded animate-pulse mt-6" />
    </div>
  );
}

/**
 * TableSkeleton - Loading state for tables
 */
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 py-3 bg-muted/50 border-b space-x-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-muted rounded animate-pulse flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex items-center px-4 py-3 space-x-4">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div
                key={colIdx}
                className="h-4 bg-muted rounded animate-pulse flex-1"
                style={{ opacity: 1 - colIdx * 0.15 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ImageSkeleton - Loading state for images
 */
export function ImageSkeleton({ aspectRatio = '16/9' }: { aspectRatio?: string }) {
  return (
    <div
      className="w-full bg-muted rounded-lg animate-pulse flex items-center justify-center"
      style={{ aspectRatio }}
    >
      <svg
        className="w-12 h-12 text-muted-foreground/30"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

/**
 * DashboardSkeleton - Loading state for dashboard views
 */
export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg bg-card">
            <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
            <div className="h-8 w-16 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
      
      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-muted rounded-lg animate-pulse" />
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
      
      {/* Bottom row */}
      <div className="h-48 bg-muted rounded-lg animate-pulse" />
    </div>
  );
}
