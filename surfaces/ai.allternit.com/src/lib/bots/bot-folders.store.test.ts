import { beforeEach, describe, expect, it } from 'vitest';
import { moveFolderIds, useBotFoldersStore } from './bot-folders.store';

describe('bot-folders.store', () => {
  beforeEach(() => {
    useBotFoldersStore.setState({ foldersByBot: {} });
  });

  it('creates, updates, reorders, and deletes without touching other bots', () => {
    const mail = useBotFoldersStore.getState().createFolder('bot-1', 'Mail', '📬');
    useBotFoldersStore.getState().createFolder('bot-1', 'Work');
    useBotFoldersStore.getState().createFolder('bot-2', 'Other');
    expect(useBotFoldersStore.getState().foldersByBot['bot-1'].map((f) => f.name)).toEqual(['Mail', 'Work']);
    useBotFoldersStore.getState().updateFolder('bot-1', mail.id, { name: 'Inbox' });
    expect(useBotFoldersStore.getState().foldersByBot['bot-1'][0].name).toBe('Inbox');
    const ids = useBotFoldersStore.getState().foldersByBot['bot-1'].map((f) => f.id);
    useBotFoldersStore.getState().reorderFolders('bot-1', moveFolderIds(ids, mail.id, 1));
    expect(useBotFoldersStore.getState().foldersByBot['bot-1'].map((f) => f.name)).toEqual(['Work', 'Inbox']);
    useBotFoldersStore.getState().deleteFolder('bot-1', mail.id);
    expect(useBotFoldersStore.getState().foldersByBot['bot-1'].map((f) => f.name)).toEqual(['Work']);
    expect(useBotFoldersStore.getState().foldersByBot['bot-2']).toHaveLength(1);
  });

  it('refuses a move past the ends', () => {
    expect(moveFolderIds(['a', 'b'], 'a', -1)).toEqual(['a', 'b']);
    expect(moveFolderIds(['a', 'b'], 'b', 1)).toEqual(['a', 'b']);
  });
});
