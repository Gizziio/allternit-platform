import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { listen, speak, transcribe, recordAudio, voiceChat } from "@/runtime/voice/voice"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "voice-cli" })

export const VoiceCommand = cmd({
  command: "voice <action>",
  describe: "Voice commands — speak to gizzi",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["listen", "speak", "transcribe", "chat"],
        describe: "Voice action",
      })
      .option("text", {
        type: "string",
        alias: "t",
        describe: "Text to speak (for 'speak' action)",
      })
      .option("file", {
        type: "string",
        alias: "f",
        describe: "Audio file to transcribe (for 'transcribe' action)",
      })
      .option("duration", {
        type: "number",
        alias: "d",
        describe: "Recording duration in seconds",
        default: 5,
      })
      .option("model", {
        type: "string",
        alias: "m",
        describe: "Whisper model size",
        choices: ["tiny", "base", "small", "medium", "large"],
        default: "tiny",
      })
      .option("voice", {
        type: "string",
        alias: "v",
        describe: "TTS voice (macOS: say -v ? to list)",
      })
      .example("gizzi voice listen", "Record 5 seconds and transcribe")
      .example("gizzi voice listen -d 10", "Record 10 seconds and transcribe")
      .example('gizzi voice speak -t "Hello world"', "Speak text aloud")
      .example("gizzi voice transcribe -f recording.wav", "Transcribe an audio file")
      .example("gizzi voice chat", "Start a voice conversation"),

  handler: async (args) => {
    const action = args.action as "listen" | "speak" | "transcribe" | "chat"

    try {
      switch (action) {
        case "listen": {
          UI.println(UI.Style.TEXT_INFO + "🎤 Recording... speak now!" + UI.Style.RESET)
          const text = await listen({ duration: args.duration, model: args.model })
          UI.println(UI.Style.TEXT_SUCCESS + "✅ Transcribed:" + UI.Style.RESET)
          UI.println(text)
          break
        }

        case "speak": {
          const text = args.text
          if (!text) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No text provided. Use --text or -t" + UI.Style.RESET)
            process.exit(1)
          }
          UI.println(UI.Style.TEXT_INFO + "🔊 Speaking..." + UI.Style.RESET)
          await speak(text, { voice: args.voice })
          UI.println(UI.Style.TEXT_SUCCESS + "✅ Done" + UI.Style.RESET)
          break
        }

        case "transcribe": {
          const file = args.file
          if (!file) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No file provided. Use --file or -f" + UI.Style.RESET)
            process.exit(1)
          }
          UI.println(UI.Style.TEXT_INFO + "📝 Transcribing..." + UI.Style.RESET)
          const text = await transcribe(file, { model: args.model })
          UI.println(UI.Style.TEXT_SUCCESS + "✅ Transcription:" + UI.Style.RESET)
          UI.println(text)
          break
        }

        case "chat": {
          UI.println(UI.Style.TEXT_INFO_BOLD + "🎤 Voice Chat Mode" + UI.Style.RESET)
          UI.println("Speak after the beep. Say nothing to stop.\n")

          await voiceChat({
            onUserHeard: (text) => {
              // Already printed by listen
            },
            onAssistantSpeaking: (text) => {
              // Already printed
            },
            getResponse: async (messages) => {
              // For now, use a simple echo or integrate with the AI runtime
              // TODO: wire to actual AI model
              return "I heard you say: " + messages[messages.length - 1].text
            },
          })

          UI.println(UI.Style.TEXT_INFO + "\n👋 Voice chat ended" + UI.Style.RESET)
          break
        }
      }
    } catch (err: any) {
      log.error("voice command failed", { error: err.message })
      UI.println(UI.Style.TEXT_ERROR + `❌ Error: ${err.message}` + UI.Style.RESET)
      process.exit(1)
    }
  },
})
