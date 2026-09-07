import { describe, test, expect } from "bun:test"
import { createElement } from "react"
import { render, Box, Text, BaseBox, BaseText } from "../src/cli/ui/ink-app/ink"

// Mock TTY stdout that emulates a terminal grid so we can detect stale cells.
function createMockStdout(cols = 40, rows = 10) {
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(" "),
  )
  let cx = 0
  let cy = 0
  let savedX = 0
  let savedY = 0
  let output = ""

  const ESC = "\x1b"
  let i = 0
  function process(data: string) {
    output += data
    while (i < output.length) {
      const ch = output[i]!
      if (ch === ESC) {
        // CSI
        if (output[i + 1] === "[") {
          let j = i + 2
          let params = ""
          while (j < output.length && !((output.charCodeAt(j) >= 0x40 && output.charCodeAt(j) <= 0x7e))) {
            params += output[j]
            j++
          }
          if (j >= output.length) break // incomplete
          const final = output[j]!
          const nums = params.startsWith("?")
            ? params.slice(1).split(";").map(Number)
            : params.split(";").map(Number)
          if (final === "H" || final === "f") {
            cy = (nums[0] || 1) - 1
            cx = (nums[1] || 1) - 1
          } else if (final === "A") cy = Math.max(0, cy - (nums[0] || 1))
          else if (final === "B") cy = Math.min(rows - 1, cy + (nums[0] || 1))
          else if (final === "C") cx = Math.min(cols, cx + (nums[0] || 1))
          else if (final === "D") cx = Math.max(0, cx - (nums[0] || 1))
          else if (final === "G") cx = (nums[0] || 1) - 1
          else if (final === "J") {
            // erase display
            if ((nums[0] || 0) === 2) {
              for (let y = 0; y < rows; y++) grid[y]!.fill(" ")
            }
          } else if (final === "K") {
            const mode = nums[0] || 0
            if (mode === 0) {
              for (let x = cx; x < cols; x++) grid[cy]![x] = " "
            }
          } else if (final === "S") {
            const n = nums[0] || 1
            for (let k = 0; k < n; k++) {
              grid.shift()
              grid.push(Array(cols).fill(" "))
            }
          } else if (final === "T") {
            const n = nums[0] || 1
            for (let k = 0; k < n; k++) {
              grid.pop()
              grid.unshift(Array(cols).fill(" "))
            }
          } else if (final === "s") { savedX = cx; savedY = cy }
          else if (final === "u") { cx = savedX; cy = savedY }
          // ignore others (SGR m, etc.)
          i = j + 1
          continue
        }
        // OSC
        if (output[i + 1] === "]") {
          const end = output.indexOf("\x07", i)
          if (end === -1) break
          i = end + 1
          continue
        }
        i += 2
        continue
      }
      if (ch === "\r") { cx = 0; i++; continue }
      if (ch === "\n") { cy = Math.min(rows - 1, cy + 1); i++; continue }
      if (ch === "\x07") { i++; continue }
      // printable
      if (cx < cols && cy < rows) grid[cy]![cx] = ch
      cx++
      if (cx >= cols) cx = cols // pending wrap approximation
      i++
    }
    output = output.slice(i)
    i = 0
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
    emit(ev: string) { for (const cb of listeners[ev] ?? []) cb() },
  }
  return { stdout, grid }
}

function gridText(grid: string[][], y: number): string {
  return grid[y]!.join("").replace(/\s+$/, "")
}

describe("stale-cell ghost repro", () => {
  test("deleting characters from a line leaves no ghost chars", async () => {
    const { stdout, grid } = createMockStdout(40, 10)
    const instance = await render(
      createElement(BaseBox, null,
        createElement(BaseText, null, "hello world this is long")),
      { stdout: stdout as any, stdin: { isRaw: false } as any, exitOnCtrlC: false, patchConsole: false },
    )

    await new Promise(r => setTimeout(r, 50))
    console.log("frame1 row0:", JSON.stringify(gridText(grid, 0)))

    instance.rerender(
      createElement(BaseBox, null,
        createElement(BaseText, null, "hello")),
    )
    await new Promise(r => setTimeout(r, 50))
    console.log("frame2 row0:", JSON.stringify(gridText(grid, 0)))
    console.log("full grid after shrink:")
    for (let y = 0; y < 5; y++) console.log(`  ${y}: ${JSON.stringify(grid[y]!.join(""))}`)

    expect(gridText(grid, 0)).toBe("hello")
    instance.unmount()
  }, 10000)
})
