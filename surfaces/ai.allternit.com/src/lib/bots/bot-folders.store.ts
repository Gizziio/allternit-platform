/**
 * Per-bot thread folders — OpenMaus `BotProject` mapped onto Hub local chrome.
 * Membership lives on the session (`metadata.botFolderId`). Deleting a folder
 * does not delete threads.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createVersionedPersistOptions } from '@/lib/bots/versioned-persist';

export const BOT_FOLDER_ID_KEY = 'botFolderId';

export interface BotFolder {
  id: string;
  name: string;
  emoji?: string;
}

export interface BotFoldersState {
  foldersByBot: Record<string, BotFolder[]>;
  createFolder: (botId: string, name: string, emoji?: string) => BotFolder;
  updateFolder: (botId: string, folderId: string, patch: { name?: string; emoji?: string | null }) => void;
  deleteFolder: (botId: string, folderId: string) => void;
  reorderFolders: (botId: string, folderIds: string[]) => void;
}

function slugId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'folder';
  return `${slug}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useBotFoldersStore = create<BotFoldersState>()(
  persist(
    (set, get) => ({
      foldersByBot: {},
      createFolder: (botId, name, emoji) => {
        const folder: BotFolder = {
          id: slugId(name),
          name: name.trim() || 'New folder',
          ...(emoji?.trim() ? { emoji: emoji.trim() } : {}),
        };
        set({
          foldersByBot: {
            ...get().foldersByBot,
            [botId]: [...(get().foldersByBot[botId] ?? []), folder],
          },
        });
        return folder;
      },
      updateFolder: (botId, folderId, patch) => {
        const list = get().foldersByBot[botId] ?? [];
        set({
          foldersByBot: {
            ...get().foldersByBot,
            [botId]: list.map((folder) =>
              folder.id === folderId
                ? {
                    ...folder,
                    ...(patch.name != null ? { name: patch.name.trim() || folder.name } : {}),
                    ...(patch.emoji === null ? { emoji: undefined } : patch.emoji != null ? { emoji: patch.emoji } : {}),
                  }
                : folder,
            ),
          },
        });
      },
      deleteFolder: (botId, folderId) => {
        set({
          foldersByBot: {
            ...get().foldersByBot,
            [botId]: (get().foldersByBot[botId] ?? []).filter((folder) => folder.id !== folderId),
          },
        });
      },
      reorderFolders: (botId, folderIds) => {
        const current = get().foldersByBot[botId] ?? [];
        const byId = new Map(current.map((folder) => [folder.id, folder]));
        const next = folderIds.map((id) => byId.get(id)).filter((folder): folder is BotFolder => Boolean(folder));
        for (const folder of current) {
          if (!next.some((row) => row.id === folder.id)) next.push(folder);
        }
        set({
          foldersByBot: { ...get().foldersByBot, [botId]: next },
        });
      },
    }),
    {
      name: 'allternit-bot-folders',
      ...createVersionedPersistOptions<BotFoldersState>({
        schemaVersion: 1,
        migrations: { 0: (state) => state },
        partialize: (state) => ({ foldersByBot: state.foldersByBot }),
      }),
    },
  ),
);

export function moveFolderIds(ids: string[], folderId: string, direction: -1 | 1): string[] {
  const index = ids.indexOf(folderId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= ids.length) return ids;
  const copy = [...ids];
  const [row] = copy.splice(index, 1);
  copy.splice(next, 0, row);
  return copy;
}
