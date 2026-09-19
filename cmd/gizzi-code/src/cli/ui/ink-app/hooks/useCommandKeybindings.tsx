/**
 * Component that registers keybinding handlers for command bindings.
 *
 * Must be rendered inside KeybindingSetup to have access to the keybinding context.
 * Reads "command:*" actions from the current keybinding configuration and registers
 * handlers that invoke the corresponding slash command via onSubmit.
 *
 * Commands triggered via keybinding are treated as "immediate" - they execute right
 * away and preserve the user's existing input text (the prompt is not cleared).
 */
import { useMemo } from 'react';
import { useIsModalOverlayActive } from '../context/overlayContext';
import { useOptionalKeybindingContext } from '../keybindings/KeybindingContext';
import { useKeybindings } from '../keybindings/useKeybinding';
import type { PromptInputHelpers } from '../utils/handlePromptSubmit';
type Props = {
  // onSubmit accepts additional parameters beyond what we pass here,
  // so we use a rest parameter to allow any additional args
  onSubmit: (input: string, helpers: PromptInputHelpers, ...rest: [speculationAccept?: undefined, options?: {
    fromKeybinding?: boolean;
  }]) => void;
  /** Set to false to disable command keybindings (e.g., when a dialog is open) */
  isActive?: boolean;
};
const NOOP_HELPERS: PromptInputHelpers = {
  setCursorOffset: () => {},
  clearBuffer: () => {},
  resetHistory: () => {}
};

/**
 * Registers keybinding handlers for all "command:*" actions found in the
 * user's keybinding configuration. When triggered, each handler submits
 * the corresponding slash command (e.g., "command:commit" submits "/commit").
 */
export function CommandKeybindingHandlers({
    onSubmit,
    isActive: t1
}: Props) {
  const isActive = t1 === undefined ? true : t1;
  const keybindingContext = useOptionalKeybindingContext();
  const isModalOverlayActive = useIsModalOverlayActive();
  let t2;
  bb0: {
    if (!keybindingContext) {
      const t3 = new Set();

      t2 = t3;
      break bb0;
    }
    const actions = new Set();
    for (const binding of keybindingContext.bindings) {
        if (binding.action?.startsWith("command:")) {
          actions.add(binding.action);
        }
      }

    t2 = actions;
  }
  const commandActions = t2;
  const map = {};
  for (const action of commandActions) {
      const commandName = action.slice(8);
      map[action] = () => {
        onSubmit(`/${commandName}`, NOOP_HELPERS, undefined, {
          fromKeybinding: true
        });
      };
    }

  const handlers = map;
  const t3 = isActive && !isModalOverlayActive;
  const t4 = {
      context: "Chat",
      isActive: t3
    };

  useKeybindings(handlers, t4);
  return null;
}
