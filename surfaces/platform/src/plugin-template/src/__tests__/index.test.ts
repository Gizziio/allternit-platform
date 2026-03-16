/**
 * Plugin Tests
 * 
 * Example test suite for the plugin.
 */

import { MyA2RPlugin } from '../index';

describe('MyA2RPlugin', () => {
  let plugin: MyA2RPlugin;

  beforeEach(() => {
    plugin = new MyA2RPlugin();
  });

  afterEach(async () => {
    if (plugin.active) {
      await plugin.deactivate();
    }
  });

  describe('initialization', () => {
    it('should have correct plugin info', () => {
      expect(plugin.info.id).toBe('{{PLUGIN_ID}}');
      expect(plugin.info.name).toBe('{{PLUGIN_NAME}}');
      expect(plugin.info.version).toBe('1.0.0');
    });

    it('should not be active initially', () => {
      expect(plugin.active).toBe(false);
    });
  });

  describe('activation', () => {
    it('should activate successfully', async () => {
      await plugin.activate();
      expect(plugin.active).toBe(true);
    });

    it('should load settings on activation', async () => {
      await plugin.activate();
      // Settings should be loaded with defaults
      expect(plugin.getSetting('enabled')).toBeDefined();
    });
  });

  describe('deactivation', () => {
    it('should deactivate successfully', async () => {
      await plugin.activate();
      await plugin.deactivate();
      expect(plugin.active).toBe(false);
    });
  });

  describe('settings', () => {
    beforeEach(async () => {
      await plugin.activate();
    });

    it('should get and set settings', async () => {
      await plugin.setSetting('testKey', 'testValue');
      expect(plugin.getSetting('testKey')).toBe('testValue');
    });

    it('should return undefined for unset settings', () => {
      expect(plugin.getSetting('nonexistent')).toBeUndefined();
    });
  });

  describe('notifications', () => {
    beforeEach(async () => {
      await plugin.activate();
    });

    it('should show notifications without error', () => {
      expect(() => {
        plugin.showNotification('Test message', 'info');
      }).not.toThrow();
    });

    it('should show different notification types', () => {
      expect(() => {
        plugin.showNotification('Info', 'info');
        plugin.showNotification('Warning', 'warning');
        plugin.showNotification('Error', 'error');
      }).not.toThrow();
    });
  });

  describe('panel operations', () => {
    beforeEach(async () => {
      await plugin.activate();
    });

    it('should open panel without error', async () => {
      await expect(plugin.openPanel()).resolves.not.toThrow();
    });
  });
});
