import { describe, it, expect } from 'vitest'
import { loadPluginForHost, buildPluginSystemPromptPrefix, clearSkillContentCache } from './plugin-loader'

describe('loadPluginForHost', () => {
  it('returns Excel plugin config', () => {
    const plugin = loadPluginForHost('excel')
    expect(plugin).not.toBeNull()
    expect(plugin!.host).toBe('excel')
    expect(plugin!.commands.length).toBeGreaterThan(0)
    expect(plugin!.skills.length).toBeGreaterThan(0)
  })

  it('returns PowerPoint plugin config', () => {
    const plugin = loadPluginForHost('powerpoint')
    expect(plugin).not.toBeNull()
    expect(plugin!.host).toBe('powerpoint')
  })

  it('returns Word plugin config', () => {
    const plugin = loadPluginForHost('word')
    expect(plugin).not.toBeNull()
    expect(plugin!.host).toBe('word')
  })

  it('returns null for unknown host', () => {
    const plugin = loadPluginForHost('unknown')
    expect(plugin).toBeNull()
  })
})

describe('buildPluginSystemPromptPrefix', () => {
  it('includes plugin name and host', () => {
    const plugin = loadPluginForHost('excel')!
    const prefix = buildPluginSystemPromptPrefix(plugin)

    expect(prefix).toContain('Allternit for Excel')
    expect(prefix).toContain('Host: excel')
    expect(prefix).toContain('Execution pattern: code-generation')
  })

  it('lists all commands', () => {
    const plugin = loadPluginForHost('excel')!
    const prefix = buildPluginSystemPromptPrefix(plugin)

    for (const cmd of plugin.commands) {
      expect(prefix).toContain(cmd.name)
      expect(prefix).toContain(cmd.description)
    }
  })

  it('includes forbidden ops when present', () => {
    const plugin = loadPluginForHost('word')!
    const prefix = buildPluginSystemPromptPrefix(plugin)

    expect(prefix).toContain('FORBIDDEN operations')
    expect(prefix).toContain('body.clear()')
  })

  it('includes redline preference for Word', () => {
    const plugin = loadPluginForHost('word')!
    const prefix = buildPluginSystemPromptPrefix(plugin)

    expect(prefix).toContain('trackAll')
  })

  it('does not include redline for Excel', () => {
    const plugin = loadPluginForHost('excel')!
    const prefix = buildPluginSystemPromptPrefix(plugin)

    expect(prefix).not.toContain('trackAll')
  })
})

describe('clearSkillContentCache', () => {
  it('runs without error', () => {
    // Mostly a smoke test — the cache is internal
    expect(() => clearSkillContentCache()).not.toThrow()
  })
})
