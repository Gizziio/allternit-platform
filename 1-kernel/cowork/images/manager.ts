/**
 * VM Image Manager
 *
 * Production-ready image management system for downloading, building, and caching
 * VM images for the a2r-platform VM executor.
 *
 * @module VMImageManager
 * @version 1.0.0
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as stream from "stream";
import * as util from "util";
import { spawn, exec } from "child_process";

const pipeline = util.promisify(stream.pipeline);

// =============================================================================
// CONSTANTS
// =============================================================================

/** Base URL for GitHub releases */
export const RELEASES_URL = "https://github.com/a2r-platform/vm-images/releases";

/** API URL for GitHub releases */
export const GITHUB_API_URL = "https://api.github.com/repos/a2r-platform/vm-images/releases";

/** Default cache directory */
export const DEFAULT_CACHE_DIR = path.join(os.homedir(), ".a2r", "images");

/** Minimum free space required (2GB) */
export const MIN_FREE_SPACE = 2 * 1024 * 1024 * 1024;

/** Maximum concurrent downloads */
export const MAX_CONCURRENT_DOWNLOADS = 3;

/** Download chunk size for resume support (1MB) */
export const DOWNLOAD_CHUNK_SIZE = 1024 * 1024;

/** Request timeout in milliseconds */
export const REQUEST_TIMEOUT = 30000;

/** Maximum retry attempts */
export const MAX_RETRIES = 3;

/** Retry delay in milliseconds */
export const RETRY_DELAY = 1000;

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

/** Supported CPU architectures */
export type Architecture = "x86_64" | "arm64";

/** Supported image components */
export type ImageComponent = "kernel" | "initrd" | "rootfs";

/** Supported Ubuntu versions for building */
export type UbuntuVersion = "20.04" | "22.04" | "24.04";

/** Image metadata structure */
export interface ImageMetadata {
  /** Version string (e.g., "1.1.0") */
  version: string;
  /** CPU architecture */
  architecture: Architecture;
  /** Ubuntu version for rootfs */
  ubuntuVersion: UbuntuVersion;
  /** Kernel version string */
  kernelVersion: string;
  /** Image size in bytes */
  size: number;
  /** SHA256 checksums for components */
  checksums: Record<ImageComponent, string>;
  /** Build timestamp */
  builtAt: string;
  /** a2r-vm-executor version included */
  executorVersion: string;
  /** Included toolchains */
  toolchains: string[];
  /** Additional metadata */
  labels?: Record<string, string>;
}

/** Download options */
export interface DownloadOptions {
  /** Version to download */
  version: string;
  /** Target architecture */
  architecture: Architecture;
  /** Components to download */
  components: ImageComponent[];
  /** Progress callback */
  onProgress?: (downloaded: number, total: number) => void;
  /** Force re-download even if cached */
  force?: boolean;
}

/** Build options */
export interface BuildOptions {
  /** Ubuntu version to build */
  ubuntuVersion: UbuntuVersion;
  /** Target architecture */
  architecture: Architecture;
  /** Additional packages to install */
  packages?: string[];
  /** Include development toolchains */
  includeToolchains?: boolean;
  /** Output directory for built images */
  outputDir: string;
  /** Version string for the build */
  version?: string;
  /** Kernel version to use */
  kernelVersion?: string;
}

/** Manager configuration options */
export interface ManagerOptions {
  /** Cache directory path */
  cacheDir?: string;
  /** Maximum cache size in bytes */
  maxCacheSize?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** GitHub API token for higher rate limits */
  githubToken?: string;
  /** Custom releases URL */
  releasesUrl?: string;
}

/** Image entry in cache */
export interface CachedImage {
  /** Version string */
  version: string;
  /** Architecture */
  architecture: Architecture;
  /** Path to metadata file */
  metadataPath: string;
  /** Path to kernel image */
  kernelPath?: string;
  /** Path to initrd */
  initrdPath?: string;
  /** Path to rootfs */
  rootfsPath?: string;
  /** Last accessed timestamp */
  lastAccessed: number;
  /** Total size in bytes */
  totalSize: number;
}

/** Download state for resume support */
interface DownloadState {
  url: string;
  tempPath: string;
  finalPath: string;
  downloadedBytes: number;
  totalBytes: number;
  checksum: string;
  retries: number;
}

/** GitHub release asset */
interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

/** GitHub release */
interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: GitHubAsset[];
  prerelease: boolean;
  draft: boolean;
}

/** Progress info for downloads */
interface ProgressInfo {
  component: ImageComponent;
  downloaded: number;
  total: number;
}

// =============================================================================
// ERROR CLASSES
// =============================================================================

/** Base error class for VM Image Manager */
export class VMImageError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "VMImageError";
  }
}

/** Network-related errors */
export class NetworkError extends VMImageError {
  constructor(message: string, public statusCode?: number) {
    super(message, "NETWORK_ERROR");
    this.name = "NetworkError";
  }
}

/** Checksum verification errors */
export class ChecksumError extends VMImageError {
  constructor(expected: string, actual: string) {
    super(`Checksum mismatch: expected ${expected}, got ${actual}`, "CHECKSUM_ERROR");
    this.name = "ChecksumError";
  }
}

/** Platform incompatibility errors */
export class PlatformError extends VMImageError {
  constructor(message: string) {
    super(message, "PLATFORM_ERROR");
    this.name = "PlatformError";
  }
}

/** Disk space errors */
export class DiskSpaceError extends VMImageError {
  constructor(required: number, available: number) {
    super(
      `Insufficient disk space: required ${formatBytes(required)}, available ${formatBytes(available)}`,
      "DISK_SPACE_ERROR"
    );
    this.name = "DiskSpaceError";
  }
}

/** Image not found errors */
export class ImageNotFoundError extends VMImageError {
  constructor(version: string, arch: Architecture) {
    super(`Image not found: version ${version} for ${arch}`, "IMAGE_NOT_FOUND");
    this.name = "ImageNotFoundError";
  }
}

/** Build errors */
export class BuildError extends VMImageError {
  constructor(message: string, public command?: string, public exitCode?: number) {
    super(message, "BUILD_ERROR");
    this.name = "BuildError";
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Expand tilde in path to home directory
 */
function expandPath(inputPath: string): string {
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

/**
 * Calculate SHA256 checksum of a file
 */
async function calculateChecksum(filePath: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const fileStream = fs.createReadStream(filePath);

  return new Promise((resolve, reject) => {
    fileStream.on("data", (chunk) => hash.update(chunk));
    fileStream.on("end", () => resolve(hash.digest("hex")));
    fileStream.on("error", reject);
  });
}

/**
 * Check available disk space
 */
async function checkDiskSpace(dir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    exec(`df -B1 "${dir}" | tail -1 | awk '{print $4}'`, (error, stdout) => {
      if (error) {
        reject(error);
      } else {
        resolve(parseInt(stdout.trim(), 10));
      }
    });
  });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout and retry logic
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries: number = MAX_RETRIES
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        await sleep(RETRY_DELAY * Math.pow(2, attempt));
      }
    }
  }

  throw lastError;
}

/**
 * Detect if running on Linux
 */
function isLinux(): boolean {
  return os.platform() === "linux";
}

/**
 * Detect system architecture
 */
function detectArchitecture(): Architecture {
  const arch = os.arch();
  if (arch === "x64") return "x86_64";
  if (arch === "arm64") return "arm64";
  throw new PlatformError(`Unsupported architecture: ${arch}`);
}

// =============================================================================
// VM IMAGE MANAGER CLASS
// =============================================================================

/**
 * VM Image Manager
 *
 * Manages downloading, building, and caching of VM images for the a2r-platform.
 *
 * @example
 * ```typescript
 * const manager = new VMImageManager({
 *   cacheDir: "~/.a2r/images",
 *   debug: true,
 * });
 *
 * // Download pre-built image
 * await manager.download({
 *   version: "1.1.0",
 *   architecture: "arm64",
 *   components: ["kernel", "initrd", "rootfs"],
 *   onProgress: (downloaded, total) => {
 *     console.log(`${(downloaded / total * 100).toFixed(1)}%`);
 *   },
 * });
 *
 * // Or build from scratch (Linux only)
 * await manager.build({
 *   ubuntuVersion: "22.04",
 *   architecture: "arm64",
 *   packages: ["nodejs", "npm", "python3"],
 *   includeToolchains: true,
 *   outputDir: "~/.a2r/images",
 * });
 * ```
 */
export class VMImageManager {
  private readonly cacheDir: string;
  private readonly maxCacheSize: number;
  private readonly debug: boolean;
  private readonly githubToken?: string;
  private readonly releasesUrl: string;
  private readonly activeDownloads: Map<string, DownloadState> = new Map();

  /**
   * Create a new VMImageManager instance
   *
   * @param options - Configuration options
   */
  constructor(options: ManagerOptions = {}) {
    this.cacheDir = expandPath(options.cacheDir || DEFAULT_CACHE_DIR);
    this.maxCacheSize = options.maxCacheSize || 10 * 1024 * 1024 * 1024; // 10GB default
    this.debug = options.debug || false;
    this.githubToken = options.githubToken;
    this.releasesUrl = options.releasesUrl || RELEASES_URL;

    this.ensureCacheDir();
  }

  /**
   * Log debug message
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.debug) {
      console.log(`[VMImageManager] ${message}`, ...args);
    }
  }

  /**
   * Ensure cache directory exists
   */
  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      this.log(`Created cache directory: ${this.cacheDir}`);
    }
  }

  /**
   * Get the file name for a kernel image
   *
   * @param version - Kernel version
   * @param arch - Architecture
   * @returns File name
   */
  private getKernelFileName(version: string, arch: Architecture): string {
    return `vmlinux-${version}-${arch}`;
  }

  /**
   * Get the file name for an initrd image
   *
   * @param version - Version
   * @param arch - Architecture
   * @returns File name
   */
  private getInitrdFileName(version: string, arch: Architecture): string {
    return `initrd.img-${version}-${arch}`;
  }

  /**
   * Get the file name for a rootfs image
   *
   * @param ubuntuVersion - Ubuntu version
   * @param a2rVersion - a2r version
   * @param arch - Architecture
   * @returns File name
   */
  private getRootfsFileName(
    ubuntuVersion: UbuntuVersion,
    a2rVersion: string,
    arch: Architecture
  ): string {
    const archSuffix = arch === "x86_64" ? "x86_64" : "arm64";
    return `ubuntu-${ubuntuVersion}-a2r-v${a2rVersion}.${archSuffix}.ext4.zst`;
  }

  /**
   * Get the file name for metadata
   *
   * @param version - Version
   * @param arch - Architecture
   * @returns File name
   */
  private getMetadataFileName(version: string, arch: Architecture): string {
    return `version-${version}-${arch}.json`;
  }

  /**
   * Get full path for a file in cache
   */
  private getCachePath(fileName: string): string {
    return path.join(this.cacheDir, fileName);
  }

  /**
   * Download a single component with resume support
   *
   * @param state - Download state
   * @param onProgress - Progress callback
   */
  private async downloadComponent(
    state: DownloadState,
    onProgress?: (progress: ProgressInfo) => void
  ): Promise<void> {
    const headers: Record<string, string> = {
      Accept: "application/octet-stream",
    };

    // Resume from partial download
    if (state.downloadedBytes > 0 && fs.existsSync(state.tempPath)) {
      headers["Range"] = `bytes=${state.downloadedBytes}-`;
      this.log(`Resuming download from ${state.downloadedBytes} bytes`);
    }

    if (this.githubToken) {
      headers["Authorization"] = `Bearer ${this.githubToken}`;
    }

    const response = await fetchWithRetry(state.url, { headers });
    const totalBytes = parseInt(
      response.headers.get("content-length") || "0",
      10
    );
    state.totalBytes = totalBytes + state.downloadedBytes;

    // Check disk space
    const available = await checkDiskSpace(path.dirname(state.tempPath));
    if (available < totalBytes + MIN_FREE_SPACE) {
      throw new DiskSpaceError(totalBytes + MIN_FREE_SPACE, available);
    }

    // Stream download to temp file
    const fileStream = fs.createWriteStream(state.tempPath, {
      flags: state.downloadedBytes > 0 ? "a" : "w",
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new NetworkError("No response body");
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(value);
        state.downloadedBytes += value.length;

        if (onProgress) {
          onProgress({
            component: this.inferComponentFromUrl(state.url),
            downloaded: state.downloadedBytes,
            total: state.totalBytes,
          });
        }
      }
    } finally {
      fileStream.end();
      reader.releaseLock();
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    // Verify checksum
    this.log(`Verifying checksum for ${path.basename(state.finalPath)}`);
    const actualChecksum = await calculateChecksum(state.tempPath);
    if (actualChecksum !== state.checksum) {
      fs.unlinkSync(state.tempPath);
      throw new ChecksumError(state.checksum, actualChecksum);
    }

    // Move to final location
    fs.renameSync(state.tempPath, state.finalPath);
    this.log(`Download complete: ${path.basename(state.finalPath)}`);
  }

  /**
   * Infer component type from URL
   */
  private inferComponentFromUrl(url: string): ImageComponent {
    if (url.includes("vmlinux")) return "kernel";
    if (url.includes("initrd")) return "initrd";
    return "rootfs";
  }

  /**
   * Download images from GitHub releases
   *
   * @param options - Download options
   * @throws {ImageNotFoundError} If the requested version/architecture is not found
   * @throws {NetworkError} If network requests fail
   * @throws {ChecksumError} If checksum verification fails
   * @throws {DiskSpaceError} If insufficient disk space
   *
   * @example
   * ```typescript
   * await manager.download({
   *   version: "1.1.0",
   *   architecture: "arm64",
   *   components: ["kernel", "initrd", "rootfs"],
   *   onProgress: (downloaded, total) => {
   *     console.log(`Progress: ${(downloaded / total * 100).toFixed(1)}%`);
   *   },
   * });
   * ```
   */
  public async download(options: DownloadOptions): Promise<CachedImage> {
    const { version, architecture, components, onProgress, force } = options;

    this.log(
      `Downloading ${components.join(", ")} for ${architecture} v${version}`
    );

    // Check if already cached
    if (!force) {
      const cached = this.getCachedImage(version, architecture);
      if (cached) {
        const hasAllComponents = components.every((comp) => {
          if (comp === "kernel") return cached.kernelPath;
          if (comp === "initrd") return cached.initrdPath;
          return cached.rootfsPath;
        });
        if (hasAllComponents) {
          this.log(`Using cached image v${version} for ${architecture}`);
          return cached;
        }
      }
    }

    // Fetch release metadata
    const release = await this.fetchRelease(version);
    const metadataAsset = release.assets.find((a) =>
      a.name.includes(`version-${version}-${architecture}`)
    );

    if (!metadataAsset) {
      throw new ImageNotFoundError(version, architecture);
    }

    // Download metadata first
    const metadataPath = this.getCachePath(
      this.getMetadataFileName(version, architecture)
    );
    const metadataTempPath = `${metadataPath}.tmp`;

    await this.downloadFile(metadataAsset.browser_download_url, metadataTempPath);
    fs.renameSync(metadataTempPath, metadataPath);

    const metadata: ImageMetadata = JSON.parse(
      fs.readFileSync(metadataPath, "utf-8")
    );

    // Download requested components
    const downloads: Array<{
      component: ImageComponent;
      asset: GitHubAsset;
      checksum: string;
    }> = [];

    for (const component of components) {
      const asset = release.assets.find((a) =>
        this.matchesComponent(a.name, component, version, architecture)
      );

      if (!asset) {
        throw new VMImageError(
          `Component ${component} not found for ${architecture} v${version}`,
          "COMPONENT_NOT_FOUND"
        );
      }

      downloads.push({
        component,
        asset,
        checksum: metadata.checksums[component],
      });
    }

    // Track overall progress
    const progressMap = new Map<ImageComponent, ProgressInfo>();
    const totalProgress = { downloaded: 0, total: 0 };

    const wrappedOnProgress = (info: ProgressInfo) => {
      progressMap.set(info.component, info);

      totalProgress.downloaded = 0;
      totalProgress.total = 0;
      for (const p of progressMap.values()) {
        totalProgress.downloaded += p.downloaded;
        totalProgress.total += p.total;
      }

      if (onProgress) {
        onProgress(totalProgress.downloaded, totalProgress.total);
      }
    };

    // Execute downloads with concurrency limit
    const concurrentLimit = Math.min(
      MAX_CONCURRENT_DOWNLOADS,
      downloads.length
    );
    const downloadQueue = [...downloads];
    const activeDownloads: Promise<void>[] = [];

    for (let i = 0; i < concurrentLimit; i++) {
      if (downloadQueue.length > 0) {
        const item = downloadQueue.shift()!;
        activeDownloads.push(
          this.downloadComponentWithState(
            item,
            version,
            architecture,
            wrappedOnProgress
          )
        );
      }
    }

    await Promise.all(activeDownloads);

    // Verify final image
    const cached = await this.verifyAndCache(version, architecture, metadata);

    this.log(`Download complete for v${version} ${architecture}`);
    return cached;
  }

  /**
   * Download component with state tracking
   */
  private async downloadComponentWithState(
    item: {
      component: ImageComponent;
      asset: GitHubAsset;
      checksum: string;
    },
    version: string,
    architecture: Architecture,
    onProgress: (info: ProgressInfo) => void
  ): Promise<void> {
    const fileName = this.getComponentFileName(
      item.component,
      version,
      architecture
    );
    const tempPath = this.getCachePath(`.tmp-${fileName}`);
    const finalPath = this.getCachePath(fileName);

    const state: DownloadState = {
      url: item.asset.browser_download_url,
      tempPath,
      finalPath,
      downloadedBytes: 0,
      totalBytes: item.asset.size,
      checksum: item.checksum,
      retries: 0,
    };

    // Check for existing partial download
    if (fs.existsSync(tempPath)) {
      const stats = fs.statSync(tempPath);
      state.downloadedBytes = stats.size;
    }

    await this.downloadComponent(state, onProgress);
  }

  /**
   * Get component file name
   */
  private getComponentFileName(
    component: ImageComponent,
    version: string,
    architecture: Architecture
  ): string {
    switch (component) {
      case "kernel":
        return this.getKernelFileName(version, architecture);
      case "initrd":
        return this.getInitrdFileName(version, architecture);
      case "rootfs":
        // Rootfs includes Ubuntu version in name, use generic pattern
        return `ubuntu-*-a2r-v${version}.${architecture === "x86_64" ? "x86_64" : "arm64"}.ext4.zst`;
    }
  }

  /**
   * Check if asset name matches component
   */
  private matchesComponent(
    assetName: string,
    component: ImageComponent,
    version: string,
    architecture: Architecture
  ): boolean {
    switch (component) {
      case "kernel":
        return assetName.startsWith("vmlinux") && assetName.includes(architecture);
      case "initrd":
        return assetName.startsWith("initrd") && assetName.includes(architecture);
      case "rootfs":
        return (
          assetName.startsWith("ubuntu-") &&
          assetName.includes(`-a2r-v${version}`) &&
          (assetName.includes(architecture === "x86_64" ? "x86_64" : "arm64"))
        );
    }
  }

  /**
   * Download a file from URL
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    const response = await fetchWithRetry(url);
    const fileStream = fs.createWriteStream(destPath);

    if (!response.body) {
      throw new NetworkError("No response body");
    }

    await pipeline(response.body as unknown as stream.Readable, fileStream);
  }

  /**
   * Fetch release information from GitHub
   */
  private async fetchRelease(version: string): Promise<GitHubRelease> {
    const url = `${GITHUB_API_URL}/tags/v${version}`;
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "a2r-vm-image-manager/1.0.0",
    };

    if (this.githubToken) {
      headers["Authorization"] = `Bearer ${this.githubToken}`;
    }

    const response = await fetchWithRetry(url, { headers });
    return response.json();
  }

  /**
   * List all available versions from GitHub releases
   *
   * @param includePrerelease - Include prerelease versions
   * @returns Array of version strings
   */
  public async listAvailableVersions(
    includePrerelease: boolean = false
  ): Promise<string[]> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "a2r-vm-image-manager/1.0.0",
    };

    if (this.githubToken) {
      headers["Authorization"] = `Bearer ${this.githubToken}`;
    }

    const response = await fetchWithRetry(GITHUB_API_URL, { headers });
    const releases: GitHubRelease[] = await response.json();

    return releases
      .filter((r) => !r.draft && (includePrerelease || !r.prerelease))
      .map((r) => r.tag_name.replace(/^v/, ""));
  }

  /**
   * Check for updates to a specific version
   *
   * @param currentVersion - Current version string
   * @returns Latest version string or null if up to date
   */
  public async checkForUpdates(currentVersion: string): Promise<string | null> {
    const versions = await this.listAvailableVersions();
    const sorted = versions.sort((a, b) => {
      const partsA = a.split(".").map(Number);
      const partsB = b.split(".").map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const diff = (partsB[i] || 0) - (partsA[i] || 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });

    const latest = sorted[0];
    return latest !== currentVersion ? latest : null;
  }

  /**
   * Build VM images from scratch using debootstrap (Linux only)
   *
   * @param options - Build options
   * @throws {PlatformError} If called on non-Linux platform
   * @throws {BuildError} If build process fails
   * @throws {DiskSpaceError} If insufficient disk space
   *
   * @example
   * ```typescript
   * await manager.build({
   *   ubuntuVersion: "22.04",
   *   architecture: "arm64",
   *   packages: ["nodejs", "npm", "python3"],
   *   includeToolchains: true,
   *   outputDir: "~/.a2r/images",
   * });
   * ```
   */
  public async build(options: BuildOptions): Promise<CachedImage> {
    if (!isLinux()) {
      throw new PlatformError(
        "Building VM images is only supported on Linux. " +
          "Use download() to get pre-built images on other platforms."
      );
    }

    const {
      ubuntuVersion,
      architecture,
      packages = [],
      includeToolchains = false,
      outputDir,
      version = this.generateVersion(),
      kernelVersion = "6.5.0-a2r",
    } = options;

    const expandedOutputDir = expandPath(outputDir);

    this.log(
      `Building image: Ubuntu ${ubuntuVersion} ${architecture} v${version}`
    );

    // Check disk space (rough estimate: 5GB)
    const available = await checkDiskSpace(expandedOutputDir);
    if (available < MIN_FREE_SPACE * 3) {
      throw new DiskSpaceError(MIN_FREE_SPACE * 3, available);
    }

    // Check required tools
    await this.checkBuildTools();

    // Create build workspace
    const buildId = `build-${Date.now()}`;
    const workspaceDir = path.join(os.tmpdir(), "a2r-build", buildId);
    fs.mkdirSync(workspaceDir, { recursive: true });

    try {
      // Build rootfs using debootstrap
      const rootfsDir = path.join(workspaceDir, "rootfs");
      await this.runDebootstrap(ubuntuVersion, architecture, rootfsDir);

      // Install additional packages
      if (packages.length > 0 || includeToolchains) {
        await this.installPackages(rootfsDir, packages, includeToolchains);
      }

      // Install a2r-vm-executor
      await this.installExecutor(rootfsDir);

      // Create initrd
      const initrdPath = await this.createInitrd(workspaceDir, rootfsDir);

      // Compress rootfs
      const rootfsPath = await this.compressRootfs(
        workspaceDir,
        rootfsDir,
        ubuntuVersion,
        version,
        architecture
      );

      // Get or build kernel
      const kernelPath = await this.getKernel(workspaceDir, kernelVersion, architecture);

      // Generate metadata
      const metadata: ImageMetadata = {
        version,
        architecture,
        ubuntuVersion,
        kernelVersion,
        size: fs.statSync(rootfsPath).size,
        checksums: {
          kernel: await calculateChecksum(kernelPath),
          initrd: await calculateChecksum(initrdPath),
          rootfs: await calculateChecksum(rootfsPath),
        },
        builtAt: new Date().toISOString(),
        executorVersion: "1.0.0", // TODO: Get actual version
        toolchains: includeToolchains
          ? ["nodejs", "python3", "docker"]
          : [],
      };

      // Move artifacts to output directory
      const finalKernelPath = path.join(
        expandedOutputDir,
        this.getKernelFileName(kernelVersion, architecture)
      );
      const finalInitrdPath = path.join(
        expandedOutputDir,
        this.getInitrdFileName(kernelVersion, architecture)
      );
      const finalRootfsPath = path.join(
        expandedOutputDir,
        path.basename(rootfsPath)
      );
      const metadataPath = path.join(
        expandedOutputDir,
        this.getMetadataFileName(version, architecture)
      );

      fs.copyFileSync(kernelPath, finalKernelPath);
      fs.copyFileSync(initrdPath, finalInitrdPath);
      fs.copyFileSync(rootfsPath, finalRootfsPath);
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

      // Set permissions
      fs.chmodSync(finalKernelPath, 0o644);
      fs.chmodSync(finalInitrdPath, 0o644);
      fs.chmodSync(finalRootfsPath, 0o644);

      this.log(`Build complete: v${version} ${architecture}`);

      return {
        version,
        architecture,
        metadataPath,
        kernelPath: finalKernelPath,
        initrdPath: finalInitrdPath,
        rootfsPath: finalRootfsPath,
        lastAccessed: Date.now(),
        totalSize:
          fs.statSync(finalKernelPath).size +
          fs.statSync(finalInitrdPath).size +
          fs.statSync(finalRootfsPath).size,
      };
    } finally {
      // Cleanup workspace
      this.cleanupWorkspace(workspaceDir);
    }
  }

  /**
   * Generate version string
   */
  private generateVersion(): string {
    const date = new Date();
    return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}-${date.getTime()}`;
  }

  /**
   * Check for required build tools
   */
  private async checkBuildTools(): Promise<void> {
    const tools = ["debootstrap", "chroot", "mkfs.ext4", "zstd"];
    const missing: string[] = [];

    for (const tool of tools) {
      try {
        await this.execCommand("which", [tool]);
      } catch {
        missing.push(tool);
      }
    }

    if (missing.length > 0) {
      throw new BuildError(
        `Missing required tools: ${missing.join(", ")}. ` +
          "Install with: sudo apt-get install debootstrap e2fsprogs zstd"
      );
    }
  }

  /**
   * Run debootstrap to create base rootfs
   */
  private async runDebootstrap(
    ubuntuVersion: UbuntuVersion,
    architecture: Architecture,
    rootfsDir: string
  ): Promise<void> {
    this.log(`Running debootstrap for Ubuntu ${ubuntuVersion} ${architecture}`);

    const debianArch = architecture === "x86_64" ? "amd64" : "arm64";
    const suite = `ubuntu-${ubuntuVersion}`;

    // Use mirror based on architecture
    const mirror =
      architecture === "arm64"
        ? "http://ports.ubuntu.com/ubuntu-ports"
        : "http://archive.ubuntu.com/ubuntu";

    await this.execCommand("sudo", [
      "debootstrap",
      "--arch",
      debianArch,
      "--variant=minbase",
      ubuntuVersion,
      rootfsDir,
      mirror,
    ]);

    this.log("Debootstrap complete");
  }

  /**
   * Install packages into rootfs
   */
  private async installPackages(
    rootfsDir: string,
    packages: string[],
    includeToolchains: boolean
  ): Promise<void> {
    this.log("Installing packages...");

    const allPackages = [...packages];

    if (includeToolchains) {
      allPackages.push(
        "nodejs",
        "npm",
        "python3",
        "python3-pip",
        "docker.io",
        "curl",
        "wget",
        "git",
        "build-essential"
      );
    }

    // Mount proc, sys, dev for chroot
    await this.setupChroot(rootfsDir);

    try {
      // Update package list
      await this.execCommand("sudo", [
        "chroot",
        rootfsDir,
        "apt-get",
        "update",
      ]);

      // Install packages
      await this.execCommand("sudo", [
        "chroot",
        rootfsDir,
        "apt-get",
        "install",
        "-y",
        "--no-install-recommends",
        ...allPackages,
      ]);

      // Clean up
      await this.execCommand("sudo", [
        "chroot",
        rootfsDir,
        "apt-get",
        "clean",
      ]);

      // Remove apt cache
      await this.execCommand("sudo", [
        "rm",
        "-rf",
        path.join(rootfsDir, "var/lib/apt/lists/*"),
      ]);
    } finally {
      await this.teardownChroot(rootfsDir);
    }

    this.log("Package installation complete");
  }

  /**
   * Setup chroot environment
   */
  private async setupChroot(rootfsDir: string): Promise<void> {
    const mounts = [
      { src: "/proc", dst: path.join(rootfsDir, "proc"), type: "proc" },
      { src: "/sys", dst: path.join(rootfsDir, "sys"), type: "sysfs" },
      { src: "/dev", dst: path.join(rootfsDir, "dev"), type: "bind" },
    ];

    for (const mount of mounts) {
      fs.mkdirSync(mount.dst, { recursive: true });
      if (mount.type === "bind") {
        await this.execCommand("sudo", [
          "mount",
          "--bind",
          mount.src,
          mount.dst,
        ]);
      } else {
        await this.execCommand("sudo", [
          "mount",
          "-t",
          mount.type,
          mount.type,
          mount.dst,
        ]);
      }
    }
  }

  /**
   * Teardown chroot environment
   */
  private async teardownChroot(rootfsDir: string): Promise<void> {
    const mounts = ["proc", "sys", "dev"];

    for (const mount of mounts) {
      try {
        await this.execCommand("sudo", [
          "umount",
          path.join(rootfsDir, mount),
        ]);
      } catch {
        // Ignore unmount errors
      }
    }
  }

  /**
   * Install a2r-vm-executor into rootfs
   */
  private async installExecutor(rootfsDir: string): Promise<void> {
    this.log("Installing a2r-vm-executor...");

    // Create executor directory
    const executorDir = path.join(rootfsDir, "opt", "a2r-executor");
    fs.mkdirSync(executorDir, { recursive: true });

    // TODO: Download actual executor binary
    // For now, create a placeholder script
    const executorScript = `#!/bin/bash
echo "a2r-vm-executor v1.0.0"
`;
    fs.writeFileSync(path.join(executorDir, "executor"), executorScript);
    fs.chmodSync(path.join(executorDir, "executor"), 0o755);

    // Create systemd service
    const serviceFile = `[Unit]
Description=A2R VM Executor
After=network.target

[Service]
Type=simple
ExecStart=/opt/a2r-executor/executor
Restart=always

[Install]
WantedBy=multi-user.target
`;
    const serviceDir = path.join(rootfsDir, "etc", "systemd", "system");
    fs.mkdirSync(serviceDir, { recursive: true });
    fs.writeFileSync(
      path.join(serviceDir, "a2r-executor.service"),
      serviceFile
    );

    // Enable service
    await this.setupChroot(rootfsDir);
    try {
      await this.execCommand("sudo", [
        "chroot",
        rootfsDir,
        "systemctl",
        "enable",
        "a2r-executor.service",
      ]);
    } finally {
      await this.teardownChroot(rootfsDir);
    }

    this.log("Executor installation complete");
  }

  /**
   * Create initrd image
   */
  private async createInitrd(
    workspaceDir: string,
    rootfsDir: string
  ): Promise<string> {
    this.log("Creating initrd...");

    const initrdPath = path.join(workspaceDir, "initrd.img");
    const initrdDir = path.join(workspaceDir, "initrd");
    fs.mkdirSync(initrdDir, { recursive: true });

    // Create basic initrd structure
    const dirs = ["bin", "sbin", "lib", "lib64", "etc", "proc", "sys", "dev", "tmp"];
    for (const dir of dirs) {
      fs.mkdirSync(path.join(initrdDir, dir), { recursive: true });
    }

    // Copy essential binaries from rootfs
    const essentialBins = ["sh", "mount", "umount", "switch_root", "sleep"];
    for (const bin of essentialBins) {
      const srcPath = path.join(rootfsDir, "bin", bin);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, path.join(initrdDir, "bin", bin));
        // Copy dependencies (simplified - would need ldd in production)
      }
    }

    // Create init script
    const initScript = `#!/bin/sh
mount -t proc proc /proc
mount -t sysfs sysfs /sys
mount -t devtmpfs devtmpfs /dev

# Wait for root device
sleep 1

# Switch to real root
exec switch_root /mnt/root /sbin/init
`;
    fs.writeFileSync(path.join(initrdDir, "init"), initScript);
    fs.chmodSync(path.join(initrdDir, "init"), 0o755);

    // Create cpio archive
    await this.execCommand("sh", [
      "-c",
      `cd "${initrdDir}" && find . | cpio -o -H newc | gzip > "${initrdPath}"`,
    ]);

    this.log("Initrd creation complete");
    return initrdPath;
  }

  /**
   * Compress rootfs with zstd
   */
  private async compressRootfs(
    workspaceDir: string,
    rootfsDir: string,
    ubuntuVersion: UbuntuVersion,
    version: string,
    architecture: Architecture
  ): Promise<string> {
    this.log("Compressing rootfs...");

    const rawImagePath = path.join(workspaceDir, "rootfs.img");
    const compressedPath = path.join(
      workspaceDir,
      this.getRootfsFileName(ubuntuVersion, version, architecture)
    );

    // Calculate size needed
    const size = await this.calculateDirSize(rootfsDir);
    const imageSizeMB = Math.ceil(size / 1024 / 1024) + 512; // Add 512MB buffer

    // Create empty image
    await this.execCommand("dd", [
      "if=/dev/zero",
      `of=${rawImagePath}`,
      "bs=1M",
      `count=${imageSizeMB}`,
    ]);

    // Format as ext4
    await this.execCommand("mkfs.ext4", ["-F", rawImagePath]);

    // Mount and copy files
    const mountDir = path.join(workspaceDir, "mnt");
    fs.mkdirSync(mountDir, { recursive: true });

    await this.execCommand("sudo", ["mount", "-o", "loop", rawImagePath, mountDir]);

    try {
      await this.execCommand("sudo", ["cp", "-a", `${rootfsDir}/.`, mountDir]);
    } finally {
      await this.execCommand("sudo", ["umount", mountDir]);
    }

    // Compress with zstd
    await this.execCommand("zstd", ["-19", "-T0", "-f", rawImagePath, "-o", compressedPath]);

    this.log("Rootfs compression complete");
    return compressedPath;
  }

  /**
   * Calculate directory size
   */
  private async calculateDirSize(dir: string): Promise<number> {
    return new Promise((resolve, reject) => {
      exec(`du -sb "${dir}" | cut -f1`, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(parseInt(stdout.trim(), 10));
        }
      });
    });
  }

  /**
   * Get or build kernel
   */
  private async getKernel(
    workspaceDir: string,
    kernelVersion: string,
    architecture: Architecture
  ): Promise<string> {
    this.log(`Getting kernel ${kernelVersion} for ${architecture}...`);

    // Check if kernel exists in cache
    const cachedKernel = this.getCachePath(
      this.getKernelFileName(kernelVersion, architecture)
    );
    if (fs.existsSync(cachedKernel)) {
      this.log(`Using cached kernel: ${cachedKernel}`);
      return cachedKernel;
    }

    // TODO: Download from releases or build from source
    // For now, create a placeholder
    const kernelPath = path.join(workspaceDir, "vmlinux");
    fs.writeFileSync(
      kernelPath,
      `# Placeholder kernel for ${kernelVersion} ${architecture}\n`
    );

    return kernelPath;
  }

  /**
   * Execute command and return promise
   */
  private execCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log(`Executing: ${command} ${args.join(" ")}`);

      const proc = spawn(command, args, {
        stdio: this.debug ? "inherit" : "pipe",
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new BuildError(
              `Command failed with exit code ${code}`,
              `${command} ${args.join(" ")}`,
              code || undefined
            )
          );
        }
      });

      proc.on("error", (error) => {
        reject(new BuildError(error.message, command));
      });
    });
  }

  /**
   * Cleanup build workspace
   */
  private cleanupWorkspace(workspaceDir: string): void {
    this.log(`Cleaning up workspace: ${workspaceDir}`);
    try {
      fs.rmSync(workspaceDir, { recursive: true, force: true });
    } catch (error) {
      this.log(`Cleanup warning: ${error}`);
    }
  }

  /**
   * Verify and cache downloaded/built image
   */
  private async verifyAndCache(
    version: string,
    architecture: Architecture,
    metadata: ImageMetadata
  ): Promise<CachedImage> {
    const metadataPath = this.getCachePath(
      this.getMetadataFileName(version, architecture)
    );

    // Verify all components exist
    let kernelPath: string | undefined;
    let initrdPath: string | undefined;
    let rootfsPath: string | undefined;

    if (metadata.checksums.kernel) {
      kernelPath = this.findComponentPath("kernel", version, architecture);
      if (kernelPath) {
        const checksum = await calculateChecksum(kernelPath);
        if (checksum !== metadata.checksums.kernel) {
          throw new ChecksumError(metadata.checksums.kernel, checksum);
        }
      }
    }

    if (metadata.checksums.initrd) {
      initrdPath = this.findComponentPath("initrd", version, architecture);
      if (initrdPath) {
        const checksum = await calculateChecksum(initrdPath);
        if (checksum !== metadata.checksums.initrd) {
          throw new ChecksumError(metadata.checksums.initrd, checksum);
        }
      }
    }

    if (metadata.checksums.rootfs) {
      rootfsPath = this.findRootfsPath(version, architecture);
      if (rootfsPath) {
        const checksum = await calculateChecksum(rootfsPath);
        if (checksum !== metadata.checksums.rootfs) {
          throw new ChecksumError(metadata.checksums.rootfs, checksum);
        }
      }
    }

    const totalSize =
      (kernelPath ? fs.statSync(kernelPath).size : 0) +
      (initrdPath ? fs.statSync(initrdPath).size : 0) +
      (rootfsPath ? fs.statSync(rootfsPath).size : 0);

    const cached: CachedImage = {
      version,
      architecture,
      metadataPath,
      kernelPath,
      initrdPath,
      rootfsPath,
      lastAccessed: Date.now(),
      totalSize,
    };

    // Update access time
    this.touchImage(version, architecture);

    return cached;
  }

  /**
   * Find component path in cache
   */
  private findComponentPath(
    component: ImageComponent,
    version: string,
    architecture: Architecture
  ): string | undefined {
    const files = fs.readdirSync(this.cacheDir);

    for (const file of files) {
      if (component === "kernel" && file.startsWith("vmlinux")) {
        if (file.includes(architecture)) {
          return this.getCachePath(file);
        }
      }
      if (component === "initrd" && file.startsWith("initrd")) {
        if (file.includes(architecture)) {
          return this.getCachePath(file);
        }
      }
    }

    return undefined;
  }

  /**
   * Find rootfs path in cache
   */
  private findRootfsPath(
    version: string,
    architecture: Architecture
  ): string | undefined {
    const files = fs.readdirSync(this.cacheDir);
    const suffix = architecture === "x86_64" ? "x86_64" : "arm64";

    for (const file of files) {
      if (
        file.startsWith("ubuntu-") &&
        file.includes(`-a2r-v${version}`) &&
        file.includes(suffix)
      ) {
        return this.getCachePath(file);
      }
    }

    return undefined;
  }

  /**
   * Get cached image info
   *
   * @param version - Image version
   * @param architecture - Target architecture
   * @returns Cached image info or undefined if not found
   */
  public getCachedImage(
    version: string,
    architecture: Architecture
  ): CachedImage | undefined {
    const metadataPath = this.getCachePath(
      this.getMetadataFileName(version, architecture)
    );

    if (!fs.existsSync(metadataPath)) {
      return undefined;
    }

    try {
      const metadata: ImageMetadata = JSON.parse(
        fs.readFileSync(metadataPath, "utf-8")
      );

      const kernelPath = this.findComponentPath("kernel", version, architecture);
      const initrdPath = this.findComponentPath("initrd", version, architecture);
      const rootfsPath = this.findRootfsPath(version, architecture);

      const totalSize =
        (kernelPath && fs.existsSync(kernelPath)
          ? fs.statSync(kernelPath).size
          : 0) +
        (initrdPath && fs.existsSync(initrdPath)
          ? fs.statSync(initrdPath).size
          : 0) +
        (rootfsPath && fs.existsSync(rootfsPath)
          ? fs.statSync(rootfsPath).size
          : 0);

      return {
        version,
        architecture,
        metadataPath,
        kernelPath: kernelPath && fs.existsSync(kernelPath) ? kernelPath : undefined,
        initrdPath: initrdPath && fs.existsSync(initrdPath) ? initrdPath : undefined,
        rootfsPath: rootfsPath && fs.existsSync(rootfsPath) ? rootfsPath : undefined,
        lastAccessed: this.getLastAccessed(metadataPath),
        totalSize,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Get image paths for use with VM executor
   *
   * @param version - Image version
   * @param architecture - Target architecture
   * @returns Image paths object
   * @throws {ImageNotFoundError} If image not found
   *
   * @example
   * ```typescript
   * const image = manager.getImage("1.1.0", "arm64");
   * console.log(image.kernelPath); // ~/.a2r/images/vmlinux-6.5.0-a2r-arm64
   * ```
   */
  public getImage(
    version: string,
    architecture: Architecture
  ): {
    version: string;
    architecture: Architecture;
    kernelPath: string;
    initrdPath: string;
    rootfsPath: string;
  } {
    const cached = this.getCachedImage(version, architecture);

    if (!cached || !cached.kernelPath || !cached.initrdPath || !cached.rootfsPath) {
      throw new ImageNotFoundError(version, architecture);
    }

    // Update access time
    this.touchImage(version, architecture);

    return {
      version,
      architecture,
      kernelPath: cached.kernelPath,
      initrdPath: cached.initrdPath,
      rootfsPath: cached.rootfsPath,
    };
  }

  /**
   * Get last accessed time from file stats
   */
  private getLastAccessed(filePath: string): number {
    try {
      const stats = fs.statSync(filePath);
      return stats.atimeMs;
    } catch {
      return Date.now();
    }
  }

  /**
   * Update access time for cached image
   */
  private touchImage(version: string, architecture: Architecture): void {
    const metadataPath = this.getCachePath(
      this.getMetadataFileName(version, architecture)
    );
    const now = new Date();
    try {
      fs.utimesSync(metadataPath, now, now);
    } catch {
      // Ignore errors
    }
  }

  /**
   * List all cached images
   *
   * @returns Array of cached image info
   */
  public listCachedImages(): CachedImage[] {
    const images: CachedImage[] = [];

    if (!fs.existsSync(this.cacheDir)) {
      return images;
    }

    const files = fs.readdirSync(this.cacheDir);

    for (const file of files) {
      const match = file.match(/^version-(.+)-(x86_64|arm64)\.json$/);
      if (match) {
        const version = match[1];
        const architecture = match[2] as Architecture;
        const cached = this.getCachedImage(version, architecture);
        if (cached) {
          images.push(cached);
        }
      }
    }

    return images.sort((a, b) => b.lastAccessed - a.lastAccessed);
  }

  /**
   * Clean up old image versions, keeping only the most recent
   *
   * @param keepVersions - Number of versions to keep per architecture
   * @returns Number of versions removed
   */
  public cleanOldVersions(keepVersions: number = 2): number {
    const images = this.listCachedImages();
    const grouped = new Map<Architecture, CachedImage[]>();

    for (const img of images) {
      const group = grouped.get(img.architecture) || [];
      group.push(img);
      grouped.set(img.architecture, group);
    }

    let removed = 0;

    for (const [, group] of grouped) {
      // Sort by last accessed (newest first)
      group.sort((a, b) => b.lastAccessed - a.lastAccessed);

      // Remove old versions
      for (let i = keepVersions; i < group.length; i++) {
        this.removeImage(group[i].version, group[i].architecture);
        removed++;
      }
    }

    this.log(`Cleaned ${removed} old image versions`);
    return removed;
  }

  /**
   * Remove a specific image version
   *
   * @param version - Version to remove
   * @param architecture - Architecture to remove
   */
  public removeImage(version: string, architecture: Architecture): void {
    const cached = this.getCachedImage(version, architecture);
    if (!cached) return;

    this.log(`Removing image v${version} ${architecture}`);

    if (cached.metadataPath && fs.existsSync(cached.metadataPath)) {
      fs.unlinkSync(cached.metadataPath);
    }
    if (cached.kernelPath && fs.existsSync(cached.kernelPath)) {
      fs.unlinkSync(cached.kernelPath);
    }
    if (cached.initrdPath && fs.existsSync(cached.initrdPath)) {
      fs.unlinkSync(cached.initrdPath);
    }
    if (cached.rootfsPath && fs.existsSync(cached.rootfsPath)) {
      fs.unlinkSync(cached.rootfsPath);
    }
  }

  /**
   * Perform LRU eviction when cache size exceeds limit
   *
   * @param requiredSpace - Additional space needed in bytes
   * @returns True if space was made available
   */
  public async evictForSpace(requiredSpace: number): Promise<boolean> {
    const images = this.listCachedImages();
    let currentSize = images.reduce((sum, img) => sum + img.totalSize, 0);

    if (currentSize + requiredSpace <= this.maxCacheSize) {
      return true;
    }

    this.log(`Cache eviction needed: ${formatBytes(requiredSpace)} required`);

    // Sort by last accessed (oldest first)
    images.sort((a, b) => a.lastAccessed - b.lastAccessed);

    for (const img of images) {
      this.removeImage(img.version, img.architecture);
      currentSize -= img.totalSize;

      if (currentSize + requiredSpace <= this.maxCacheSize) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics
   */
  public getCacheStats(): {
    totalSize: number;
    imageCount: number;
    architectureBreakdown: Record<Architecture, number>;
  } {
    const images = this.listCachedImages();
    const totalSize = images.reduce((sum, img) => sum + img.totalSize, 0);

    const architectureBreakdown: Record<Architecture, number> = {
      x86_64: 0,
      arm64: 0,
    };

    for (const img of images) {
      architectureBreakdown[img.architecture]++;
    }

    return {
      totalSize,
      imageCount: images.length,
      architectureBreakdown,
    };
  }

  /**
   * Clear entire cache
   *
   * @returns Number of images removed
   */
  public clearCache(): number {
    const images = this.listCachedImages();

    for (const img of images) {
      this.removeImage(img.version, img.architecture);
    }

    this.log(`Cleared ${images.length} images from cache`);
    return images.length;
  }

  /**
   * Get the cache directory path
   *
   * @returns Absolute path to cache directory
   */
  public getCacheDir(): string {
    return this.cacheDir;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default VMImageManager;
