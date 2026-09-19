// @ts-nocheck
// TODO(types): compiler-artifact decompile kept nocheck — latent ant-drift type issues (TS2367 external-vs-ant comparisons / TS2614 progress-type import drift / TS2339 untyped props), not a conversion regression.
import { execa } from 'execa';
import { readFile } from 'fs/promises';
import { join } from 'path';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { CommandResultDisplay } from '../../commands';
import { Select } from '../../components/CustomSelect/select';
import { Dialog } from '../../components/design-system/Dialog';
import { Spinner } from '../../components/Spinner';
import instances from '../../ink/instances';
import { Box, Text } from '../../ink';
import { enablePluginOp } from '../../services/plugins/pluginOperations';
import { logForDebugging } from '../../utils/debug';
import { isENOENT, toError } from '../../utils/errors';
import { execFileNoThrow } from '../../utils/execFileNoThrow';
import { pathExists } from '../../utils/file';
import { logError } from '../../utils/log';
import { getPlatform } from '../../utils/platform';
import { clearAllCaches } from '../../utils/plugins/cacheUtils';
import { isPluginInstalled } from '../../utils/plugins/installedPluginsManager';
import { addMarketplaceSource, clearMarketplacesCache, loadKnownMarketplacesConfig, refreshMarketplace } from '../../utils/plugins/marketplaceManager';
import { OFFICIAL_MARKETPLACE_NAME } from '../../utils/plugins/officialMarketplace';
import { loadAllPlugins } from '../../utils/plugins/pluginLoader';
import { installSelectedPlugins } from '../../utils/plugins/pluginStartupCheck';

// Marketplace and plugin identifiers - varies by user type
const INTERNAL_MARKETPLACE_NAME = 'claude-code-marketplace';
const INTERNAL_MARKETPLACE_REPO = 'anthropics/claude-code-marketplace';
const OFFICIAL_MARKETPLACE_REPO = 'anthropics/claude-plugins-official';
function getMarketplaceName(): string {
  return "external" === 'ant' ? INTERNAL_MARKETPLACE_NAME : OFFICIAL_MARKETPLACE_NAME;
}
function getMarketplaceRepo(): string {
  return "external" === 'ant' ? INTERNAL_MARKETPLACE_REPO : OFFICIAL_MARKETPLACE_REPO;
}
function getPluginId(): string {
  return `thinkback@${getMarketplaceName()}`;
}
const SKILL_NAME = 'thinkback';

/**
 * Get the thinkback skill directory from the installed plugin's cache path
 */
async function getThinkbackSkillDir(): Promise<string | null> {
  const {
    enabled
  } = await loadAllPlugins();
  const thinkbackPlugin = enabled.find(p => p.name === 'thinkback' || p.source && p.source.includes(getPluginId()));
  if (!thinkbackPlugin) {
    return null;
  }
  const skillDir = join(thinkbackPlugin.path, 'skills', SKILL_NAME);
  if (await pathExists(skillDir)) {
    return skillDir;
  }
  return null;
}
export async function playAnimation(skillDir: string): Promise<{
  success: boolean;
  message: string;
}> {
  const dataPath = join(skillDir, 'year_in_review.js');
  const playerPath = join(skillDir, 'player.js');

  // Both files are prerequisites for the node subprocess. Read them here
  // (not at call sites) so all callers get consistent error messaging. The
  // subprocess runs with reject: false, so a missing file would otherwise
  // silently return success. Using readFile (not access) per CLAUDE.md.
  //
  // Non-ENOENT errors (EACCES etc) are logged and returned as failures rather
  // than thrown — the old pathExists-based code never threw, and one caller
  // (handleSelect) uses `void playAnimation().then(...)` without a .catch().
  try {
    await readFile(dataPath);
  } catch (e: unknown) {
    if (isENOENT(e)) {
      return {
        success: false,
        message: 'No animation found. Run /think-back first to generate one.'
      };
    }
    logError(e);
    return {
      success: false,
      message: `Could not access animation data: ${toError(e).message}`
    };
  }
  try {
    await readFile(playerPath);
  } catch (e: unknown) {
    if (isENOENT(e)) {
      return {
        success: false,
        message: 'Player script not found. The player.js file is missing from the thinkback skill.'
      };
    }
    logError(e);
    return {
      success: false,
      message: `Could not access player script: ${toError(e).message}`
    };
  }

  // Get ink instance for terminal takeover
  const inkInstance = instances.get(process.stdout);
  if (!inkInstance) {
    return {
      success: false,
      message: 'Failed to access terminal instance'
    };
  }
  inkInstance.enterAlternateScreen();
  try {
    await execa('node', [playerPath], {
      stdio: 'inherit',
      cwd: skillDir,
      reject: false
    });
  } catch {
    // Animation may have been interrupted (e.g., Ctrl+C)
  } finally {
    inkInstance.exitAlternateScreen();
  }

  // Open the HTML file in browser for video download
  const htmlPath = join(skillDir, 'year_in_review.html');
  if (await pathExists(htmlPath)) {
    const platform = getPlatform();
    const openCmd = platform === 'macos' ? 'open' : platform === 'windows' ? 'start' : 'xdg-open';
    void execFileNoThrow(openCmd, [htmlPath]);
  }
  return {
    success: true,
    message: 'Year in review animation complete!'
  };
}
type InstallState = {
  phase: 'checking';
} | {
  phase: 'installing-marketplace';
} | {
  phase: 'installing-plugin';
} | {
  phase: 'enabling-plugin';
} | {
  phase: 'ready';
} | {
  phase: 'error';
  message: string;
};
function ThinkbackInstaller({
  onReady,
  onError
}: {
  onReady: () => void;
  onError: (message: string) => void;
}): React.ReactNode {
  const [state, setState] = useState<InstallState>({
    phase: 'checking'
  });
  const [progressMessage, setProgressMessage] = useState('');
  useEffect(() => {
    async function checkAndInstall(): Promise<void> {
      try {
        // Check if marketplace is installed
        const knownMarketplaces = await loadKnownMarketplacesConfig();
        const marketplaceName = getMarketplaceName();
        const marketplaceRepo = getMarketplaceRepo();
        const pluginId = getPluginId();
        const marketplaceInstalled = marketplaceName in knownMarketplaces;

        // Check if plugin is already installed first
        const pluginAlreadyInstalled = isPluginInstalled(pluginId);
        if (!marketplaceInstalled) {
          // Upstream Anthropic marketplace is not Gizzi chrome. Only fetch it
          // when an operator explicitly opts in.
          if (process.env.GIZZI_ENABLE_UPSTREAM_MARKETPLACE !== '1') {
            throw new Error(
              'Thinkback is not available yet. A Gizzi-owned plugin marketplace is coming soon.',
            )
          }
          // Install the marketplace
          setState({
            phase: 'installing-marketplace'
          });
          logForDebugging(`Installing marketplace ${marketplaceRepo}`);
          await addMarketplaceSource({
            source: 'github',
            repo: marketplaceRepo
          }, message => {
            setProgressMessage(message);
          });
          clearAllCaches();
          logForDebugging(`Marketplace ${marketplaceName} installed`);
        } else if (!pluginAlreadyInstalled) {
          // Marketplace installed but plugin not installed - refresh to get latest plugins
          // Only refresh when needed to avoid potentially destructive git operations
          setState({
            phase: 'installing-marketplace'
          });
          setProgressMessage('Updating marketplace…');
          logForDebugging(`Refreshing marketplace ${marketplaceName}`);
          await refreshMarketplace(marketplaceName, message_0 => {
            setProgressMessage(message_0);
          });
          clearMarketplacesCache();
          clearAllCaches();
          logForDebugging(`Marketplace ${marketplaceName} refreshed`);
        }
        if (!pluginAlreadyInstalled) {
          // Install the plugin
          setState({
            phase: 'installing-plugin'
          });
          logForDebugging(`Installing plugin ${pluginId}`);
          const result = await installSelectedPlugins([pluginId]);
          if (result.failed.length > 0) {
            const errorMsg = result.failed.map(f => `${f.name}: ${f.error}`).join(', ');
            throw new Error(`Failed to install plugin: ${errorMsg}`);
          }
          clearAllCaches();
          logForDebugging(`Plugin ${pluginId} installed`);
        } else {
          // Plugin is installed, check if it's enabled
          const {
            disabled
          } = await loadAllPlugins();
          const isDisabled = disabled.some(p => p.name === 'thinkback' || p.source?.includes(pluginId));
          if (isDisabled) {
            // Enable the plugin
            setState({
              phase: 'enabling-plugin'
            });
            logForDebugging(`Enabling plugin ${pluginId}`);
            const enableResult = await enablePluginOp(pluginId);
            if (!enableResult.success) {
              throw new Error(`Failed to enable plugin: ${enableResult.message}`);
            }
            clearAllCaches();
            logForDebugging(`Plugin ${pluginId} enabled`);
          }
        }
        setState({
          phase: 'ready'
        });
        onReady();
      } catch (error) {
        const err = toError(error);
        logError(err);
        setState({
          phase: 'error',
          message: err.message
        });
        onError(err.message);
      }
    }
    void checkAndInstall();
  }, [onReady, onError]);
  if (state.phase === 'error') {
    return <Box flexDirection="column">
        <Text color="error">Error: {state.message}</Text>
      </Box>;
  }
  if (state.phase === 'ready') {
    return null;
  }
  const statusMessage = state.phase === 'checking' ? 'Checking thinkback installation…' : state.phase === 'installing-marketplace' ? 'Installing marketplace…' : state.phase === 'enabling-plugin' ? 'Enabling thinkback plugin…' : 'Installing thinkback plugin…';
  return <Box flexDirection="column">
      <Box>
        <Spinner />
        <Text>{progressMessage || statusMessage}</Text>
      </Box>
    </Box>;
}
type MenuAction = 'play' | 'edit' | 'fix' | 'regenerate';
type GenerativeAction = Exclude<MenuAction, 'play'>;
function ThinkbackMenu(t0) {
  const {
    onDone,
    onAction,
    skillDir,
    hasGenerated
  } = t0;
  const [hasSelected, setHasSelected] = useState(false);
  const t1 = hasGenerated ? [{
      label: "Play animation",
      value: "play" as const,
      description: "Watch your year in review"
    }, {
      label: "Edit content",
      value: "edit" as const,
      description: "Modify the animation"
    }, {
      label: "Fix errors",
      value: "fix" as const,
      description: "Fix validation or rendering issues"
    }, {
      label: "Regenerate",
      value: "regenerate" as const,
      description: "Create a new animation from scratch"
    }] : [{
      label: "Let's go!",
      value: "regenerate" as const,
      description: "Generate your personalized animation"
    }];

  const options = t1;
  const t2 = function handleSelect(value) {
      setHasSelected(true);
      if (value === "play") {
        playAnimation(skillDir).then(() => {
          onDone(undefined, {
            display: "skip"
          });
        });
      } else {
        onAction(value);
      }
    };

  const handleSelect = t2;
  const t3 = function handleCancel() {
      onDone(undefined, {
        display: "skip"
      });
    };

  const handleCancel = t3;
  if (hasSelected) {
    return null;
  }
  const t4 = !hasGenerated && <Box flexDirection="column"><Text>Relive your year of coding with Gizzi.</Text><Text dimColor={true}>{"We'll create a personalized ASCII animation celebrating your journey."}</Text></Box>;

  const t5 = <Select options={options} onChange={handleSelect} visibleOptionCount={5} />;

  const t6 = <Box flexDirection="column" gap={1}>{t4}{t5}</Box>;

  const t7 = <Dialog title="Think Back on 2025 with Gizzi Code" subtitle="Generate your 2025 Gizzi Code Think Back (takes a few minutes to run)" onCancel={handleCancel} color="gizzi">{t6}</Dialog>;

  return t7;
}
const EDIT_PROMPT = 'Use the Skill tool to invoke the "thinkback" skill with mode=edit to modify my existing Gizzi Code year in review animation. Ask me what I want to change. When the animation is ready, tell the user to run /think-back again to play it.';
const FIX_PROMPT = 'Use the Skill tool to invoke the "thinkback" skill with mode=fix to fix validation or rendering errors in my existing Gizzi Code year in review animation. Run the validator, identify errors, and fix them. When the animation is ready, tell the user to run /think-back again to play it.';
const REGENERATE_PROMPT = 'Use the Skill tool to invoke the "thinkback" skill with mode=regenerate to create a completely new Gizzi Code year in review animation from scratch. Delete the existing animation and start fresh. When the animation is ready, tell the user to run /think-back again to play it.';
function ThinkbackFlow(t0) {
  const {
    onDone
  } = t0;
  const [installComplete, setInstallComplete] = useState(false);
  const [installError, setInstallError] = useState(null);
  const [skillDir, setSkillDir] = useState(null);
  const [hasGenerated, setHasGenerated] = useState(null);
  const t1 = function handleReady() {
      setInstallComplete(true);
    };

  const handleReady = t1;
  const t2 = message => {
      setInstallError(message);
      onDone(`Error with thinkback: ${message}. Try running /plugin to manually install the think-back plugin.`, {
        display: "system"
      });
    };

  const handleError = t2;
  const t3 = () => {
      if (installComplete && !skillDir && !installError) {
        getThinkbackSkillDir().then(dir => {
          if (dir) {
            logForDebugging(`Thinkback skill directory: ${dir}`);
            setSkillDir(dir);
          } else {
            handleError("Could not find thinkback skill directory");
          }
        });
      }
    };
  const t4 = [installComplete, skillDir, installError, handleError];

  useEffect(t3, t4);
  const t5 = () => {
      if (!skillDir) {
        return;
      }
      const dataPath = join(skillDir, "year_in_review.js");
      pathExists(dataPath).then(exists => {
        logForDebugging(`Checking for ${dataPath}: ${exists ? "found" : "not found"}`);
        setHasGenerated(exists);
      });
    };
  const t6 = [skillDir];

  useEffect(t5, t6);
  const t7 = function handleAction(action) {
      const prompts = {
        edit: EDIT_PROMPT,
        fix: FIX_PROMPT,
        regenerate: REGENERATE_PROMPT
      };
      onDone(prompts[action], {
        display: "user",
        shouldQuery: true
      });
    };

  const handleAction = t7;
  if (installError) {
    const t8 = <Text color="error">Error: {installError}</Text>;

    const t9 = <Text dimColor={true}>Try running /plugin to manually install the think-back plugin.</Text>;

    const t10 = <Box flexDirection="column">{t8}{t9}</Box>;

    return t10;
  }
  if (!installComplete) {
    const t8 = <ThinkbackInstaller onReady={handleReady} onError={handleError} />;

    return t8;
  }
  if (!skillDir || hasGenerated === null) {
    const t8 = <Box><Spinner /><Text>Loading thinkback skill…</Text></Box>;

    return t8;
  }
  const t8 = <ThinkbackMenu onDone={onDone} onAction={handleAction} skillDir={skillDir} hasGenerated={hasGenerated} />;

  return t8;
}
export async function call(onDone: (result?: string, options?: {
  display?: CommandResultDisplay;
  shouldQuery?: boolean;
}) => void): Promise<React.ReactNode> {
  return <ThinkbackFlow onDone={onDone} />;
}
