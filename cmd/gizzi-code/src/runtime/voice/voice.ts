/**
 * Voice Service
 *
 * Out-of-the-box voice integration for gizzi-code.
 *
 * Speech-to-Text: Uses OpenAI Whisper (already installed via `brew install openai-whisper`)
 * Text-to-Speech: Uses macOS `say` (built-in) or Linux `espeak`
 * Recording: Uses ffmpeg with avfoundation (macOS) or alsa (Linux)
 *
 * No compilation needed. Works immediately on macOS with:
 *   brew install openai-whisper ffmpeg
 */

import { spawn, execSync } from "child_process"
import { homedir } from "os"
import { join } from "path"
import { mkdir, access, readFile, unlink } from "fs/promises"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "voice" })

const VOICE_DIR = join(homedir(), ".allternit", "voice")

interface VoiceConfig {
  sttEngine: "whisper"
  sttModel: "tiny" | "base" | "small" | "medium" | "large"
  ttsEngine: "say" | "espeak" | "spd-say"
  recordDevice?: string
}

function getPlatformTTS(): "say" | "espeak" | "spd-say" {
  if (process.platform === "darwin") return "say"
  // Try espeak first, then spd-say
  try {
    execSync("which espeak", { stdio: "ignore" })
    return "espeak"
  } catch {
    return "spd-say"
  }
}

async function ensureVoiceDir(): Promise<string> {
  await mkdir(VOICE_DIR, { recursive: true })
  return VOICE_DIR
}

async function checkCommand(cmd: string): Promise<boolean> {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

// ── Recording ───────────────────────────────────────────────────────────────

export async function recordAudio(options?: { duration?: number; outputPath?: string }): Promise<string> {
  const dir = await ensureVoiceDir()
  const outputPath = options?.outputPath ?? join(dir, `recording-${Date.now()}.wav`)
  const duration = options?.duration ?? 5

  const platform = process.platform
  let args: string[]

  if (platform === "darwin") {
    // macOS: use avfoundation
    args = [
      "-f", "avfoundation",
      "-i", ":0", // default audio input
      "-t", String(duration),
      "-ar", "16000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      "-y",
      outputPath,
    ]
  } else if (platform === "linux") {
    // Linux: use alsa
    args = [
      "-f", "alsa",
      "-i", "default",
      "-t", String(duration),
      "-ar", "16000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      "-y",
      outputPath,
    ]
  } else {
    throw new Error(`Voice recording not supported on platform: ${platform}`)
  }

  log.info("recording audio", { duration, outputPath })

  await new Promise<void>((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: "pipe" })
    let stderr = ""

    proc.stderr?.on("data", (data) => {
      stderr += data.toString()
    })

    proc.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`))
      }
    })

    proc.on("error", (err) => reject(err))
  })

  return outputPath
}

// ── Speech-to-Text ──────────────────────────────────────────────────────────

export async function transcribe(audioPath: string, options?: { model?: string; language?: string }): Promise<string> {
  const hasWhisper = await checkCommand("whisper")
  if (!hasWhisper) {
    throw new Error(
      `whisper not found. Install it with:\n` +
        `  brew install openai-whisper    # macOS\n` +
        `  pip install openai-whisper     # Linux/Python`,
    )
  }

  const model = options?.model ?? "tiny"
  const language = options?.language ?? "en"
  const outputDir = await ensureVoiceDir()

  log.info("transcribing", { audioPath, model, language })

  const args = [
    audioPath,
    "--model", model,
    "--language", language,
    "--output_format", "txt",
    "--output_dir", outputDir,
  ]

  return new Promise((resolve, reject) => {
    const proc = spawn("whisper", args, { stdio: "pipe" })
    let stdout = ""
    let stderr = ""

    proc.stdout?.on("data", (data) => {
      stdout += data.toString()
    })

    proc.stderr?.on("data", (data) => {
      stderr += data.toString()
    })

    proc.on("close", async (code) => {
      if (code === 0) {
        // Read the generated txt file
        const txtPath = audioPath.replace(/\.[^.]+$/, ".txt")
        try {
          const text = await readFile(txtPath, "utf-8")
          resolve(text.trim())
        } catch {
          // Fallback to stdout
          resolve(stdout.trim())
        }
      } else {
        reject(new Error(`whisper exited with code ${code}: ${stderr}`))
      }
    })

    proc.on("error", (err) => reject(err))
  })
}

// ── Text-to-Speech ──────────────────────────────────────────────────────────

export async function speak(text: string, options?: { voice?: string; rate?: number }): Promise<void> {
  const engine = getPlatformTTS()

  log.info("speaking", { engine, text: text.slice(0, 50) })

  let args: string[]

  if (engine === "say") {
    args = [text]
    if (options?.voice) args.push("-v", options.voice)
    if (options?.rate) args.push("-r", String(options.rate))
  } else if (engine === "espeak") {
    args = [text]
    if (options?.rate) args.push("-s", String(options.rate))
  } else {
    args = [text]
  }

  return new Promise((resolve, reject) => {
    const proc = spawn(engine, args, { stdio: "ignore" })
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${engine} exited with code ${code}`))
    })
    proc.on("error", reject)
  })
}

// ── Combined ────────────────────────────────────────────────────────────────

export async function listen(options?: { duration?: number; model?: string }): Promise<string> {
  const audioPath = await recordAudio({ duration: options?.duration })
  const text = await transcribe(audioPath, { model: options?.model })

  // Clean up audio file
  try {
    await unlink(audioPath)
  } catch {
    /* ignore cleanup errors */
  }

  return text
}

// ── Voice Chat Loop ─────────────────────────────────────────────────────────

export interface VoiceChatMessage {
  role: "user" | "assistant"
  text: string
}

export async function voiceChat(options?: {
  onUserHeard?: (text: string) => void
  onAssistantSpeaking?: (text: string) => void
  getResponse: (messages: VoiceChatMessage[]) => Promise<string>
  maxTurns?: number
}): Promise<void> {
  const messages: VoiceChatMessage[] = []
  const maxTurns = options?.maxTurns ?? 10

  for (let i = 0; i < maxTurns; i++) {
    // Listen
    console.log("\n🎤 Listening... (speak now)")
    const userText = await listen({ duration: 5 })

    if (!userText.trim()) {
      console.log("🔇 No speech detected. Stopping.")
      break
    }

    console.log(`👤 You: ${userText}`)
    options?.onUserHeard?.(userText)
    messages.push({ role: "user", text: userText })

    // Get AI response
    const assistantText = await options!.getResponse(messages)
    console.log(`🤖 Assistant: ${assistantText}`)
    options?.onAssistantSpeaking?.(assistantText)
    messages.push({ role: "assistant", text: assistantText })

    // Speak response
    await speak(assistantText)
  }
}
