import { describe, expect, test } from "bun:test"
import { nativeAssetPackage, nativeAssetRoot } from "../../script/native-assets.mjs"

describe("native sidecar packaging", () => {
  test("selects the platform-specific Parcel binding", () => {
    expect(nativeAssetPackage("darwin-arm64")).toBe("@parcel/watcher-darwin-arm64")
    expect(nativeAssetPackage("linux-x64")).toBe("@parcel/watcher-linux-x64-glibc")
    expect(nativeAssetPackage("win32-x64")).toBe("@parcel/watcher-win32-x64")
  })

  test("keeps native assets beside, not inside, the executable", () => {
    expect(nativeAssetRoot("/release", "darwin-arm64")).toBe("/release/native-assets/darwin-arm64/node_modules")
  })
})

