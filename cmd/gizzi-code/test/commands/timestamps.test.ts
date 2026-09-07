import { describe, expect, test } from 'bun:test'
import { call } from '../../src/cli/ui/ink-app/commands/timestamps/timestamps.ts'
import {
  getGlobalConfig,
  saveGlobalConfig,
} from '../../src/cli/ui/ink-app/utils/config.ts'

describe('/timestamps slash command', () => {
  test('toggles showMessageTimestamps and reports the new state', async () => {
    const original = getGlobalConfig().showMessageTimestamps
    try {
      saveGlobalConfig(current => ({ ...current, showMessageTimestamps: false }))
      const on = await call('', {} as never)
      expect(on.type).toBe('text')
      expect((on as { value: string }).value).toContain('on')
      expect(getGlobalConfig().showMessageTimestamps).toBe(true)

      const off = await call('', {} as never)
      expect((off as { value: string }).value).toContain('off')
      expect(getGlobalConfig().showMessageTimestamps).toBe(false)
    } finally {
      saveGlobalConfig(current => ({
        ...current,
        showMessageTimestamps: original,
      }))
    }
  })
})
