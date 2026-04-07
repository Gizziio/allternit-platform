import z from "zod/v4"
import { EOL } from "os"
import { NamedError } from "@allternit/util/error"
import { logo as glyphs } from "@/cli/ui/logo"

export namespace UI {
  export const CancelledError = NamedError.create("UICancelledError", z.void())

  export const Style = {
    TEXT_HIGHLIGHT: "\x1b[96m",
    TEXT_HIGHLIGHT_BOLD: "\x1b[96m\x1b[1m",
    TEXT_DIM: "\x1b[90m",
    TEXT_DIM_BOLD: "\x1b[90m\x1b[1m",
    TEXT_NORMAL: "\x1b[0m",
    TEXT_NORMAL_BOLD: "\x1b[1m",
    TEXT_BOLD: "\x1b[1m",
    TEXT_WARNING: "\x1b[93m",
    TEXT_WARNING_BOLD: "\x1b[93m\x1b[1m",
    TEXT_DANGER: "\x1b[91m",
    TEXT_DANGER_BOLD: "\x1b[91m\x1b[1m",
    TEXT_ERROR: "\x1b[91m",
    TEXT_SUCCESS: "\x1b[92m",
    TEXT_SUCCESS_BOLD: "\x1b[92m\x1b[1m",
    TEXT_INFO: "\x1b[94m",
    TEXT_INFO_BOLD: "\x1b[94m\x1b[1m",
  }

  export function println(...message: string[]) {
    print(...message)
    Bun.stderr.write(EOL)
  }

  export function print(...message: string[]) {
    blank = false
    Bun.stderr.write(message.join(" "))
  }

  let blank = false
  export function empty() {
    if (blank) return
    println("" + Style.TEXT_NORMAL)
    blank = true
  }

  export function logo(pad?: string) {
    const result: string[] = []
    const reset = "\x1b[0m"
    const left = {
      fg: "\x1b[38;2;212;176;140m", // #D4B08C (Sand)
      shadow: "\x1b[38;2;42;33;26m", // #2A211A (Dark Sand)
      bg: "\x1b[48;2;26;22;18m", // #1A1612 (Obsidian)
    }
    const right = {
      fg: "\x1b[38;2;212;176;140m", // #D4B08C (Sand)
      shadow: "\x1b[38;2;42;33;26m", // #2A211A (Dark Sand)
      bg: "\x1b[48;2;26;22;18m", // #1A1612 (Obsidian)
    }
    const gap = " "
    const draw = (line: string, fg: string, shadow: string, bg: string) => {
      const parts: string[] = []
      for (const char of line) {
        if (char === "_") {
          parts.push(bg, " ", reset)
          continue
        }
        if (char === "^") {
          parts.push(fg, bg, "▀", reset)
          continue
        }
        if (char === "~") {
          parts.push(shadow, "▀", reset)
          continue
        }
        if (char === "#") {
          parts.push(fg, "█", reset)
          continue
        }
        if (char === "*") {
          parts.push(shadow, "█", reset)
          continue
        }
        if (char === " ") {
          parts.push(" ")
          continue
        }
        parts.push(fg, char, reset)
      }
      return parts.join("")
    }
    glyphs.left.forEach((row, index) => {
      if (pad) result.push(pad)
      result.push(draw(row, left.fg, left.shadow, left.bg))
      result.push(gap)
      const other = glyphs.right[index] ?? ""
      result.push(draw(other, right.fg, right.shadow, right.bg))
      result.push(EOL)
    })
    const combined = result.join("").trimEnd()
    const coffee = `\n\n  ${reset}GIZZIIO ${left.fg}&${reset} COFFEE\n`
    return combined + coffee
  }

  export async function input(prompt: string): Promise<string> {
    const readline = require("readline")
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  export function error(message: string) {
    if (message.startsWith("Error: ")) {
      message = message.slice("Error: ".length)
    }
    println(Style.TEXT_DANGER_BOLD + "Error: " + Style.TEXT_NORMAL + message)
  }

  export function markdown(text: string): string {
    const lines = text.split("\n")
    const out: string[] = []
    let inCode = false

    for (const line of lines) {
      if (line.startsWith("```")) {
        inCode = !inCode
        if (inCode) {
          const lang = line.slice(3).trim()
          out.push(Style.TEXT_DIM + (lang ? `[${lang}]` : ""))
        } else {
          out.push(Style.TEXT_NORMAL)
        }
        continue
      }
      if (inCode) {
        out.push("  " + line)
        continue
      }

      const hm = line.match(/^(#{1,3}) (.+)/)
      if (hm) {
        out.push(Style.TEXT_NORMAL_BOLD + hm[2]! + Style.TEXT_NORMAL)
        continue
      }

      const l = line
        .replace(/\*\*(.+?)\*\*/g, `${Style.TEXT_NORMAL_BOLD}$1${Style.TEXT_NORMAL}`)
        .replace(/`([^`]+)`/g, `${Style.TEXT_DIM}$1${Style.TEXT_NORMAL}`)
      out.push(l)
    }

    return out.join("\n")
  }
}
