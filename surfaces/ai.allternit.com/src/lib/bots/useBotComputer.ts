/**
 * Bots-rail computer status (spec bot-identity-computer).
 *
 * Polls `/api/v1/computers?bot_id=…` so a bot card can show the live state of
 * the bot's persistent Computer Cloud desktop: provisioning / running /
 * stopped / error.
 */

import { useEffect, useState } from 'react';
import type { Agent } from '@/lib/agents/agent.types';
import { listComputers, type Computer, type ComputerStatus } from '@/lib/computers-api';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useBotComputer');

export type BotComputerStatus = 'provisioning' | 'running' | 'stopped' | 'error' | 'none';

export const BOT_COMPUTER_STATUS_LABEL: Record<BotComputerStatus, string> = {
  provisioning: 'Provisioning computer',
  running: 'Computer running',
  stopped: 'Computer stopped',
  error: 'Computer error',
  none: 'No computer',
};

export function mapBotComputerStatus(status: ComputerStatus | undefined): BotComputerStatus {
  switch (status) {
    case 'creating':
      return 'provisioning';
    case 'running':
      return 'running';
    case 'stopped':
      return 'stopped';
    case 'error':
      return 'error';
    default:
      // No record yet — Create Bot provisions on submit, so treat "not found"
      // as provisioning rather than absent.
      return 'provisioning';
  }
}

export interface BotComputerState {
  status: BotComputerStatus;
  computer: Computer | null;
}

const IDLE: BotComputerState = { status: 'none', computer: null };

export function useBotComputer(bot: Agent, pollMs = 15_000): BotComputerState {
  const enabled = bot.vmOperator?.enabled === true && Boolean(bot.id);
  const [state, setState] = useState<BotComputerState>(IDLE);

  useEffect(() => {
    if (!enabled) {
      setState(IDLE);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const computers = await listComputers({ bot_id: bot.id, kind: 'cloud_desktop' });
        if (cancelled) return;
        const bound = computers
          .filter((c) => c.status !== 'deleted')
          .sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at).getTime() -
              new Date(a.updated_at || a.created_at).getTime(),
          )[0];
        setState({
          status: mapBotComputerStatus(bound?.status),
          computer: bound ?? null,
        });
      } catch (err) {
        if (cancelled) return;
        logger.warn({ err, botId: bot.id }, 'Failed to refresh bot computer status');
      }
    };
    void refresh();
    const timer = setInterval(refresh, pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, bot.id, pollMs]);

  return enabled ? state : IDLE;
}
