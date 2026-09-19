import * as React from 'react';
import { use } from 'react';
import { Box } from '../ink';
import type { AgentDefinitionsResult } from '../tools/AgentTool/loadAgentsDir';
import { getMemoryFiles } from '../utils/gizzimd';
import { getGlobalConfig } from '../utils/config';
import { getActiveNotices, type StatusNoticeContext } from '../utils/statusNoticeDefinitions';
type Props = {
  agentDefinitions?: AgentDefinitionsResult;
};

/**
 * StatusNotices contains the information displayed to users at startup. We have
 * moved neutral or positive status to src/components/Status.tsx instead, which
 * users can access through /status.
 */
export function StatusNotices(t0) {
  const {
    agentDefinitions
  } = t0 === undefined ? {} : t0;
  const t1 = getGlobalConfig();
  const t2 = getMemoryFiles();

  const context = {
    config: t1,
    agentDefinitions,
    memoryFiles: use(t2)
  };
  const activeNotices = getActiveNotices(context);
  if (activeNotices.length === 0) {
    return null;
  }
  const T0 = Box;
  const t3 = "column";
  const t4 = 1;
  const t5 = activeNotices.map(notice => <React.Fragment key={notice.id}>{notice.render(context)}</React.Fragment>);
  const t6 = <T0 flexDirection={t3} paddingLeft={t4}>{t5}</T0>;

  return t6;
}
