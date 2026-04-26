export function win32DisableProcessedInput(): void {}

export function win32InstallCtrlCGuard(): (() => void) | undefined {
  return undefined
}

export function win32FlushInputBuffer(): void {}
