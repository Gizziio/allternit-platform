import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PluginManager } from './PluginManager';

const mockCreateSkill = vi.fn();
const mockUpdateCapabilityMetadata = vi.fn();
const mockDeleteCapability = vi.fn();
const mockToggleCapabilityEnabled = vi.fn();
const mockInstallMarketplacePlugin = vi.fn();
const mockUninstallMarketplacePlugin = vi.fn();
const mockCreatePlugin = vi.fn();
const mockRefresh = vi.fn();

vi.mock('../../plugins/useCliToolsApi', () => ({
  useCliToolsApi: () => ({
    cliTools: [],
    enabledIds: new Set<string>(),
    toggle: vi.fn(),
  }),
}));

vi.mock('../../plugins/marketplaceApi', () => ({
  PLUGIN_CATEGORIES: [
    { id: 'all', label: 'All' },
    { id: 'productivity', label: 'Productivity' },
  ],
  CURATED_MARKETPLACE_SOURCES: [
    {
      id: 'anthropic-official',
      label: 'Anthropic Official',
      owner: 'Anthropic',
      trust: 'official',
      manifestUrl: 'https://example.com/marketplace.json',
      description: 'Official source',
    },
  ],
  fetchConnectorMarketplaceCatalog: vi.fn(async () => ({
    source: 'api',
    connectors: [
      {
        id: 'market-connector-1',
        name: 'Notion',
        description: 'Docs connector',
        category: 'docs',
        connectorType: 'productivity',
        featured: true,
        icon: 'NO',
      },
    ],
  })),
  searchMarketplace: vi.fn(async () => ({
    source: 'api',
    plugins: [
      {
        id: 'market-plugin-1',
        name: 'Market Plugin',
        description: 'Plugin from marketplace',
        version: '1.0.0',
        author: 'A2R',
        icon: 'puzzle',
        category: 'productivity',
        installCount: 12,
        rating: 4.8,
        installed: false,
      },
    ],
  })),
  fetchPluginFromGitHub: vi.fn(async () => null),
}));

vi.mock('../../plugins/fileSystem', () => ({
  useFileSystem: () => ({
    skills: [
      {
        id: 'skill-1',
        name: 'skill-one',
        description: 'original skill description',
        content: '# skill-one',
        icon: 'book-open',
        enabled: true,
        author: 'System',
        updatedAt: '2026-03-05T12:00:00.000Z',
        files: [
          {
            id: 'skill-1-file-skill-md',
            name: 'SKILL.md',
            path: '/skills/skill-one/SKILL.md',
            type: 'file',
            content: '# skill-one\n\nThis is a test skill.',
            language: 'markdown',
          },
          {
            id: 'skill-1-file-viewer-html',
            name: 'viewer.html',
            path: '/skills/skill-one/viewer.html',
            type: 'file',
            content: '<!doctype html><html><body><h1>Viewer Preview</h1></body></html>',
            language: 'html',
          },
        ],
      },
    ],
    commands: [],
    cliTools: [],
    plugins: [
      {
        id: 'plugin-local-1',
        name: 'local-plugin',
        description: 'local plugin',
        content: '{}',
        icon: 'puzzle',
        enabled: true,
        author: 'System',
        updatedAt: '2026-03-05T12:00:00.000Z',
        files: [],
      },
    ],
    mcps: [],
    webhooks: [],
    connectors: [
      {
        id: 'connector-1',
        name: 'Notion',
        appName: 'Notion',
        description: 'Workspace docs',
        content: 'Connector details',
        icon: 'plug',
        enabled: false,
        author: 'System',
        updatedAt: '2026-03-05T12:00:00.000Z',
        files: [],
      },
    ],
    isLoading: false,
    error: null,
    refresh: mockRefresh,
    installMarketplacePlugin: mockInstallMarketplacePlugin,
    uninstallMarketplacePlugin: mockUninstallMarketplacePlugin,
    fs: {
      readFile: vi.fn(async () => ''),
      writeFile: vi.fn(async () => undefined),
      exists: vi.fn(async () => true),
      mkdir: vi.fn(async () => undefined),
    },
    createSkill: mockCreateSkill,
    createCommand: vi.fn(async () => ({ success: true })),
    createConnector: vi.fn(async () => ({ success: true })),
    createMcp: vi.fn(async () => ({ success: true })),
    createCliTool: vi.fn(async () => ({ success: true })),
    createWebhook: vi.fn(async () => ({ success: true })),
    createPlugin: mockCreatePlugin,
    updateCapabilityMetadata: mockUpdateCapabilityMetadata,
    updateFileContent: vi.fn(async () => ({ success: true })),
    deleteCapability: mockDeleteCapability,
    createFileInTree: vi.fn(async () => ({ success: true })),
    createDirectoryInTree: vi.fn(async () => ({ success: true })),
    deleteFileInTree: vi.fn(async () => ({ success: true })),
    renameFileInTree: vi.fn(async () => ({ success: true })),
    toggleCapabilityEnabled: mockToggleCapabilityEnabled,
  }),
}));

describe('PluginManager key flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSkill.mockResolvedValue({ success: true });
    mockUpdateCapabilityMetadata.mockResolvedValue({ success: true });
    mockDeleteCapability.mockResolvedValue({ success: true });
    mockToggleCapabilityEnabled.mockResolvedValue({ success: true });
    mockInstallMarketplacePlugin.mockResolvedValue({ success: true });
    mockUninstallMarketplacePlugin.mockResolvedValue({ success: true });
    mockCreatePlugin.mockResolvedValue({ success: true, capability: { id: 'plugin-generated' } });
    mockRefresh.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('covers create, edit, uninstall, and marketplace install/uninstall', async () => {
    const user = userEvent.setup();
    const promptSpy = vi.spyOn(window, 'prompt');
    promptSpy.mockImplementation((message: string | undefined) => {
      if (message?.includes('Skill name')) return 'Flow Skill';
      if (message?.includes('What should')) return 'Flow skill description';
      if (message?.includes('Edit description')) return 'Edited description';
      return '';
    });

    render(<PluginManager isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Create new' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create with assistant' }));
    await waitFor(() => expect(mockCreateSkill).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit' }));
    await waitFor(() => expect(mockUpdateCapabilityMetadata).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'More options' }));
    await user.click(screen.getByRole('menuitem', { name: 'Uninstall' }));
    await waitFor(() => expect(mockDeleteCapability).toHaveBeenCalledTimes(1));

    const categoriesNav = screen.getByRole('navigation', { name: 'Capability categories' });
    await user.click(within(categoriesNav).getByRole('button', { name: 'Plugins' }));
    const capabilityList = screen.getByRole('region', { name: 'Capability list' });
    await user.click(within(capabilityList).getByRole('button', { name: 'Browse plugins' }));

    const installButton = await screen.findByRole('button', { name: 'Install' });
    await user.click(installButton);
    await waitFor(() =>
      expect(mockInstallMarketplacePlugin).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'market-plugin-1' })
      )
    );

    await user.click(within(capabilityList).getByRole('button', { name: 'Browse plugins' }));
    const uninstallButton = await screen.findByRole('button', { name: 'Uninstall' });
    await user.click(uninstallButton);
    await waitFor(() => expect(mockUninstallMarketplacePlugin).toHaveBeenCalledWith('market-plugin-1'));
  });

  it('enforces pane offsets and supports html human/code preview switch', async () => {
    const user = userEvent.setup();
    render(<PluginManager isOpen onClose={vi.fn()} />);

    const categoriesNav = screen.getByRole('navigation', { name: 'Capability categories' });
    const capabilityList = screen.getByRole('region', { name: 'Capability list' });
    expect(categoriesNav.getAttribute('style') || '').toContain('margin-top: 98px');
    expect(capabilityList.getAttribute('style') || '').toContain('margin-left: 34px');

    await user.click(within(categoriesNav).getByRole('button', { name: 'Skills' }));
    await user.click(screen.getByRole('treeitem', { name: /viewer\.html/i }));

    expect(await screen.findByTitle('Preview viewer.html')).toBeTruthy();

    const codeButton = screen.getByRole('button', { name: 'Code' });
    await user.click(codeButton);
    await waitFor(() => expect(screen.queryByTitle('Preview viewer.html')).toBeNull());
    expect(codeButton.getAttribute('aria-pressed')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Human' }));
    expect(await screen.findByTitle('Preview viewer.html')).toBeTruthy();
  });

  it('covers connector connect and disconnect flow with account-aware modal', async () => {
    const user = userEvent.setup();
    render(<PluginManager isOpen onClose={vi.fn()} />);

    const categoriesNav = screen.getByRole('navigation', { name: 'Capability categories' });
    await user.click(within(categoriesNav).getByRole('button', { name: 'Connectors' }));
    const connectButton = await screen.findByRole('button', { name: 'Connect' });
    await user.click(connectButton);

    const dialog = await screen.findByRole('dialog', { name: /Connect Notion/i });
    const accountInput = within(dialog).getByPlaceholderText('team@company.com');
    await user.clear(accountInput);
    await user.type(accountInput, 'workspace-account');
    await user.click(within(dialog).getAllByRole('button', { name: 'Connect' })[0]);

    await waitFor(() =>
      expect(mockToggleCapabilityEnabled).toHaveBeenCalledWith('connector', 'connector-1', true)
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() =>
      expect(mockToggleCapabilityEnabled).toHaveBeenCalledWith('connector', 'connector-1', false)
    );
  });

  it('covers personal marketplace source add and remove flow', async () => {
    const user = userEvent.setup();

    render(<PluginManager isOpen onClose={vi.fn()} />);

    const categoriesNav = screen.getByRole('navigation', { name: 'Capability categories' });
    await user.click(within(categoriesNav).getByRole('button', { name: 'Plugins' }));
    const capabilityList = screen.getByRole('region', { name: 'Capability list' });
    await user.click(within(capabilityList).getByRole('button', { name: 'Browse plugins' }));

    const browseDialog = await screen.findByRole('dialog', { name: 'Browse plugins' });
    await user.click(within(browseDialog).getByRole('button', { name: 'Personal' }));
    await user.click(within(browseDialog).getByRole('button', { name: 'Add from GitHub' }));

    // Trust warning modal opens - find by heading
    await screen.findByRole('heading', { name: 'Add from GitHub' });
    
    // Check the trust warning checkbox
    const trustCheckbox = screen.getByRole('checkbox', { name: /I understand and accept the risks/i });
    await user.click(trustCheckbox);
    
    // Enter the repository
    const repoInput = screen.getByPlaceholderText('owner/repository');
    await user.type(repoInput, 'a2r/test-marketplace');
    
    // Click Add Source button
    await user.click(screen.getByRole('button', { name: 'Add Source' }));

    // Verify the source appears in the personal sources list
    await screen.findByText('a2r/test-marketplace');
    await user.click(within(browseDialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByText('a2r/test-marketplace')).toBeNull());
  });

  it('creates plugins through the wizard with manifest payload', async () => {
    const user = userEvent.setup();
    render(<PluginManager isOpen onClose={vi.fn()} />);

    const categoriesNav = screen.getByRole('navigation', { name: 'Capability categories' });
    await user.click(within(categoriesNav).getByRole('button', { name: 'Plugins' }));
    await user.click(screen.getByRole('button', { name: 'Create new' }));
    await user.click(screen.getByRole('menuitem', { name: 'Create new' }));

    await user.type(screen.getByPlaceholderText('e.g., Agent Rails Toolkit'), 'Agent Rails Toolkit');
    await user.type(screen.getByPlaceholderText('What this plugin does'), 'Internal automation workflows');
    await user.click(screen.getAllByRole('button', { name: 'Create' })[0]);

    await waitFor(() => expect(mockCreatePlugin).toHaveBeenCalledTimes(1));
    expect(mockCreatePlugin).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Agent Rails Toolkit',
        description: 'Internal automation workflows',
        manifest: expect.objectContaining({
          name: 'agent-rails-toolkit',
        }),
      })
    );
  });
});
