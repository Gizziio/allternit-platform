// Local speech-to-text: Allternit voice-service sidecar, then whisper-cli.
// Never talks to Anthropic voice_stream.

import { spawn } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync } from 'fs'


const DEFAULT_SIDECAR = 'http://127.0.0.1:8001'
const SAMPLE_RATE = 16_000
const CHANNELS = 1

export function sidecarBaseUrl(): string {
  return (
    process.env.ALLTERNIT_VOICE_URL ||
    process.env.VOICE_URL ||
    DEFAULT_SIDECAR
  ).replace(/\/+$/, '')
}

export async function isSidecarHealthy(timeoutMs = 1500): Promise<boolean> {
  try {
    const response = await fetch(`${sidecarBaseUrl()}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return response.ok
  } catch {
    return false
  }
}

export function resolveWhisperCli(): string | null {
  if (process.env.WHISPER_CLI && existsSync(process.env.WHISPER_CLI)) {
    return process.env.WHISPER_CLI
  }
  const home = homedir()
  const candidates = [
    join(home, '.allternit', 'bin', 'whisper-cli'),
    '/opt/homebrew/bin/whisper-cli',
    '/usr/local/bin/whisper-cli',
  ]
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

export function resolveWhisperModel(): string | null {
  if (process.env.WHISPER_MODEL && existsSync(process.env.WHISPER_MODEL)) {
    return process.env.WHISPER_MODEL
  }
  const home = homedir()
  const candidates = [
    join(home, '.allternit', 'models', 'whisper', 'ggml-tiny.en.bin'),
    join(home, '.allternit', 'models', 'ggml-tiny.en.bin'),
  ]
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

export async function isLocalVoiceAvailable(): Promise<boolean> {
  if (await isSidecarHealthy()) return true
  return resolveWhisperCli() !== null
}

export function pcm16leToWav(
  pcm: Buffer,
  sampleRate = SAMPLE_RATE,
  channels = CHANNELS,
): Buffer {
  if (pcm.length >= 12 && pcm.subarray(0, 4).toString() === 'RIFF') {
    return pcm
  }
  const dataLen = pcm.length
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataLen, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * channels * 2, 28)
  header.writeUInt16LE(channels * 2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataLen, 40)
  return Buffer.concat([header, pcm])
}

export async function transcribePcm(
  pcm: Buffer,
  language = 'en',
): Promise<string> {
  const wav = pcm16leToWav(pcm)
  if (await isSidecarHealthy()) {
    const text = await transcribeViaSidecar(wav, language)
    if (text !== null) return text
  }
  return transcribeViaCli(wav, language)
}

async function transcribeViaSidecar(
  wav: Buffer,
  language: string,
): Promise<string | null> {
  try {
    const body = new FormData()
    body.append(
      'audio',
      new Blob([new Uint8Array(wav)], { type: 'audio/wav' }),
      'utterance.wav',
    )
    body.append('language', language)
    const response = await fetch(`${sidecarBaseUrl()}/v1/stt`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok) {
      console.debug(`[local-voice] sidecar STT HTTP ${response.status}`)
      return null
    }
    const json = (await response.json()) as { text?: string }
    return (json.text ?? '').trim()
  } catch (err) {
    console.debug(`[local-voice] sidecar STT failed: ${String(err)}`)
    return null
  }
}

async function transcribeViaCli(wav: Buffer, language: string): Promise<string> {
  const cli = resolveWhisperCli()
  if (!cli) {
    throw new Error(
      'Local voice engine is not running. Start Allternit Desktop or install whisper-cli (whisper.cpp).',
    )
  }
  const model = resolveWhisperModel()
  if (!model) {
    throw new Error(
      'Whisper model missing. Set WHISPER_MODEL or place ggml-tiny.en.bin in ~/.allternit/models/whisper/.',
    )
  }
  const dir = await mkdtemp(join(tmpdir(), 'gizzi-voice-'))
  const wavPath = join(dir, 'utterance.wav')
  try {
    await writeFile(wavPath, wav)
    const stdout = await runCli(cli, [
      '-m',
      model,
      '-f',
      wavPath,
      '-nt',
      '-np',
      '-l',
      language,
    ])
    return cleanTranscript(stdout)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

function runCli(cli: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cli, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', chunk => {
      stderr += String(chunk)
    })
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error('whisper-cli timed out'))
    }, 60_000)
    child.on('error', err => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('exit', code => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(`whisper-cli exited ${code}: ${stderr.trim()}`))
        return
      }
      resolve(stdout)
    })
  })
}

function cleanTranscript(raw: string): string {
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(
      line =>
        line.length > 0 &&
        !line.startsWith('[') &&
        !line.startsWith('whisper_') &&
        !line.startsWith('system_info') &&
        !line.startsWith('main:'),
    )
    .join(' ')
    .trim()
}
