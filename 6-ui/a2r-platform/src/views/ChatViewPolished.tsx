"use client";

/**
 * ChatViewPolished - Enhanced ChatView with production-ready polish
 * 
 * Features:
 * - Consistent spacing using CSS variables
 * - Loading states for all async operations
 * - Error boundaries and graceful error handling
 * - Smooth scroll behavior
 * - Improved visual hierarchy
 * - Dark mode support
 * - Micro-interactions and animations
 */

import React, { Suspense, lazy } from "react";
import { ErrorBoundary, ChatViewErrorBoundary } from "@/components/error-boundary";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import { MessageSquare, AlertCircle, WifiOff } from "lucide-react";

// Lazy load the main ChatView for code splitting
const ChatViewLazy = lazy(() => import("./ChatView"));

// ============================================================================
// Loading States
// ============================================================================

/**
 * ChatViewLoading - Full loading state for ChatView
 */
function ChatViewLoading() {
  return (
    <div 
      className="flex flex-col h-full w-full animate-fade-in"
      role="status"
      aria-label="Loading chat..."
    >
      {/* Messages Skeleton */}
      <div className="flex-1 overflow-hidden p-[var(--space-4)]">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Welcome/Empty State Skeleton */}
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Skeleton variant="rounded" width={80} height={80} />
            <Skeleton variant="text" width={200} height={24} />
            <Skeleton variant="text" width={280} height={16} />
          </div>
          
          {/* Example Messages */}
          <div className="space-y-6">
            <Skeleton.ChatMessage isUser={false} />
            <Skeleton.ChatMessage isUser={true} />
            <Skeleton.ChatMessage isUser={false} />
          </div>
        </div>
      </div>
      
      {/* Input Bar Skeleton */}
      <div 
        className="p-[var(--space-4)] border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="max-w-3xl mx-auto">
          <Skeleton.InputBar />
        </div>
      </div>
    </div>
  );
}

/**
 * ChatViewError - Error state when ChatView fails to load
 */
function ChatViewError({ error, onReset }: { error?: Error; onReset?: () => void }) {
  return (
    <div 
      className="flex flex-col items-center justify-center h-full p-8 animate-fade-in"
      role="alert"
      aria-live="assertive"
    >
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--status-error-bg)' }}
      >
        <AlertCircle className="w-8 h-8 text-[var(--status-error)]" />
      </div>
      
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        Failed to load chat
      </h2>
      
      <p className="text-sm text-[var(--text-secondary)] text-center max-w-md mb-6">
        {error?.message || "We couldn't load the chat interface. Please try again."}
      </p>
      
      <div className="flex items-center gap-3">
        {onReset && (
          <button
            onClick={onReset}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl",
              "text-sm font-medium text-white",
              "bg-[var(--status-error)] hover:bg-[var(--status-error)]/90",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[var(--status-error)]/50"
            )}
          >
            Try Again
          </button>
        )}
        
        <button
          onClick={() => window.location.reload()}
          className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-xl",
            "text-sm font-medium text-[var(--text-primary)]",
            "bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)]",
            "border border-[var(--border-default)]",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-[var(--accent-chat)]/50"
          )}
        >
          Reload Page
        </button>
      </div>
    </div>
  );
}

/**
 * NoConnectionState - Shown when there's no internet connection
 */
function NoConnectionState() {
  return (
    <div 
      className="flex flex-col items-center justify-center h-full p-8 animate-fade-in"
      role="alert"
    >
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: 'var(--status-warning-bg)' }}
      >
        <WifiOff className="w-8 h-8 text-[var(--status-warning)]" />
      </div>
      
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        No connection
      </h2>
      
      <p className="text-sm text-[var(--text-secondary)] text-center max-w-md">
        Please check your internet connection and try again.
      </p>
    </div>
  );
}

/**
 * EmptyChatState - Enhanced empty state for new chats
 */
function EmptyChatState({ onStart }: { onStart?: () => void }) {
  const categories = [
    { icon: "✨", label: "Create", description: "Documents, emails, proposals" },
    { icon: "📊", label: "Analyze", description: "Data, code, text" },
    { icon: "💻", label: "Code", description: "Functions, debugging, tests" },
    { icon: "🎓", label: "Learn", description: "Concepts, guides, summaries" },
  ];

  return (
    <div 
      className="flex flex-col items-center justify-center h-full p-8 animate-slide-up"
      role="status"
      aria-label="Start a conversation"
    >
      {/* Logo/Icon */}
      <div 
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{ 
          background: 'linear-gradient(135deg, var(--sand-300) 0%, var(--sand-500) 100%)',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        <MessageSquare className="w-10 h-10 text-white" />
      </div>
      
      {/* Title */}
      <h1 
        className="text-2xl font-bold text-[var(--text-primary)] mb-2 text-center"
        style={{ fontFamily: 'var(--font-sans)' }}
      >
        How can I help you today?
      </h1>
      
      {/* Description */}
      <p className="text-[var(--text-secondary)] text-center max-w-md mb-8">
        Start a conversation or choose a category below to get started
      </p>
      
      {/* Category Grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        {categories.map((cat) => (
          <button
            key={cat.label}
            onClick={onStart}
            className={cn(
              "flex flex-col items-start p-4 rounded-xl text-left",
              "bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)]",
              "border border-[var(--border-subtle)] hover:border-[var(--border-default)]",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-[var(--accent-chat)]/50"
            )}
          >
            <span className="text-2xl mb-2">{cat.icon}</span>
            <span className="font-semibold text-[var(--text-primary)] text-sm">
              {cat.label}
            </span>
            <span className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {cat.description}
            </span>
          </button>
        ))}
      </div>
      
      {/* Keyboard Shortcut Hint */}
      <div className="mt-8 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <span>Press</span>
        <kbd 
          className="px-1.5 py-0.5 rounded font-mono text-[10px]"
          style={{ background: 'var(--bg-secondary)' }}
        >
          /
        </kbd>
        <span>to focus input</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ChatViewPolishedProps {
  mode?: 'chat' | 'cowork' | 'code';
  className?: string;
}

/**
 * ChatViewPolished - Production-ready chat interface
 * 
 * Wraps ChatView with:
 * - Loading states
 * - Error boundaries
 * - Connection handling
 * - Smooth transitions
 */
export function ChatViewPolished({ mode = 'chat', className }: ChatViewPolishedProps) {
  const [isOnline, setIsOnline] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  // Monitor online status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleError = React.useCallback((err: Error) => {
    setHasError(true);
    setError(err);
  }, []);

  const handleReset = React.useCallback(() => {
    setHasError(false);
    setError(null);
  }, []);

  // Show offline state
  if (!isOnline) {
    return <NoConnectionState />;
  }

  return (
    <div 
      className={cn(
        "flex flex-col h-full w-full",
        className
      )}
    >
      <ChatViewErrorBoundary>
        <ErrorBoundary
          componentName="ChatView"
          onError={handleError}
          onReset={handleReset}
          fallback={hasError ? <ChatViewError error={error || undefined} onReset={handleReset} /> : undefined}
        >
          <Suspense fallback={<ChatViewLoading />}>
            <ChatViewLazy mode={mode} />
          </Suspense>
        </ErrorBoundary>
      </ChatViewErrorBoundary>
    </div>
  );
}

// ============================================================================
// Message Loading Components (for inline use)
// ============================================================================

/**
 * MessageLoading - Inline loading for a single message
 */
export function MessageLoading({ isUser = false }: { isUser?: boolean }) {
  return (
    <div 
      className={cn(
        "flex gap-3 p-4 animate-pulse",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Skeleton variant="avatar" width={32} height={32} />
      <div className={cn(
        "flex-1 space-y-2",
        isUser ? "max-w-[80%] ml-auto" : "max-w-[80%]"
      )}>
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="60%" />
      </div>
    </div>
  );
}

/**
 * TypingIndicator - "AI is typing" indicator
 */
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 p-4">
      <div 
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <SparkleIcon />
      </div>
      <div className="flex items-center gap-1">
        <LoadingSpinner.Dots size="sm" variant="muted" />
        <span className="text-xs text-[var(--text-tertiary)] ml-2">
          Thinking...
        </span>
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
      strokeLinecap="round" 
      strokeLinejoin="round"
      className="text-[var(--accent-chat)]"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

// ============================================================================
// Export
// ============================================================================

export default ChatViewPolished;
