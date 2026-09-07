import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createBrowserJSONStorage } from '@/lib/zustand-browser-storage';
import { closeTerminalSession } from '@/lib/terminal-api';

export type TerminalTileSourceSurface = 'code' | 'chat' | 'cowork' | 'bot';

export interface TerminalTileSourceTag {
  surface: TerminalTileSourceSurface;
  sessionId: string;
  title: string;
}

export interface TerminalTile {
  /** Client-side uuid; the stable identity of the tile. */
  id: string;
  /** User-editable label. */
  label: string;
  cwd?: string;
  /** Launch command typed into the shell once it connects (e.g. a harness CLI resume). */
  spawnCommand?: string;
  /** Set when the tile was spawned from a code/chat/cowork session. */
  sourceTag?: TerminalTileSourceTag;
  createdAt: number;
}

interface TerminalWorkspaceState {
  tiles: TerminalTile[];
  /** null = grid view; otherwise the id of the tile zoomed to the focus overlay. */
  focusedTileId: string | null;
  /** null = all tiles; otherwise only tiles tagged with this session id. */
  filterTag: string | null;

  addTile: (tile: TerminalTile) => void;
  /** Removes the tile and disposes its remote PTY (if one is registered). */
  removeTile: (id: string) => void;
  renameTile: (id: string, label: string) => void;
  setFocused: (id: string | null) => void;
  setFilterTag: (sessionId: string | null) => void;

  /** Tiles spawned from a code/chat/cowork session carry this tag for grid filtering. */
  addTaggedTile: (input: {
    label?: string;
    cwd?: string;
    spawnCommand?: string;
    tag: TerminalTileSourceTag;
  }) => TerminalTile;

  // ── PTY registry (in-memory only, never persisted) ─────────────────────────
  // The surface component that mounts a tile's PTY registers the remote
  // session id here so removeTile can dispose it without the surface.
  registerTileSession: (tileId: string, remoteSessionId: string) => void;
  unregisterTileSession: (tileId: string) => void;
}

/** live remote PTY session ids by tile id — in-memory, lost on reload by design. */
const tileRemoteSessions = new Map<string, string>();

function generateTileId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const useTerminalWorkspaceStore = create<TerminalWorkspaceState>()(
  persist(
    (set, get) => ({
      tiles: [],
      focusedTileId: null,
      filterTag: null,

      addTile: (tile) => {
        set((state) => ({ tiles: [...state.tiles, tile] }));
      },

      removeTile: (id) => {
        const remoteSessionId = tileRemoteSessions.get(id);
        if (remoteSessionId) {
          tileRemoteSessions.delete(id);
          void closeTerminalSession(remoteSessionId);
        }
        set((state) => ({
          tiles: state.tiles.filter((tile) => tile.id !== id),
          focusedTileId: state.focusedTileId === id ? null : state.focusedTileId,
        }));
      },

      renameTile: (id, label) => {
        const trimmed = label.trim();
        if (!trimmed) return;
        set((state) => ({
          tiles: state.tiles.map((tile) => (tile.id === id ? { ...tile, label: trimmed } : tile)),
        }));
      },

      setFocused: (id) => {
        set({ focusedTileId: id });
      },

      setFilterTag: (sessionId) => {
        set({ filterTag: sessionId });
      },

      addTaggedTile: ({ label, cwd, spawnCommand, tag }) => {
        const tile: TerminalTile = {
          id: generateTileId(),
          label: label?.trim() || `${tag.title} · terminal`,
          cwd,
          spawnCommand,
          sourceTag: tag,
          createdAt: Date.now(),
        };
        get().addTile(tile);
        return tile;
      },

      registerTileSession: (tileId, remoteSessionId) => {
        tileRemoteSessions.set(tileId, remoteSessionId);
      },

      unregisterTileSession: (tileId) => {
        tileRemoteSessions.delete(tileId);
      },
    }),
    {
      name: 'allternit.terminal.workspace.v1',
      storage: createBrowserJSONStorage(),
      partialize: (state) => ({
        tiles: state.tiles,
        focusedTileId: state.focusedTileId,
        filterTag: state.filterTag,
      }),
    },
  ),
);
