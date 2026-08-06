/** node:child_process shim — vendored diagnostics only (macOS `sample`). */
export function execFile(
  _file: string,
  _args?: readonly string[],
  callback?: (error: Error | null, stdout?: string, stderr?: string) => void,
): void {
  callback?.(null, '', '')
}
export function spawn(): never {
  throw new Error('child_process.spawn is not available in the browser build')
}
