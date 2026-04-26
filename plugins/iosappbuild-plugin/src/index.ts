import { PluginHost, ExecutionResult } from '@allternit/plugin-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import manifest from '../manifest.json';

export { manifest };

const execAsync = promisify(exec);

export async function execute(host: PluginHost, params: any): Promise<ExecutionResult> {
  try {
    // Platform guard
    if (process.platform !== 'darwin') {
      return {
        success: false,
        error: {
          message: 'iOS App Builder requires macOS. Current platform: ' + process.platform,
          code: 'UNSUPPORTED_PLATFORM',
          retryable: false
        }
      };
    }

    // Validate path exists
    try {
      await fs.access(params.path);
    } catch {
      return {
        success: false,
        error: { message: `Project path does not exist: ${params.path}`, code: 'INVALID_PATH', retryable: false }
      };
    }

    // Check xcodebuild availability
    try {
      await execAsync('which xcodebuild');
    } catch {
      return {
        success: false,
        error: {
          message: 'xcodebuild not found. Install Xcode Command Line Tools: xcode-select --install',
          code: 'XCODE_MISSING',
          retryable: false
        }
      };
    }

    const projectType = params.projectType || 'react-native';
    const target = params.target || 'simulator';
    const configuration = params.configuration || 'Debug';
    const clean = params.clean || false;
    const simulatorName = params.simulatorName || 'iPhone 15';

    let buildCommand: string;
    let derivedDataPath: string;
    let logFile: string;

    // Build command construction based on project type
    if (projectType === 'react-native' || projectType === 'expo') {
      const iosDir = path.join(params.path, 'ios');
      try { await fs.access(iosDir); } catch {
        return {
          success: false,
          error: { message: `No ios/ directory found at ${iosDir}. Run: npx expo prebuild or cd ios && pod install`, code: 'MISSING_IOS_DIR', retryable: true }
        };
      }

      const workspaceFiles = await fs.readdir(iosDir);
      const xcworkspace = workspaceFiles.find(f => f.endsWith('.xcworkspace'));
      const xcodeproj = workspaceFiles.find(f => f.endsWith('.xcodeproj'));
      const scheme = params.scheme || workspaceFiles.find(f => f.endsWith('.xcscheme'))?.replace('.xcscheme', '') || 'MyApp';

      if (xcworkspace) {
        buildCommand = `xcodebuild -workspace "${path.join(iosDir, xcworkspace)}" -scheme "${scheme}" -configuration ${configuration}`;
      } else if (xcodeproj) {
        buildCommand = `xcodebuild -project "${path.join(iosDir, xcodeproj)}" -scheme "${scheme}" -configuration ${configuration}`;
      } else {
        return { success: false, error: { message: 'No .xcworkspace or .xcodeproj found in ios/', code: 'MISSING_XCODE_PROJECT', retryable: false } };
      }

      if (target === 'simulator') {
        buildCommand += ' -destination "platform=iOS Simulator,name=' + simulatorName + '"';
      } else if (target === 'device') {
        buildCommand += ' -destination "generic/platform=iOS"';
      } else if (target === 'archive') {
        buildCommand += ' -archivePath "' + path.join(params.path, 'build', scheme + '.xcarchive') + '" archive';
      }

      derivedDataPath = path.join(params.path, 'ios', 'build');
      buildCommand += ` -derivedDataPath "${derivedDataPath}"`;

    } else if (projectType === 'swift') {
      const scheme = params.scheme || 'App';
      buildCommand = `swift build`; // or xcodebuild for Xcode projects
      derivedDataPath = path.join(params.path, '.build');
    } else {
      return { success: false, error: { message: `Unsupported project type: ${projectType}`, code: 'UNSUPPORTED_TYPE', retryable: false } };
    }

    if (clean) {
      buildCommand = `xcodebuild clean && ` + buildCommand;
    }

    logFile = path.join(params.path, 'build.log');
    buildCommand += ` | tee "${logFile}"`;

    host.ui.renderMarkdown(`Starting iOS build...\n\n**Project:** ${params.path}\n**Type:** ${projectType}\n**Target:** ${target}\n**Config:** ${configuration}\n\nCommand:\n\`\`\`bash\n${buildCommand}\n\`\`\``);

    // Execute build with 10-minute timeout
    const { stdout, stderr } = await execAsync(buildCommand, {
      cwd: params.path,
      timeout: 600000,
      maxBuffer: 10 * 1024 * 1024
    });

    // Parse build results
    const success = !stderr.includes('BUILD FAILED') && !stdout.includes('BUILD FAILED');
    const appPath = derivedDataPath ? await findAppBundle(derivedDataPath) : undefined;

    if (success && target === 'simulator' && appPath) {
      // Boot simulator and install app
      const simBoot = `xcrun simctl boot "${simulatorName}" 2>/dev/null || true`;
      await execAsync(simBoot);
      const simInstall = `xcrun simctl install "${simulatorName}" "${appPath}"`;
      await execAsync(simInstall);
      const simLaunch = `xcrun simctl launch "${simulatorName}" $(xcrun simctl listapps "${simulatorName}" | grep -m1 'CFBundleIdentifier' | sed 's/.*"\\(.*\\)".*/\\1/')`;
      // Note: launch is best-effort
    }

    return {
      success,
      content: JSON.stringify({
        buildCommand,
        logFile,
        appPath,
        stdout: stdout.slice(-5000), // last 5KB
        stderr: stderr.slice(-2000),
        target,
        configuration
      })
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: { message: errorMsg, code: 'BUILD_FAILED', retryable: true }
    };
  }
}

async function findAppBundle(derivedDataPath: string): Promise<string | undefined> {
  try {
    const { stdout } = await execAsync(`find "${derivedDataPath}" -name "*.app" -type d | head -1`);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
