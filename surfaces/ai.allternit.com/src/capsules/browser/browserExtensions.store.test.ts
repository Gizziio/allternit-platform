import { beforeEach, describe, expect, it } from 'vitest';
import { ALLTERNIT_OWNED_EXTENSIONS, useBrowserExtensionsStore } from './browserExtensions.store';

describe('Allternit browser extension contract', () => {
  beforeEach(() => {
    useBrowserExtensionsStore.setState({ extensions: ALLTERNIT_OWNED_EXTENSIONS.map((extension) => ({ ...extension })) });
  });

  it('registers the computer agent and all three real Office hosts', () => {
    const extensions = useBrowserExtensionsStore.getState().extensions;
    expect(extensions.map((extension) => extension.id)).toEqual(expect.arrayContaining([
      'allternit-agent',
      'allternit-office-word',
      'allternit-office-excel',
      'allternit-office-powerpoint',
    ]));
    expect(extensions.filter((extension) => extension.officeHost).every((extension) => Boolean(extension.launchUrl))).toBe(true);
  });

  it('uses one enablement state for the manager and browser toolbar', () => {
    useBrowserExtensionsStore.getState().toggleExtension('allternit-office-word');
    expect(useBrowserExtensionsStore.getState().extensions.find((extension) => extension.id === 'allternit-office-word')?.enabled).toBe(true);
  });
});
