/**
 * Terminal Session Persistence
 * 
 * Saves and restores terminal sessions across page refreshes
 * - localStorage for session metadata
 * - Session snapshots for visual recovery
 * - Auto-restore on mount
 */

import { TerminalSession } from './terminal.service';

const STORAGE_KEY = 'allternit-terminal-sessions-v1';
const SNAPSHOT_KEY = 'allternit-terminal-snapshots-v1';

export interface PersistedSession {
  id: string;
  nodeId: string;
  shell: string;
  cols: number;
  rows: number;
  title: string;
  createdAt: string;
  lastActivity: string;
  snapshot?: string;
  panePath?: string[];
  profile?: string;
}

export interface SessionSnapshot {
  sessionId: string;
  snapshot: string;
  cols: number;
  rows: number;
  timestamp: string;
}

class TerminalPersistence {
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private snapshotDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Save sessions to localStorage
   */
  saveSessions(sessions: PersistedSession[]): void {
    if (typeof window === 'undefined') return;
    
    // Debounce saves
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    
    this.saveDebounceTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
      } catch (e) {
        console.warn('[TerminalPersistence] Failed to save sessions:', e);
      }
    }, 500);
  }

  /**
   * Load sessions from localStorage
   */
  loadSessions(): PersistedSession[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      
      const sessions = JSON.parse(stored) as PersistedSession[];
      
      // Filter out sessions older than 7 days
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const validSessions = sessions.filter(s => 
        new Date(s.lastActivity).getTime() > oneWeekAgo
      );
      
      // Clear if we filtered any
      if (validSessions.length !== sessions.length) {
        this.saveSessions(validSessions);
      }
      
      return validSessions;
    } catch (e) {
      console.warn('[TerminalPersistence] Failed to load sessions:', e);
      return [];
    }
  }

  /**
   * Save a terminal snapshot (visual output)
   */
  saveSnapshot(sessionId: string, snapshot: string, cols: number, rows: number): void {
    if (typeof window === 'undefined') return;
    
    // Debounce per session
    const existingTimer = this.snapshotDebounceTimers.get(sessionId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    const timer = setTimeout(() => {
      try {
        const snapshots = this.loadSnapshots();
        snapshots[sessionId] = {
          sessionId,
          snapshot: snapshot.slice(-5000), // Last 5000 chars only
          cols,
          rows,
          timestamp: new Date().toISOString(),
        };
        
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
        this.snapshotDebounceTimers.delete(sessionId);
      } catch (e) {
        console.warn('[TerminalPersistence] Failed to save snapshot:', e);
      }
    }, 2000);
    
    this.snapshotDebounceTimers.set(sessionId, timer);
  }

  /**
   * Load all snapshots
   */
  loadSnapshots(): Record<string, SessionSnapshot> {
    if (typeof window === 'undefined') return {};
    
    try {
      const stored = localStorage.getItem(SNAPSHOT_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  }

  /**
   * Get snapshot for specific session
   */
  getSnapshot(sessionId: string): SessionSnapshot | null {
    const snapshots = this.loadSnapshots();
    return snapshots[sessionId] || null;
  }

  /**
   * Remove session and its snapshot
   */
  removeSession(sessionId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Remove from sessions
      const sessions = this.loadSessions();
      const filtered = sessions.filter(s => s.id !== sessionId);
      this.saveSessions(filtered);
      
      // Remove snapshot
      const snapshots = this.loadSnapshots();
      delete snapshots[sessionId];
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
    } catch (e) {
      console.warn('[TerminalPersistence] Failed to remove session:', e);
    }
  }

  /**
   * Clear all persisted data
   */
  clearAll(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SNAPSHOT_KEY);
    } catch (e) {
      console.warn('[TerminalPersistence] Failed to clear:', e);
    }
  }

  /**
   * Generate a preview/thumbnail from snapshot
   */
  generatePreview(snapshot: string): string {
    // Extract last few lines for preview
    const lines = snapshot.split('\n').slice(-10);
    return lines.join('\n');
  }
}

export const terminalPersistence = new TerminalPersistence();
