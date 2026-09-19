import chalk from '@/shared/util/chalk'
import type { UUID } from 'crypto';
import * as React from 'react';
import { getSessionId } from '../../bootstrap/state';
import type { CommandResultDisplay } from '../../commands';
import { Select } from '../../components/CustomSelect/select';
import { Dialog } from '../../components/design-system/Dialog';
import { COMMON_HELP_ARGS, COMMON_INFO_ARGS } from '../../constants/xml';
import { Box, Text } from '../../ink';
import { logEvent } from '../../services/analytics/index';
import type { LocalJSXCommandOnDone } from '../../types/command';
import { recursivelySanitizeUnicode } from '../../utils/sanitization';
import { getCurrentSessionTag, getTranscriptPath, saveTag } from '../../utils/sessionStorage';
function ConfirmRemoveTag(t0) {
  const {
    tagName,
    onConfirm,
    onCancel
  } = t0;
  const t1 = `Current tag: #${tagName}`;
  const t2 = <Text>This will remove the tag from the current session.</Text>;

  const t3 = value => value === "yes" ? onConfirm() : onCancel();

  const t4 = [{
      label: "Yes, remove tag",
      value: "yes"
    }, {
      label: "No, keep tag",
      value: "no"
    }];

  const t5 = <Box flexDirection="column" gap={1}>{t2}<Select onChange={t3} options={t4} /></Box>;

  const t6 = <Dialog title="Remove tag?" subtitle={t1} onCancel={onCancel} color="warning">{t5}</Dialog>;

  return t6;
}
function ToggleTagAndClose(t0) {
  const {
    tagName,
    onDone
  } = t0;
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [sessionId, setSessionId] = React.useState(null);
  const t1 = recursivelySanitizeUnicode(tagName).trim();

  const normalizedTag = t1;
  const t2 = () => {
      const id = getSessionId() as UUID;
      if (!id) {
        onDone("No active session to tag", {
          display: "system"
        });
        return;
      }
      if (!normalizedTag) {
        onDone("Tag name cannot be empty", {
          display: "system"
        });
        return;
      }
      setSessionId(id);
      const currentTag = getCurrentSessionTag(id);
      if (currentTag === normalizedTag) {
        logEvent("tengu_tag_command_remove_prompt", {});
        setShowConfirm(true);
      } else {
        const isReplacing = !!currentTag;
        logEvent("tengu_tag_command_add", {
          is_replacing: isReplacing
        });
        (async () => {
          const fullPath = getTranscriptPath();
          await saveTag(id, normalizedTag, fullPath);
          onDone(`Tagged session with ${chalk.cyan(`#${normalizedTag}`)}`, {
            display: "system"
          });
        })();
      }
    };
  const t3 = [normalizedTag, onDone];

  React.useEffect(t2, t3);
  if (showConfirm && sessionId) {
    const t4 = async () => {
        logEvent("tengu_tag_command_remove_confirmed", {});
        const fullPath_0 = getTranscriptPath();
        await saveTag(sessionId, "", fullPath_0);
        onDone(`Removed tag ${chalk.cyan(`#${normalizedTag}`)}`, {
          display: "system"
        });
      };

    const t5 = () => {
        logEvent("tengu_tag_command_remove_cancelled", {});
        onDone(`Kept tag ${chalk.cyan(`#${normalizedTag}`)}`, {
          display: "system"
        });
      };

    const t6 = <ConfirmRemoveTag tagName={normalizedTag} onConfirm={t4} onCancel={t5} />;

    return t6;
  }
  return null;
}
function ShowHelp(t0) {
  const {
    onDone
  } = t0;
  const t1 = () => {
      onDone("Usage: /tag <tag-name>\n\nToggle a searchable tag on the current session.\nRun the same command again to remove the tag.\nTags are displayed after the branch name in /resume and can be searched with /.\n\nExamples:\n  /tag bugfix        # Add tag\n  /tag bugfix        # Remove tag (toggle)\n  /tag feature-auth\n  /tag wip", {
        display: "system"
      });
    };
  const t2 = [onDone];

  React.useEffect(t1, t2);
  return null;
}
export async function call(onDone: LocalJSXCommandOnDone, _context: unknown, args?: string): Promise<React.ReactNode> {
  args = args?.trim() || '';
  if (COMMON_INFO_ARGS.includes(args) || COMMON_HELP_ARGS.includes(args)) {
    return <ShowHelp onDone={onDone} />;
  }
  if (!args) {
    return <ShowHelp onDone={onDone} />;
  }
  return <ToggleTagAndClose tagName={args} onDone={onDone} />;
}
