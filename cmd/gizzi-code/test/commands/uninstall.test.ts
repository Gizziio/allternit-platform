import { describe, expect, test } from "bun:test"
import {
  cleanShellConfigContent,
  removeMarkedBlock,
  SHELL_BLOCK_BEGIN,
  SHELL_BLOCK_END,
  POWERSHELL_BLOCK_BEGIN,
  POWERSHELL_BLOCK_END,
} from "../../src/cli/commands/uninstallShellConfig"

describe("cleanShellConfigContent", () => {
  test("removes only the marked block, preserving surrounding content", () => {
    const content = [
      "export EDITOR=vim",
      "",
      SHELL_BLOCK_BEGIN,
      "export PATH=$HOME/.gizzi/bin:$PATH",
      SHELL_BLOCK_END,
      "",
      "alias gs='git status'",
      "",
    ].join("\n")

    const { output, result } = cleanShellConfigContent(content)
    expect(result.status).toBe("cleaned")
    expect(output).toBe(["export EDITOR=vim", "", "alias gs='git status'", ""].join("\n"))
  })

  test("removes multiple marked blocks", () => {
    const content = [
      SHELL_BLOCK_BEGIN,
      "export PATH=$HOME/.gizzi/bin:$PATH",
      SHELL_BLOCK_END,
      "other",
      SHELL_BLOCK_BEGIN,
      "fish_add_path $HOME/.gizzi/bin",
      SHELL_BLOCK_END,
    ].join("\n")

    const { output, result } = cleanShellConfigContent(content)
    expect(result.status).toBe("cleaned")
    expect(output).toBe("other\n")
  })

  test("leaves the file untouched when markers are absent", () => {
    const content = "export PATH=$HOME/bin:$PATH\nalias gs='git status'\n"
    const { output, result } = cleanShellConfigContent(content)
    expect(output).toBeNull()
    expect(result).toEqual({ status: "no-markers", gizziReferences: false })
  })

  test("leaves gizzi-referencing files without markers untouched and reports references", () => {
    const content = "export PATH=$HOME/.gizzi/bin:$PATH # added by hand\n"
    const { output, result } = cleanShellConfigContent(content)
    expect(output).toBeNull()
    expect(result).toEqual({ status: "no-markers", gizziReferences: true })
  })

  test("leaves the file untouched when the begin marker has no end marker", () => {
    const content = ["before", SHELL_BLOCK_BEGIN, "export PATH=$HOME/.gizzi/bin:$PATH"].join("\n")
    const { output, result } = cleanShellConfigContent(content)
    expect(output).toBeNull()
    expect(result.status).toBe("unbalanced-begin")
  })

  test("removes the legacy bare-comment pair written by older installers", () => {
    const content = [
      "export EDITOR=vim",
      "",
      "# gizzi-code",
      "export PATH=$HOME/.gizzi/bin:$PATH",
      "",
      "alias gs='git status'",
    ].join("\n")

    const { output, result } = cleanShellConfigContent(content)
    expect(result.status).toBe("cleaned")
    expect(output).toBe(["export EDITOR=vim", "", "alias gs='git status'"].join("\n") + "\n")
  })

  test("does not remove a legacy comment when the next line is not a gizzi PATH line", () => {
    const content = ["# gizzi-code", "echo hello"].join("\n")
    const { output, result } = cleanShellConfigContent(content)
    // Comment is still installer-owned and removed; the user line stays.
    expect(result.status).toBe("cleaned")
    expect(output).toBe("echo hello\n")
  })

  test("does not touch user lines that merely mention .gizzi inside a marked file", () => {
    const content = [
      SHELL_BLOCK_BEGIN,
      "export PATH=$HOME/.gizzi/bin:$PATH",
      SHELL_BLOCK_END,
      'export GIZZI_OPTS="--workspace ~/.gizzi"',
    ].join("\n")

    const { output, result } = cleanShellConfigContent(content)
    expect(result.status).toBe("cleaned")
    expect(output).toBe('export GIZZI_OPTS="--workspace ~/.gizzi"\n')
  })

  test("empty file is a no-op", () => {
    const { output, result } = cleanShellConfigContent("")
    expect(output).toBeNull()
    expect(result).toEqual({ status: "no-markers", gizziReferences: false })
  })
})

describe("removeMarkedBlock (PowerShell $PROFILE discipline)", () => {
  test("removes only the marked block from a profile with other content", () => {
    const content = [
      "$env:EDITOR = 'vim'",
      POWERSHELL_BLOCK_BEGIN,
      '$env:Path = "$env:LOCALAPPDATA\\gizzi;" + $env:Path',
      POWERSHELL_BLOCK_END,
      "Set-Alias gs git-status",
      "",
    ].join("\n")

    const { output, result } = removeMarkedBlock(
      content,
      POWERSHELL_BLOCK_BEGIN,
      POWERSHELL_BLOCK_END,
    )
    expect(result.status).toBe("cleaned")
    expect(output).toBe(["$env:EDITOR = 'vim'", "Set-Alias gs git-status", ""].join("\n"))
  })

  test("leaves an unmarked profile untouched even when it mentions gizzi", () => {
    const content = '$env:Path = "$env:LOCALAPPDATA\\gizzi;" + $env:Path\n'
    const { output, result } = removeMarkedBlock(
      content,
      POWERSHELL_BLOCK_BEGIN,
      POWERSHELL_BLOCK_END,
    )
    expect(output).toBeNull()
    expect(result).toEqual({ status: "no-markers", gizziReferences: true })
  })

  test("leaves the profile untouched when the begin marker is unbalanced", () => {
    const content = [POWERSHELL_BLOCK_BEGIN, "Write-Host 'gizzi'"].join("\n")
    const { output, result } = removeMarkedBlock(
      content,
      POWERSHELL_BLOCK_BEGIN,
      POWERSHELL_BLOCK_END,
    )
    expect(output).toBeNull()
    expect(result.status).toBe("unbalanced-begin")
  })
})
