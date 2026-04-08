/**
 * Terminal Command History
 * 
 * Global command history across all terminals
 * - Persisted to localStorage
 * - Fuzzy search
 * - Favorites/bookmarks
 * - Per-directory history
 */

const HISTORY_KEY = 'allternit-terminal-history-v1';
const FAVORITES_KEY = 'allternit-terminal-favorites-v1';
const MAX_HISTORY = 1000;

export interface HistoryEntry {
  id: string;
  command: string;
  cwd: string;
  timestamp: string;
  exitCode?: number;
  duration?: number;
}

export interface FavoriteCommand {
  id: string;
  command: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
}

class TerminalHistory {
  /**
   * Add command to history
   */
  add(command: string, cwd: string, exitCode?: number, duration?: number): void {
    if (typeof window === 'undefined') return;
    if (!command.trim() || command.trim().length < 2) return;
    
    // Skip common noise commands
    const skipPatterns = ['ls', 'pwd', 'clear', 'exit', 'cd', 'echo $'];
    if (skipPatterns.some(p => command.trim().startsWith(p))) return;

    try {
      const history = this.load();
      const entry: HistoryEntry = {
        id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        command: command.trim(),
        cwd,
        timestamp: new Date().toISOString(),
        exitCode,
        duration,
      };
      
      // Add to beginning, limit size
      history.unshift(entry);
      if (history.length > MAX_HISTORY) {
        history.pop();
      }
      
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.warn('[TerminalHistory] Failed to save:', e);
    }
  }

  /**
   * Load all history
   */
  load(): HistoryEntry[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Search history with fuzzy matching
   */
  search(query: string, limit = 20): HistoryEntry[] {
    const history = this.load();
    if (!query.trim()) return history.slice(0, limit);
    
    const lowerQuery = query.toLowerCase();
    return history
      .filter(entry => entry.command.toLowerCase().includes(lowerQuery))
      .slice(0, limit);
  }

  /**
   * Get history for specific directory
   */
  getForDirectory(cwd: string, limit = 50): HistoryEntry[] {
    const history = this.load();
    return history
      .filter(entry => entry.cwd === cwd)
      .slice(0, limit);
  }

  /**
   * Get most used commands
   */
  getMostUsed(limit = 10): { command: string; count: number }[] {
    const history = this.load();
    const counts = new Map<string, number>();
    
    history.forEach(entry => {
      const baseCmd = entry.command.split(' ')[0];
      counts.set(baseCmd, (counts.get(baseCmd) || 0) + 1);
    });
    
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([command, count]) => ({ command, count }));
  }

  /**
   * Clear history
   */
  clear(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(HISTORY_KEY);
  }

  // ============================================================================
  // Favorites
  // ============================================================================

  /**
   * Add favorite command
   */
  addFavorite(command: string, name: string, description?: string, tags: string[] = []): void {
    if (typeof window === 'undefined') return;
    
    try {
      const favorites = this.loadFavorites();
      const favorite: FavoriteCommand = {
        id: `fav-${Date.now()}`,
        command: command.trim(),
        name,
        description,
        tags,
        createdAt: new Date().toISOString(),
      };
      
      favorites.unshift(favorite);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.warn('[TerminalHistory] Failed to save favorite:', e);
    }
  }

  /**
   * Load favorites
   */
  loadFavorites(): FavoriteCommand[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Remove favorite
   */
  removeFavorite(id: string): void {
    if (typeof window === 'undefined') return;
    
    const favorites = this.loadFavorites().filter(f => f.id !== id);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }

  /**
   * Search favorites
   */
  searchFavorites(query: string): FavoriteCommand[] {
    const favorites = this.loadFavorites();
    if (!query.trim()) return favorites;
    
    const lowerQuery = query.toLowerCase();
    return favorites.filter(f => 
      f.name.toLowerCase().includes(lowerQuery) ||
      f.command.toLowerCase().includes(lowerQuery) ||
      f.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }
}

export const terminalHistory = new TerminalHistory();
