import { describe, test, expect } from "bun:test"
import { createElement as h } from "react"
import { render, BaseBox, BaseText } from "../../src/cli/ui/ink-app/ink"
import { AlternateScreen } from "../../src/cli/ui/ink-app/ink/components/AlternateScreen"
import instances from "../../src/cli/ui/ink-app/ink/instances"

// Regression test for the stale-cell "ghost" bug in the non-TTY full-frame
// render path (LogUpdate.renderFullFrame in ink/log-update.ts).
//
// When stdout is not a TTY (e.g. `gizzi 2>&1 | tee log`), the interactive
// TUI still runs — stdin is recovered from /dev/tty and every frame is
// emitted whole via renderFullFrame, anchored by ink.tsx (CSI H before, park
// patch after). But renderFullFrame trimEnd()s each row, so a row that
// shrinks between frames only overwrote its new (shorter) prefix and the
// terminal kept the old tail — the ghost. Every keystroke during a delete
// burst re-landed the fake block cursor (▌) at a new column, leaving a run
// of stale ▌s and text fragments on the row.
//
// The fix appends CSI K (erase to end of line) after each row's content in
// renderFullFrame. This test drives the real render() pipeline with an
// isTTY:false stdout feeding a terminal-grid emulator, renders a
// TextInput-like line inside a bordered full-width Box (mirroring the
// dashboard dispatch input), shrinks it across frames like a BSpace burst,
// and asserts the terminal grid ends with no stale cells.

const ESC = "\x1b"
const CSI_K = "\x1b[K"

/** Minimal terminal-grid emulator: tracks cells, honors CSI H/K, CR, LF. */
function makeGrid(cols: number, rows: number) {
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(" "),
  )
  let cx = 0
  let cy = 0
  let pending = ""

  const process = (data: string): void => {
    pending += data
    let i = 0
    while (i < pending.length) {
      const ch = pending[i]!
      if (ch === ESC) {
        // Incomplete sequence at end of chunk — wait for more data.
        if (i + 1 >= pending.length) break
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
          // 'h'/'l' (alt screen, mouse, etc.) and unknown CSI: no-op
          i = j + 1
          continue
        }
        if (pending[i + 1] === "]") {
          const bel = pending.indexOf("\x07", i)
          const st = pending.indexOf("\x1b\\", i)
          const end = bel === -1 ? st : st === -1 ? bel : Math.min(bel, st)
          if (end === -1) break
          i = end + (end === st ? 2 : 1)
          continue
        }
        // Unknown escape — skip introducer and command byte.
        i += 2
        continue
      }
      if (ch === "\r") { cx = 0; i++; continue }
      // The live repro's pty has ONLCR set (cooked-mode line discipline):
      // every \n written through the pipe arrives as \r\n, so rows restart
      // at column 0.
      if (ch === "\n") { cx = 0; cy = Math.min(rows - 1, cy + 1); i++; continue }
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
    isTTY: false, // the bug only manifests on the non-TTY full-frame path
    write(data: any) { process(String(data)); return true },
    on(ev: string, cb: () => void) { (listeners[ev] ??= []).push(cb) },
    off() {},
    removeListener() {},
    cursorTo() {},
    clearLine() {},
    clearScreenDown() {},
  }

  return {
    grid,
    stdout,
    row: (y: number) => grid[y]!.join(""),
  }
}

describe("non-TTY full-frame render (piped stdout)", () => {
  test("shrinking a TextInput-like row inside a Box leaves no ghost cells", async () => {
    // Pane is deliberately wider than the frame (like the live repro: 220-col
    // tmux pane, 80-col frame) so rows never hit the right-margin pending-wrap
    // ambiguity.
    const cols = 80
    const rows = 8
    const { grid, stdout, row } = makeGrid(cols, rows)

    // Mirror the dashboard layout from the live repro: plain rows — a title
    // and the input row ` ❯ <draft>▌` (▌ = fake block cursor, as in
    // DashboardScreen). The input row shrinks as the draft shrinks, with no
    // padding or border to hide stale tails behind.
    const node = (draft: string) =>
      h(
        AlternateScreen,
        { mouseTracking: false },
        h(
          BaseBox,
          { flexDirection: "column" },
          h(BaseText, null, " Gizzi Code · Dashboard"),
          h(BaseText, null, ` ❯ ${draft}▌`),
        ),
      )

    const longDraft =
      "ghost-test-abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMN"

    // Boot with a placeholder so the instance exists, then register it under
    // process.stdout — <AlternateScreen> resolves the ink instance via
    // instances.get(process.stdout) (in production ink's stdout IS
    // process.stdout). Without this its mount effect can't set alt-screen
    // active and frames lose the CSI H + park anchoring of the live repro.
    const instance = await render(h(BaseText, null, "boot"), {
      stdout: stdout as any,
      stdin: { isRaw: false } as any,
      exitOnCtrlC: false,
      patchConsole: false,
    })
    instances.set(process.stdout as any, instances.get(stdout as any)!)
    instance.rerender(node(longDraft))
    await new Promise(r => setTimeout(r, 60))

    // Simulate the BSpace burst: shrink one char at a time down to "gho".
    for (let len = longDraft.length - 1; len >= 3; len--) {
      instance.rerender(node(longDraft.slice(0, len)))
      await new Promise(r => setTimeout(r, 8))
    }
    await new Promise(r => setTimeout(r, 120))

    // The input row is row 1 (row 0 = title). It must read exactly the final
    // draft + cursor — no stale characters past the end.
    expect(row(1).replace(/\s+$/, "")).toBe(" ❯ gho▌")
    expect(row(0).replace(/\s+$/, "")).toBe(" Gizzi Code · Dashboard")

    // No cell anywhere in the grid may hold a stale fragment of the draft.
    const whole = grid.map(r => r.join("")).join("\n")
    expect(whole).not.toContain("ghost-test")
    expect(whole).not.toContain("▌▌")

    instance.unmount()
    instances.delete(process.stdout as any)
  }, 15000)

  test("renderFullFrame emits erase-to-EOL after each row", async () => {
    // Pin the mechanism directly: the serialized non-TTY frame must carry a
    // per-row CSI K so re-landed frames fully replace prior row content.
    const cols = 40
    const rows = 4
    let captured = ""
    const listeners: Record<string, Array<() => void>> = {}
    const stdout = {
      columns: cols,
      rows,
      isTTY: false,
      write(data: any) { captured += String(data); return true },
      on(ev: string, cb: () => void) { (listeners[ev] ??= []).push(cb) },
      off() {},
      removeListener() {},
      cursorTo() {},
      clearLine() {},
      clearScreenDown() {},
    }

    const instance = await render(
      h(
        BaseBox,
        { flexDirection: "column" },
        h(BaseText, null, "short"),
        h(BaseText, null, ""),
        h(BaseText, null, "long line that will shrink"),
      ),
      {
        stdout: stdout as any,
        stdin: { isRaw: false } as any,
        exitOnCtrlC: false,
        patchConsole: false,
      },
    )
    await new Promise(r => setTimeout(r, 80))
    instance.unmount()

    // One CSI K per content row (3 rows), placed after the row's text.
    expect(captured).toContain(`short${CSI_K}`)
    expect(captured).toContain(`long line that will shrink${CSI_K}`)
  }, 10000)
})
