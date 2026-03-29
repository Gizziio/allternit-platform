/**
 * GET /api/v1/version
 * 
 * Returns the unified version manifest.
 * Desktop version always equals Backend version.
 */

import { NextResponse } from 'next/server';

// Version is set at build time to ensure Desktop == Backend
const VERSION = process.env.A2R_VERSION || '1.0.0';
const BUILD_DATE = process.env.BUILD_DATE || new Date().toISOString();

export async function GET() {
  return NextResponse.json({
    // Unified version - Desktop and Backend are always the same
    version: VERSION,
    build_date: BUILD_DATE,
    
    // Compatibility matrix (all same version)
    desktop: {
      version: VERSION,
      platforms: ['darwin', 'win32', 'linux'],
      architectures: ['x64', 'arm64'],
    },
    backend: {
      version: VERSION,
      platforms: ['linux'],
      architectures: ['amd64', 'arm64'],
      docker_required: true,
    },
    
    // Version lock - ensures Desktop won't connect to mismatched Backend
    version_lock: {
      enabled: true,
      compatible: true,
      min_backend_version: VERSION,
      max_backend_version: VERSION,
    },
    
    // Update availability
    update: {
      available: false,
      version: null,
      url: null,
      release_notes: null,
    },
  });
}
