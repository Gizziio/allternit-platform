import { describe, test, expect } from "bun:test"
import { createElement as h } from "react"
import { render, BaseBox, BaseText } from "../../src/cli/ui/ink-app/ink"
import { LogUpdate } from "../../src/cli/ui/ink-app/ink/log-update"
import Output from "../../src/cli/ui/ink-app/ink/output"
import {
  CellWidth,
  CharPool,
  createScreen,
  HyperlinkPool,
  setCellAt,
  StylePool,
  type Screen,
} from "../../src/cli/ui/ink-app/ink/screen"

// Regression tests for stale-cell ghosts: when a rendered line shrinks
// between frames, characters past the new line end must not linger in the
// terminal. The fix lives in ink/log-update.ts (per-row erase-to-EOL sweep
// in the TTY diff loop); these tests pin its behavior.

const CSI_K = "\x1b[K"

const pools = () => ({
  stylePool: new StylePool(),
  charPool: new CharPool(),
  hyperlinkPool: new HyperlinkPool(),
})

function writePlain(screen: Screen, x: number, y: number, text: string): void {
  const none = screen.emptyStyleId
  for (let i = 0; i < text.length; i++) {
    setCellAt(screen, x + i, y, {
      char: text[i]!,
      styleId: none,
      width: CellWidth.Narrow,
      hyperlink: undefined,
    })
  }
}

function mkFrame(screen: Screen, width: number, height: number) {
  return {
    screen,
    viewport: { width, height },
    cursor: { x: 0, y: 1, visible: false },
  }
}

describe("LogUpdate stale-tail sweep", () => {
  test("emits erase-to-EOL when a row shrinks outside the damage region", () => {
    const { stylePool, charPool, hyperlinkPool } = pools()
    const w = 40
    const h = 5

    // Prev frame: a long line was painted at row 0, but its damage was lost
    // (e.g. the frame was buffer-reset/contaminated). The next frame rewrites
    // a short prefix (so the row is visited by the diff) while the stale tail
    // sits outside both damage regions.
    const prev = createScreen(w, h, stylePool, charPool, hyperlinkPool)
    writePlain(prev, 0, 0, "jello world this is long")
    prev.damage = undefined

    const next = createScreen(w, h, stylePool, charPool, hyperlinkPool)
    writePlain(next, 0, 0, "hello")

    const log = new LogUpdate({ isTTY: true, stylePool })
    const ops = log.render(mkFrame(prev, w, 24), mkFrame(next, w, 24), false, true)

    const stdout = ops
      .filter((op: any) => op.type === "stdout")
      .map((op: any) => op.content)
      .join("")
    expect(stdout).toContain(CSI_K)
  })

  test("does not emit erase-to-EOL when nothing shrinks", () => {
    const { stylePool, charPool, hyperlinkPool } = pools()
    const w = 40
    const h = 5

    const prev = createScreen(w, h, stylePool, charPool, hyperlinkPool)
    writePlain(prev, 0, 0, "hello world")

    const next = createScreen(w, h, stylePool, charPool, hyperlinkPool)
    writePlain(next, 0, 0, "hello brave world")

    const log = new LogUpdate({ isTTY: true, stylePool })
    const ops = log.render(mkFrame(prev, w, 24), mkFrame(next, w, 24), false, true)
    const stdout = ops
      .filter((op: any) => op.type === "stdout")
      .map((op: any) => op.content)
      .join("")
    expect(stdout).not.toContain(CSI_K)
  })

  test("does not emit erase-to-EOL when a row grows", () => {
    const { stylePool, charPool, hyperlinkPool } = pools()
    const w = 40
    const h = 5

    const prev = createScreen(w, h, stylePool, charPool, hyperlinkPool)
    writePlain(prev, 0, 0, "hi")

    const next = createScreen(w, h, stylePool, charPool, hyperlinkPool)
    writePlain(next, 0, 0, "a much longer line now")

    const log = new LogUpdate({ isTTY: true, stylePool })
    const ops = log.render(mkFrame(prev, w, 24), mkFrame(next, w, 24), false, true)
    const stdout = ops
      .filter((op: any) => op.type === "stdout")
      .map((op: any) => op.content)
      .join("")
    expect(stdout).not.toContain(CSI_K)
  })

  test("end-to-end: shrinking a line leaves no ghost in the terminal grid", async () => {
    // Minimal terminal-grid mock: tracks written characters per cell and
    // honors CSI K (erase to end of line).
    const cols = 40
    const rows = 6
    const grid: string[][] = Array.from({ length: rows }, () =>
      Array(cols).fill(" "),
    )
    let cx = 0
    let cy = 0
    let pending = ""
    const ESC = "\x1b"
    const process = (data: string): void => {
      pending += data
      let i = 0
      while (i < pending.length) {
        const ch = pending[i]!
        if (ch === ESC) {
          if (pending[i + 1] === "[") {
            let j = i + 2
            let params = ""
            while (
              j < pending.length &&
              !(
                pending.charCodeAt(j) >= 0x40 &&
                pending.charCodeAt(j) <= 0x7e
              )
            ) {
              params += pending[j]
              j++
            }
            if (j >= pending.length) break
            const final = pending[j]!
            const nums = params === "" ? [] : params.split(";").map(Number)
            if (final === "H" || final === "f") {
              cy = (nums[0] || 1) - 1
              cx = (nums[1] || 1) - 1
            } else if (final === "A") cy = Math.max(0, cy - (nums[0] || 1))
            else if (final === "B")
              cy = Math.min(rows - 1, cy + (nums[0] || 1))
            else if (final === "C") cx = Math.min(cols, cx + (nums[0] || 1))
            else if (final === "D") cx = Math.max(0, cx - (nums[0] || 1))
            else if (final === "G") cx = (nums[0] || 1) - 1
            else if (final === "K") {
              for (let x = cx; x < cols; x++) grid[cy]![x] = " "
            }
            i = j + 1
            continue
          }
          if (pending[i + 1] === "]") {
            const end = pending.indexOf("\x07", i)
            if (end === -1) break
            i = end + 1
            continue
          }
          i += 2
          continue
        }
        if (ch === "\r") { cx = 0; i++; continue }
        if (ch === "\n") { cy = Math.min(rows - 1, cy + 1); i++; continue }
        if (cx < cols && cy < rows) grid[cy]![cx] = ch
        cx++
        i++
      }
      pending = pending.slice(i)
    }

    const listeners: Record<string, Array<() => void>> = {}
    const stdout = {
      columns: cols,
      rows,
      isTTY: true,
      write(data: any) { process(String(data)); return true },
      on(ev: string, cb: () => void) { (listeners[ev] ??= []).push(cb) },
      off() {},
      removeListener() {},
      cursorTo() {},
      clearLine() {},
      clearScreenDown() {},
    }

    const node = (line: string) =>
      h(
        BaseBox,
        { flexDirection: "column" },
        h(BaseText, null, line),
      )

    const instance = await render(node("hello world this is long"), {
      stdout: stdout as any,
      stdin: { isRaw: false } as any,
      exitOnCtrlC: false,
      patchConsole: false,
    })
    await new Promise(r => setTimeout(r, 60))

    instance.rerender(node("hello"))
    await new Promise(r => setTimeout(r, 60))

    const row = grid[0]!.join("").replace(/\s+$/, "")
    expect(row).toBe("hello")
    instance.unmount()
  }, 10000)
})
