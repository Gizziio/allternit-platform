import { createHash } from "node:crypto"
import { cp, mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { dirname, join, relative, resolve } from "node:path"

const requireFromHere = createRequire(import.meta.url)

const PARCEL_PACKAGE_BY_TARGET = Object.freeze({
  "darwin-arm64": "@parcel/watcher-darwin-arm64",
  "darwin-x64": "@parcel/watcher-darwin-x64",
  "linux-arm64": "@parcel/watcher-linux-arm64-glibc",
  "linux-x64": "@parcel/watcher-linux-x64-glibc",
  "win32-x64": "@parcel/watcher-win32-x64",
})

export function nativeAssetPackage(target) {
  const name = PARCEL_PACKAGE_BY_TARGET[target]
  if (!name) throw new Error(`Unsupported native asset target: ${target}`)
  return name
}

export function nativeAssetRoot(outDir, target) {
  return resolve(outDir, "native-assets", target, "node_modules")
}

export async function copyNativeAssets({ outDir, target }) {
  const packageName = nativeAssetPackage(target)
  const packageRoot = await resolvePackageRoot(packageName)
  const destination = join(nativeAssetRoot(outDir, target), ...packageName.split("/"))
  await mkdir(dirname(destination), { recursive: true })
  await cp(packageRoot, destination, { recursive: true, force: true, dereference: true })

  const files = await manifestFiles(destination)
  const manifest = {
    version: 1,
    target,
    packages: [{ name: packageName, root: relative(resolve(outDir), destination), files }],
  }
  const manifestPath = resolve(outDir, "native-assets", target, "manifest.json")
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return { manifestPath, packageName, files: files.length }
}

async function resolvePackageRoot(packageName) {
  let current = dirname(requireFromHere.resolve(packageName))
  while (current !== dirname(current)) {
    try {
      const info = await stat(join(current, "package.json"))
      if (info.isFile()) return current
    } catch {}
    current = dirname(current)
  }
  throw new Error(`Unable to resolve native package root for ${packageName}`)
}

async function manifestFiles(root) {
  const glob = new Bun.Glob("**/*")
  const entries = []
  for await (const name of glob.scan({ cwd: root, onlyFiles: true, dot: true })) {
    const bytes = await readFile(join(root, name))
    entries.push({ path: name.replaceAll("\\", "/"), sha256: createHash("sha256").update(bytes).digest("hex") })
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path))
}

