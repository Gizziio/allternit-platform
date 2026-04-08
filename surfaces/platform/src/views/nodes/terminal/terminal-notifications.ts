/**
 * Terminal Notifications
 * 
 * Desktop notifications for terminal events
 * - Long-running command completion
 * - Error alerts
 * - Custom notifications
 */

import { TerminalSession } from './terminal.service';

interface NotificationPermission {
  granted: boolean;
}

interface CommandTracker {
  command: string;
  startTime: number;
  notified: boolean;
}

class TerminalNotifications {
  private permission: NotificationPermission = { granted: false };
  private commandTrackers = new Map<string, CommandTracker>();
  private longRunningThreshold = 10000; // 10 seconds
  private soundEnabled = false;

  constructor() {
    this.checkPermission();
  }

  /**
   * Check and request notification permission
   */
  async checkPermission(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    
    if (Notification.permission === 'granted') {
      this.permission.granted = true;
      return true;
    }
    
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      this.permission.granted = result === 'granted';
      return this.permission.granted;
    }
    
    return false;
  }

  /**
   * Track command start
   */
  trackCommand(sessionId: string, command: string): void {
    this.commandTrackers.set(sessionId, {
      command,
      startTime: Date.now(),
      notified: false,
    });
  }

  /**
   * Mark command complete and notify if long-running
   */
  commandComplete(sessionId: string, exitCode: number): void {
    const tracker = this.commandTrackers.get(sessionId);
    if (!tracker) return;
    
    const duration = Date.now() - tracker.startTime;
    this.commandTrackers.delete(sessionId);
    
    // Notify if long-running
    if (duration > this.longRunningThreshold && !tracker.notified) {
      const title = exitCode === 0 
        ? `✅ Command Complete` 
        : `❌ Command Failed`;
      
      const body = `"${tracker.command.slice(0, 50)}${tracker.command.length > 50 ? '...' : ''}" ${exitCode === 0 ? 'finished' : `exited with code ${exitCode}`} in ${this.formatDuration(duration)}`;
      
      this.show(title, body);
      this.playSound(exitCode === 0 ? 'success' : 'error');
    }
  }

  /**
   * Show notification
   */
  show(title: string, body: string, options?: NotificationOptions): void {
    if (!this.permission.granted || typeof window === 'undefined') return;
    
    try {
      new Notification(title, {
        body,
        icon: '/terminal-icon.png',
        badge: '/terminal-badge.png',
        tag: 'terminal-notification',
        requireInteraction: false,
        ...options,
      });
    } catch (e) {
      console.warn('[TerminalNotifications] Failed to show:', e);
    }
  }

  /**
   * Notify on error
   */
  error(sessionId: string, error: string): void {
    this.show(
      'Terminal Error',
      error.slice(0, 100),
      { requireInteraction: true }
    );
    this.playSound('error');
  }

  /**
   * Notify session disconnected
   */
  disconnected(sessionTitle: string): void {
    this.show(
      'Terminal Disconnected',
      `"${sessionTitle}" session was disconnected`
    );
  }

  /**
   * Play sound effect
   */
  playSound(type: 'success' | 'error' | 'notification'): void {
    if (!this.soundEnabled || typeof window === 'undefined') return;
    
    try {
      const audio = new Audio();
      audio.src = type === 'success' 
        ? '/sounds/success.mp3' 
        : type === 'error' 
          ? '/sounds/error.mp3' 
          : '/sounds/notification.mp3';
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }
  }

  /**
   * Enable/disable sound
   */
  setSoundEnabled(enabled: boolean): void {
    this.soundEnabled = enabled;
  }

  /**
   * Set long-running threshold
   */
  setThreshold(ms: number): void {
    this.longRunningThreshold = ms;
  }

  /**
   * Format duration
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }
}

export const terminalNotifications = new TerminalNotifications();
