import { describe, expect, test } from 'bun:test'
import { pcm16leToWav } from './localVoiceSTT.js'

describe('pcm16leToWav', () => {
  test('wraps raw pcm with a 44-byte wav header', () => {
    const pcm = Buffer.alloc(32000, 0)
    const wav = pcm16leToWav(pcm)
    expect(wav.length).toBe(44 + 32000)
    expect(wav.subarray(0, 4).toString()).toBe('RIFF')
    expect(wav.subarray(8, 12).toString()).toBe('WAVE')
  })

  test('passes through an existing wav container', () => {
    const pcm = Buffer.alloc(100, 1)
    const wav = pcm16leToWav(pcm)
    const again = pcm16leToWav(wav)
    expect(again.equals(wav)).toBe(true)
  })
})
