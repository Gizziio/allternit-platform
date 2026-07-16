# Embedded computer-use driver

`npm run prepare:cua-driver` places the pinned, checksum-verified Cua Driver
binary here during desktop packaging. The executable is launched directly by
the signed Allternit app with `CUA_DRIVER_EMBEDDED=1`; it must never be opened
through LaunchServices or independently installed for a production build.

Upstream: https://github.com/trycua/cua (MIT)

The packaged process remains part of Allternit's macOS responsibility chain,
so Accessibility and Screen Recording appear once under Allternit Desktop.
