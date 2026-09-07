# Embedded computer-use driver

`npm run prepare:cua-driver` places the pinned, checksum-verified Cua Driver
binary under a platform folder during desktop packaging:

- `darwin/cua-driver`
- `linux/cua-driver`
- `win32/cua-driver.exe`

electron-builder copies only the matching folder into `computer-use/` of that
OS installer. The executable is launched directly by Allternit Desktop with
`CUA_DRIVER_EMBEDDED=1`; it must never be opened through LaunchServices or
independently installed for a production build.

Upstream: https://github.com/trycua/cua (MIT)

On macOS the packaged process remains part of Allternit's responsibility chain,
so Accessibility and Screen Recording appear once under Allternit Desktop.
