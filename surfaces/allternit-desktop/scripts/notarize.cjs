/**
 * Notarization script for macOS distribution.
 *
 * Called by electron-builder afterSign hook.
 * Skipped silently when APPLE_ID env var is not set (local/CI builds without notarization).
 *
 * Required env vars:
 *   APPLE_ID           — Apple developer account email
 *   APPLE_ID_PASSWORD  — App-specific password (not the Apple ID password)
 *   APPLE_TEAM_ID      — Team ID from developer.apple.com (10-char string)
 */

'use strict';

const { notarize } = require('@electron/notarize');
const path = require('path');

module.exports = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const { APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID } = process.env;

  // Skip if credentials are not present (local builds, CI without notarization)
  if (!APPLE_ID || !APPLE_ID_PASSWORD || !APPLE_TEAM_ID) {
    console.log('[notarize] Skipping notarization — APPLE_ID / APPLE_ID_PASSWORD / APPLE_TEAM_ID not set.');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`[notarize] Notarizing ${appPath}…`);

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId: APPLE_ID,
      appleIdPassword: APPLE_ID_PASSWORD,
      teamId: APPLE_TEAM_ID,
    });

    console.log('[notarize] Notarization complete.');
  } catch (err) {
    console.error('[notarize] Notarization failed:', err);
    throw err;
  }
};
