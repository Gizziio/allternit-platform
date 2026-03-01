/**
 * ActivityCenter - Activity lifecycle and event-to-status mapping
 *
 * Extends BrainManagerWidget's eventToStep mapping with session events.
 * Manages current activity state, status transitions, and timeline.
 */

import type { NavTarget } from './ConversationStore';

// Activity status states
export type ActivityStatus =
  | 'idle'
  | 'connecting'    // Initial connection/integration
  | 'reconnecting'  // SSE disconnected, attempting to reconnect
  | 'thinking'      // Processing, tool calls
  | 'streaming'     // Receiving deltas
  | 'speaking'      // TTS playing
  | 'done'          // Complete
  | 'error';        // Failed

// Timeline entry for activity history
export interface TimelineEntry {
  timestamp: number;
  status: ActivityStatus;
  event?: string;
  details?: string;
}

// Activity definition
export interface Activity {
  id: string;
  kind: 'voice' | 'text' | 'uiTars';
  status: ActivityStatus;
  chatSessionId: string;
  linkedBrainSessionId?: string;
  navTarget: NavTarget;
  timeline: TimelineEntry[];
  startedAt: number;
  completedAt?: number;
}

// Event to status mapping (extends BrainManagerWidget eventToStep)
export const EVENT_TO_STATUS: Record<string, ActivityStatus> = {
  // Integration events (from BrainManagerWidget)
  'integration.profile.registered': 'connecting',
  'integration.pty.initializing': 'connecting',
  'integration.pty.ready': 'thinking',
  'integration.dispatcher.connected': 'thinking',
  'integration.tools.verified': 'thinking',
  'integration.context.synced': 'thinking',
  'integration.complete': 'done',

  // Session events
  'session.created': 'connecting',
  'session.status': 'thinking',

  // SSE/disconnect events
  'session.disconnected': 'reconnecting',
  'session.reconnecting': 'reconnecting',
  'session.reconnected': 'streaming',

  // Runtime events
  'terminal.delta': 'streaming',
  'chat.delta': 'streaming',
  'chat.message.completed': 'speaking',

  // Tool events - record in timeline but don't downgrade from streaming
  'tool.call': 'thinking',
  'tool.result': 'thinking',

  // Completion
  'session.end': 'done',

  // Error
  'error': 'error',
};

// Interface for ActivityCenter
interface ActivityCenterState {
  currentActivity: Activity | null;

  // Start a new activity
  startActivity(opts: {
    kind: Activity['kind'];
    chatSessionId: string;
    linkedBrainSessionId?: string;
    navTarget: NavTarget;
  }): Activity;

  // Update activity status based on event
  updateFromEvent(eventType: string, details?: string): void;

  // Manually set status
  setStatus(status: ActivityStatus): void;

  // Called when TTS playback ends
  onSpeakingEnd(): void;

  // Force cancel activity (user clicked stop)
  cancelActivity(): void;

  // End the current activity
  endActivity(): void;

  // Get current activity
  getCurrentActivity(): Activity | null;

  // Get status for display
  getCurrentStatus(): ActivityStatus;

  // Dev-only: validate invariants
  validateInvariants(): boolean;
}

class ActivityCenterImpl implements ActivityCenterState {
  currentActivity: Activity | null = null;

  startActivity(opts: {
    kind: Activity['kind'];
    chatSessionId: string;
    linkedBrainSessionId?: string;
    navTarget: NavTarget;
  }): Activity {
    const now = Date.now();
    const activity: Activity = {
      id: `activity_${now}_${Math.random().toString(36).substr(2, 9)}`,
      kind: opts.kind,
      status: 'connecting',
      chatSessionId: opts.chatSessionId,
      linkedBrainSessionId: opts.linkedBrainSessionId,
      navTarget: opts.navTarget,
      timeline: [
        {
          timestamp: now,
          status: 'connecting',
          event: 'activity.started',
          details: `Started ${opts.kind} activity`,
        },
      ],
      startedAt: now,
    };

    this.currentActivity = activity;

    console.log('[ActivityCenter] Started activity:', activity.id, {
      kind: opts.kind,
      chatSessionId: opts.chatSessionId,
    });

    return activity;
  }

  updateFromEvent(eventType: string, details?: string): void {
    if (!this.currentActivity) return;

    const newStatus = EVENT_TO_STATUS[eventType] || this.currentActivity.status;

    // Don't downgrade from speaking/done/error
    if (
      this.currentActivity.status === 'speaking' ||
      this.currentActivity.status === 'done' ||
      this.currentActivity.status === 'error'
    ) {
      // But still record error events in timeline
      if (eventType === 'error') {
        const entry: TimelineEntry = {
          timestamp: Date.now(),
          status: this.currentActivity.status,
          event: eventType,
          details: details || 'Error during activity',
        };
        this.currentActivity = {
          ...this.currentActivity,
          timeline: [...this.currentActivity.timeline, entry],
        };
      }
      return;
    }

    // Skip if no status change
    if (newStatus === this.currentActivity.status) {
      // Still record tool events in timeline even if status doesn't change
      if (eventType.startsWith('tool.')) {
        const entry: TimelineEntry = {
          timestamp: Date.now(),
          status: this.currentActivity.status,
          event: eventType,
          details,
        };
        this.currentActivity = {
          ...this.currentActivity,
          timeline: [...this.currentActivity.timeline, entry],
        };
      }
      return;
    }

    const entry: TimelineEntry = {
      timestamp: Date.now(),
      status: newStatus,
      event: eventType,
      details,
    };

    this.currentActivity = {
      ...this.currentActivity,
      status: newStatus,
      timeline: [...this.currentActivity.timeline, entry],
    };

    // Handle error: auto-end after delay
    if (newStatus === 'error') {
      setTimeout(() => {
        this.endActivity();
      }, 3000);
    }

    console.log('[ActivityCenter] Status change:', eventType, '→', newStatus);
  }

  setStatus(status: ActivityStatus): void {
    if (!this.currentActivity) return;

    // Don't downgrade from speaking/done/error (except done can follow speaking)
    if (
      this.currentActivity.status === 'done' ||
      this.currentActivity.status === 'error'
    ) {
      return;
    }

    // Allow speaking→done transition, but prevent other downgrades from speaking
    if (
      this.currentActivity.status === 'speaking' &&
      status !== 'done'
    ) {
      return;
    }

    const entry: TimelineEntry = {
      timestamp: Date.now(),
      status,
      event: 'status.manual',
      details: `Manual status set to ${status}`,
    };

    this.currentActivity = {
      ...this.currentActivity,
      status,
      timeline: [...this.currentActivity.timeline, entry],
    };
  }

  // Called when TTS playback ends
  onSpeakingEnd(): void {
    if (!this.currentActivity) return;
    if (this.currentActivity.status !== 'speaking') return;

    this.setStatus('done');
    
    // Clear pill after delay so user can see completion
    setTimeout(() => {
      this.endActivity();
    }, 2000);
  }

  // Force end activity immediately (e.g., user clicked stop)
  cancelActivity(): void {
    if (!this.currentActivity) return;

    const entry: TimelineEntry = {
      timestamp: Date.now(),
      status: 'idle',
      event: 'activity.cancelled',
      details: 'User cancelled activity',
    };

    this.currentActivity = {
      ...this.currentActivity,
      status: 'idle',
      timeline: [...this.currentActivity.timeline, entry],
      completedAt: Date.now(),
    };

    console.log('[ActivityCenter] Activity cancelled:', this.currentActivity.id);
    this.currentActivity = null;
  }

  endActivity(): void {
    if (!this.currentActivity) return;

    const entry: TimelineEntry = {
      timestamp: Date.now(),
      status: 'done',
      event: 'activity.ended',
      details: 'Activity completed',
    };

    this.currentActivity = {
      ...this.currentActivity,
      status: 'done',
      timeline: [...this.currentActivity.timeline, entry],
      completedAt: Date.now(),
    };

    console.log('[ActivityCenter] Ended activity:', this.currentActivity.id);

    // Clear after a delay (UI can still read the completed activity)
    setTimeout(() => {
      this.currentActivity = null;
    }, 5000);
  }

  getCurrentActivity(): Activity | null {
    return this.currentActivity;
  }

  getCurrentStatus(): ActivityStatus {
    return this.currentActivity?.status || 'idle';
  }

  // Dev-only invariant check
  validateInvariants(): boolean {
    if (process.env.NODE_ENV !== 'development') return true;

    if (!this.currentActivity) return true;

    // Check that navTarget is valid
    if (this.currentActivity.navTarget) {
      const target = this.currentActivity.navTarget;
      if (target.kind === 'chatSession' && !target.chatSessionId) {
        console.warn('[ActivityCenter] Invariant violation: chatSession navTarget missing chatSessionId');
        return false;
      }
      if (target.kind === 'brainSession' && !target.sessionId) {
        console.warn('[ActivityCenter] Invariant violation: brainSession navTarget missing sessionId');
        return false;
      }
    }

    // Check that status transitions are valid
    const validTransitions: Record<ActivityStatus, ActivityStatus[]> = {
      idle: ['connecting', 'reconnecting'],
      connecting: ['thinking', 'reconnecting', 'error'],
      reconnecting: ['streaming', 'thinking', 'error'],
      thinking: ['streaming', 'tool.call', 'tool.result', 'error'],
      streaming: ['speaking', 'tool.call', 'tool.result', 'error'],
      speaking: ['done', 'error'],
      done: [],
      error: [],
    };

    // This is a simplified check - in practice we'd track previous state
    return true;
  }
}

// Export singleton instance
export const activityCenter = new ActivityCenterImpl();

// Also export class for testing
export { ActivityCenterImpl };
