// @ts-nocheck
import React, { useEffect, useState } from 'react';
import type { CommandResultDisplay } from '../../commands';
import { Box, Text } from '@/ink.js';
import {
  buildDesignDeepLink,
  openDesignStudioInDesktop,
} from '../../../../../shared/utils/desktopDeepLink.js';
import { errorMessage } from '../../../../../shared/utils/errors.js';
import { LoadingState } from '../../../components/design-system/LoadingState.js';

const DESKTOP_DOWNLOAD_URL = 'https://github.com/Gizziio/desktop/releases';

type Props = {
  prompt: string;
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void;
};

function DesignOpen({ prompt, onDone }: Props): React.ReactNode {
  const [error, setError] = useState<string | null>(null);
  const [notInstalled, setNotInstalled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await openDesignStudioInDesktop(prompt);
        if (cancelled) return;
        if (result.success) {
          const carried = prompt ? ` with your prompt` : '';
          onDone(`A:// Studio opened in Allternit Desktop${carried}.\nDeep link: ${result.deepLinkUrl}`, {
            display: 'system',
          });
          return;
        }
        if (result.notInstalled) {
          setNotInstalled(true);
          setError(
            `Allternit Desktop is not installed.\nDeep link: ${result.deepLinkUrl}\nInstall it from ${DESKTOP_DOWNLOAD_URL} and re-run /design.`,
          );
        } else {
          setError(`${result.error ?? 'Failed to open Allternit Desktop.'}\nDeep link: ${result.deepLinkUrl}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(`${errorMessage(err)}\nDeep link: ${buildDesignDeepLink(prompt)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Text color={notInstalled ? 'yellow' : 'error'}>{error}</Text>
        <Text dimColor>Press any key to continue…</Text>
      </Box>
    );
  }

  return <LoadingState message={prompt ? 'Opening A:// Studio with your prompt…' : 'Opening A:// Studio…'} />;
}

export async function call(
  onDone: (
    result?: string,
    options?: { display?: CommandResultDisplay },
  ) => void,
  _context: unknown,
  args: string,
): Promise<React.ReactNode> {
  return <DesignOpen prompt={(args ?? '').trim()} onDone={onDone} />;
}
