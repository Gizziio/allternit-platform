/**
 * Notarization script for macOS distribution.
 *
 * Called by electron-builder afterSign hook.
 *
 * Fails loudly (non-zero exit) when credentials are missing on CI builds —
 * a release build that ships unsigned/unnotarized must never pass silently.
 * Local (non-CI) builds without credentials skip with a warning, as before.
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

  // Missing credentials: hard-fail on CI so unsigned release builds never
  // pass silently; keep the local unsigned-build escape hatch.
  if (!APPLE_ID || !APPLE_ID_PASSWORD || !APPLE_TEAM_ID) {
    const missing = [
      ['APPLE_ID', APPLE_ID],
      ['APPLE_ID_PASSWORD', APPLE_ID_PASSWORD],
      ['APPLE_TEAM_ID', APPLE_TEAM_ID],
    ]
      .filter(([, v]) => !v)
      .map(([k]) => k)
      .join(', ');
    if (process.env.CI) {
      throw new Error(
        `[notarize] Refusing to notarize on CI without credentials — missing: ${missing}. ` +
          'Set APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID secrets on the release workflow.'
      );
    }
    console.log(`[notarize] Skipping notarization — ${missing} not set (local build).`);
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
