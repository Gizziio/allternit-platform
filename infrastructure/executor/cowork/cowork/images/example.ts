/**
 * VM Image Manager - Example Usage
 *
 * This file demonstrates how to use the VMImageManager class for
 * downloading, building, and managing VM images.
 */

import { VMImageManager, Architecture, DownloadOptions, BuildOptions } from "./manager";

// =============================================================================
// BASIC SETUP
// =============================================================================

// Create manager with default settings
const manager = new VMImageManager();

// Or with custom options
const customManager = new VMImageManager({
  cacheDir: "~/.allternit/images",
  maxCacheSize: 20 * 1024 * 1024 * 1024, // 20GB
  debug: true,
  githubToken: process.env.GITHUB_TOKEN, // For higher rate limits
});

// =============================================================================
// DOWNLOADING IMAGES
// =============================================================================

async function downloadExample() {
  try {
    // Download specific components with progress tracking
    const image = await manager.download({
      version: "1.1.0",
      architecture: "arm64",
      components: ["kernel", "initrd", "rootfs"],
      onProgress: (downloaded, total) => {
        const percent = ((downloaded / total) * 100).toFixed(1);
        const downloadedMB = (downloaded / 1024 / 1024).toFixed(2);
        const totalMB = (total / 1024 / 1024).toFixed(2);
        console.log(`Download: ${percent}% (${downloadedMB}MB / ${totalMB}MB)`);
      },
    });

    console.log("Download complete:", image);
  } catch (error) {
    console.error("Download failed:", error);
  }
}

// =============================================================================
// BUILDING IMAGES (Linux only)
// =============================================================================

async function buildExample() {
  try {
    // Build custom image with toolchains
    const image = await manager.build({
      ubuntuVersion: "22.04",
      architecture: "arm64",
      packages: ["nodejs", "npm", "python3", "git"],
      includeToolchains: true,
      outputDir: "~/.allternit/images",
      version: "1.2.0-custom",
    });

    console.log("Build complete:", image);
  } catch (error) {
    console.error("Build failed:", error);
  }
}

// =============================================================================
// USING CACHED IMAGES
// =============================================================================

async function useImageExample() {
  try {
    // Get paths for a specific version
    const image = manager.getImage("1.1.0", "arm64");

    console.log("Kernel:", image.kernelPath);
    console.log("Initrd:", image.initrdPath);
    console.log("Rootfs:", image.rootfsPath);

    // Use with VM executor
    // vmExecutor.run({
    //   kernel: image.kernelPath,
    //   initrd: image.initrdPath,
    //   rootfs: image.rootfsPath,
    // });
  } catch (error) {
    console.error("Image not found:", error);
  }
}

// =============================================================================
// LISTING AND MANAGING IMAGES
// =============================================================================

async function managementExample() {
  // List all cached images
  const cachedImages = manager.listCachedImages();
  console.log("Cached images:", cachedImages);

  // Get cache statistics
  const stats = manager.getCacheStats();
  console.log("Cache stats:", {
    totalSize: `${(stats.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`,
    imageCount: stats.imageCount,
    architectures: stats.architectureBreakdown,
  });

  // Clean old versions (keep only 2 most recent per architecture)
  const removed = manager.cleanOldVersions(2);
  console.log(`Removed ${removed} old versions`);

  // Clear entire cache if needed
  // const cleared = manager.clearCache();
  // console.log(`Cleared ${cleared} images`);
}

// =============================================================================
// CHECKING FOR UPDATES
// =============================================================================

async function updateExample() {
  try {
    // List available versions from GitHub
    const versions = await manager.listAvailableVersions();
    console.log("Available versions:", versions);

    // Check if update is available
    const currentVersion = "1.0.0";
    const latestVersion = await manager.checkForUpdates(currentVersion);

    if (latestVersion) {
      console.log(`Update available: ${currentVersion} -> ${latestVersion}`);

      // Download latest version
      await manager.download({
        version: latestVersion,
        architecture: "arm64",
        components: ["kernel", "initrd", "rootfs"],
      });
    } else {
      console.log("Already up to date");
    }
  } catch (error) {
    console.error("Update check failed:", error);
  }
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

import {
  VMImageError,
  NetworkError,
  ChecksumError,
  PlatformError,
  DiskSpaceError,
  ImageNotFoundError,
} from "./manager";

async function errorHandlingExample() {
  try {
    await manager.download({
      version: "1.1.0",
      architecture: "arm64",
      components: ["kernel", "initrd", "rootfs"],
    });
  } catch (error) {
    if (error instanceof NetworkError) {
      console.error("Network error (retry may help):", error.message);
    } else if (error instanceof ChecksumError) {
      console.error("Corrupted download - will retry:", error.message);
    } else if (error instanceof PlatformError) {
      console.error("Platform not supported for this operation:", error.message);
    } else if (error instanceof DiskSpaceError) {
      console.error("Not enough disk space:", error.message);
    } else if (error instanceof ImageNotFoundError) {
      console.error("Image not found:", error.message);
    } else if (error instanceof VMImageError) {
      console.error("VM Image error:", error.code, error.message);
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "download":
      await downloadExample();
      break;
    case "build":
      await buildExample();
      break;
    case "list":
      await managementExample();
      break;
    case "update":
      await updateExample();
      break;
    default:
      console.log(`
VM Image Manager Example

Usage:
  ts-node example.ts <command>

Commands:
  download  - Download a pre-built image
  build     - Build an image from scratch (Linux only)
  list      - List cached images and stats
  update    - Check for and download updates

Examples:
  ts-node example.ts download
  ts-node example.ts build
  ts-node example.ts list
`);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
