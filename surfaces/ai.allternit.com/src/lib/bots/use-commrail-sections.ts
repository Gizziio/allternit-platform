/**
 * Live CommRails rail sections (Bot Agents BA-1).
 *
 * Bots come from the unified roster + operational-state projection.
 * Sessions come from the visibility DTO (empty copy if ao is down).
 * Needs-you is waiting_approval / waiting_input plus unread executor mail
 * and visibility.needsYou.
 */

import { useEffect, useMemo, useState } from 'react';
import { useUnifiedRoster } from './use-unified-roster';
import { useBotOperationalStateStore } from './bot-operational-state.store';
import { useCommRailsMailStore } from './commrails-mail.store';
import { useCommRailsStore } from './commrails-store';
import type { CommRailItem, CommRailSection } from './commrails-types';
import type { BotOperationalStatus } from './orpc-contracts';
import {
  EMPTY_VISIBILITY,
  fetchVisibility,
  isExecutorThread,
  paneStateToOperational,
  type VisibilityDto,
} from './commrails-visibility';
import { nativeSessionJoinKey, resolveAgentBrain } from './bot-brain';

const NEEDS_YOU_STATUSES = new Set<BotOperationalStatus>([
  'waiting_approval',
  'waiting_input',
  'blocked',
]);

export function useCommRailSections(): {
  sections: CommRailSection[];
  visibility: VisibilityDto;
} {
  const roster = useUnifiedRoster();
  const projections = useBotOperationalStateStore((s) => s.projections);
  const threads = useCommRailsMailStore((s) => s.threads);
  const groups = useCommRailsStore((s) => s.activeGroups);
  const [visibility, setVisibility] = useState<VisibilityDto>(EMPTY_VISIBILITY);

  useEffect(() => {
    let cancelled = false;
    void fetchVisibility()
      .then((dto) => {
        if (!cancelled) setVisibility(dto);
      })
      .catch(() => {
        if (!cancelled) setVisibility({ ...EMPTY_VISIBILITY });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sections = useMemo(() => {
    const botsSection: CommRailSection = {
      id: 'comrails-bots',
      title: 'Bots',
      type: 'bots',
      isDynamic: true,
      defaultExpanded: true,
      collapsible: true,
      items: roster.map((bot) => {
        const status =
          projections[bot.agent.id]?.state.status ?? bot.status;
        return {
          id: bot.id,
          label: bot.displayName,
          payload: bot.agent.id,
          status,
          accentColor: bot.accentColor,
          badge: projections[bot.agent.id]?.state.unreadMessagesCount,
        };
      }),
    };

    const groupsSection: CommRailSection = {
      id: 'comrails-groups',
      title: 'Groups',
      type: 'groups',
      isDynamic: true,
      defaultExpanded: false,
      collapsible: true,
      items: groups,
    };

    const nativeJoin = new Map<string, string>();
    for (const bot of roster) {
      const key = nativeSessionJoinKey(resolveAgentBrain(bot.agent));
      if (key) nativeJoin.set(key, bot.displayName);
    }

    const sessionItems: CommRailItem[] = visibility.aoRunning
      ? visibility.panes.map((pane) => ({
          id: pane.id,
          label: nativeJoin.get(pane.id) ?? pane.label,
          payload: pane.id,
          status: paneStateToOperational(pane.state),
        }))
      : [
          {
            id: 'ao-down',
            label: 'ao is not running',
            payload: '',
          },
        ];

    const sessionsSection: CommRailSection = {
      id: 'comrails-sessions',
      title: 'Sessions',
      type: 'sessions',
      isDynamic: true,
      defaultExpanded: true,
      collapsible: true,
      items: sessionItems,
    };

    const needItems: CommRailItem[] = [];
    for (const bot of roster) {
      const status = projections[bot.agent.id]?.state.status;
      if (status && NEEDS_YOU_STATUSES.has(status)) {
        needItems.push({
          id: `need-bot-${bot.id}`,
          label: bot.displayName,
          payload: bot.agent.id,
          status,
          accentColor: bot.accentColor,
        });
      }
    }
    for (const thread of threads) {
      if (isExecutorThread(thread.id) && thread.unreadCount > 0) {
        needItems.push({
          id: `need-thread-${thread.id}`,
          label: thread.subject || thread.id,
          payload: thread.id,
        });
      }
    }
    for (const need of visibility.needsYou) {
      needItems.push({
        id: `need-vis-${need.id}`,
        label: need.label,
        payload: need.id,
        status: 'waiting_input',
      });
    }

    const needsSection: CommRailSection = {
      id: 'comrails-needs-you',
      title: 'Needs you',
      type: 'sessions',
      isDynamic: true,
      defaultExpanded: needItems.length > 0,
      collapsible: true,
      items: needItems,
    };

    return [botsSection, groupsSection, sessionsSection, needsSection];
  }, [roster, projections, groups, visibility, threads]);

  return { sections, visibility };
}
