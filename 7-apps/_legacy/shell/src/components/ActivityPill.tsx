import * as React from 'react';
import { activityCenter, type ActivityStatus } from '../runtime/ActivityCenter';
import { voiceService } from '../runtime/VoiceService';

// Status to display text mapping
const STATUS_LABELS: Record<ActivityStatus, string> = {
  idle: '',
  connecting: 'Connecting...',
  reconnecting: 'Reconnecting...',
  thinking: 'Thinking...',
  streaming: 'Streaming...',
  speaking: 'Speaking...',
  done: 'Open chat',
  error: 'Error',
};

// Status to color mapping
const STATUS_COLORS: Record<ActivityStatus, string> = {
  idle: 'transparent',
  connecting: '#f59e0b', // amber
  reconnecting: '#f97316', // orange
  thinking: '#3b82f6',   // blue
  streaming: '#8b5cf6',  // purple
  speaking: '#10b981',   // green
  done: '#6b7280',       // gray
  error: '#ef4444',      // red
};

// Click action labels based on nav target
const getActionLabel = (navTarget: any, status: ActivityStatus): string => {
  if (status === 'done' || status === 'error') {
    return 'Open';
  }
  if (navTarget?.kind === 'chatSession') {
    return 'Go to chat';
  }
  if (navTarget?.kind === 'brainSession') {
    return 'Open console';
  }
  return 'View';
};

// Status to icon mapping
const STATUS_ICONS: Record<ActivityStatus, React.ReactNode> = {
  idle: null,
  connecting: (
    <svg className="activity-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" className="spinner-path" />
    </svg>
  ),
  reconnecting: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  thinking: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  ),
  streaming: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  speaking: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  done: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

export const ActivityPill: React.FC = () => {
  const [activity, setActivity] = React.useState(activityCenter.getCurrentActivity());
  const [status, setStatus] = React.useState<ActivityStatus>('idle');
  const [isHovered, setIsHovered] = React.useState(false);
  const [showStopButton, setShowStopButton] = React.useState(false);

  // Poll for activity changes (since ActivityCenter is a singleton without subscription)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const current = activityCenter.getCurrentActivity();
      const currentStatus = activityCenter.getCurrentStatus();
      setActivity(current);
      setStatus(currentStatus);
      
      // Show stop button only during speaking
      setShowStopButton(currentStatus === 'speaking');
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Don't render if idle
  if (status === 'idle' || !activity) {
    return null;
  }

  const handleClick = () => {
    if (status === 'speaking' && showStopButton) {
      // Stop button handles its own click
      return;
    }
    if (activity.navTarget) {
      // DEV ASSERT: Validate navTarget before dispatching
      if (process.env.NODE_ENV === 'development') {
        if (activity.navTarget.kind === 'chatSession' && !activity.navTarget.chatSessionId) {
          console.error('[ActivityPill] Dev invariant violation: chatSession navTarget missing chatSessionId');
          return;
        }
        if (activity.navTarget.kind === 'brainSession' && !activity.navTarget.sessionId) {
          console.error('[ActivityPill] Dev invariant violation: brainSession navTarget missing sessionId');
          return;
        }
      }

      window.dispatchEvent(new CustomEvent('navigateToTarget', {
        detail: activity.navTarget,
      }));
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    voiceService.stopAudio();
    activityCenter.cancelActivity();
  };

  const label = STATUS_LABELS[status];
  const color = STATUS_COLORS[status];
  const Icon = STATUS_ICONS[status];
  const actionLabel = getActionLabel(activity.navTarget, status);

  return (
    <div
      className="activity-pill-container"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
      }}
    >
      {/* Stop button - appears during speaking */}
      {showStopButton && (
        <button
          onClick={handleStop}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            padding: '8px 16px',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
            opacity: showStopButton ? 1 : 0,
            transform: showStopButton ? 'scale(1)' : 'scale(0.8)',
            transition: 'all 0.2s ease',
          }}
        >
          Stop
        </button>
      )}

      {/* Main pill */}
      <button
        className="activity-pill"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 18px',
          background: 'rgba(255, 255, 255, 0.95)',
          border: `1px solid ${color}60`,
          borderRadius: '24px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          color: '#374151',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(8px)',
          transform: isHovered ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        title={activity.navTarget?.kind === 'chatSession' 
          ? `Go to chat session: ${activity.chatSessionId}` 
          : 'Click to view activity'}
      >
        <span style={{ color, display: 'flex', alignItems: 'center' }}>
          {Icon}
        </span>
        <span style={{ 
          color: status === 'error' ? color : '#374151',
          fontWeight: 500,
        }}>
          {label}
        </span>
        {/* Streaming indicator */}
        {status === 'streaming' && (
          <span 
            className="streaming-indicator"
            style={{ 
              marginLeft: '2px',
              animation: 'pulse 1s infinite',
            }}
          >
            ▌
          </span>
        )}
        {/* Action hint on hover */}
        {(status === 'done' || status === 'error') && isHovered && (
          <span style={{ 
            marginLeft: '4px', 
            opacity: 0.6,
            fontSize: '11px',
          }}>
            → {actionLabel}
          </span>
        )}
      </button>
    </div>
  );
};

// Add streaming animation styles
const streamingStyles = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
  .spinner-path {
    transform-origin: center;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'activity-pill-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = streamingStyles;
    document.head.appendChild(style);
  }
}

export default ActivityPill;
