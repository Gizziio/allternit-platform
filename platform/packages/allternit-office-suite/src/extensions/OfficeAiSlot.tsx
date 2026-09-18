import type { ReactNode } from 'react';
import { useOfficeHost } from '../bridge/OfficeHostContext';
import type {
  OfficeAppKey,
  OfficeExtensionContext,
} from '../bridge/types';
import { AllternitBrandMark } from '../components/AllternitBrandMark';
import './OfficeAiSlot.css';

export interface OfficeAiSlotProps {
  /** The office app whose AI chat section this slot occupies. */
  appKey: OfficeAppKey;
  /**
   * The app's built-in AI panel, exactly as it was rendered before the slot
   * existed. Rendered unchanged when the host registered no extensions. When
   * extensions ARE registered the agent panes are the only chat surface, so
   * the built-in panel is not mounted.
   */
  fallback: ReactNode;
  /**
   * True while the surrounding dock is collapsed to its slim rail. The slot
   * renders its own branded collapsed rail (with an expand control when
   * `expand` is provided). Every extension pane stays mounted but hidden so
   * re-expanding never drops panel state.
   */
  collapsed?: boolean;
  /** Expands the surrounding dock from the slot's collapsed rail. */
  expand?: () => void;
  /** Forwarded into the extension context so extensions can close the section. */
  close?: () => void;
  className?: string;
}

/**
 * Occupies the per-app AI chat section with the host's extensions.
 *
 * Decision rule: no registered extensions → render `fallback` exactly as
 * today. Otherwise the registered agent panes are the only chat surface —
 * there is deliberately NO tab strip: with a single agent extension the tab
 * only repeated the panel's own header (brand + name), and each pane's header
 * already carries the functional controls (model picker, new chat, close).
 * All panes stay mounted and are toggled with the `hidden` attribute so
 * extensions keep their state across dock collapse/expand.
 */
export function OfficeAiSlot({
  appKey,
  fallback,
  collapsed = false,
  expand,
  close,
  className,
}: OfficeAiSlotProps): ReactNode {
  const host = useOfficeHost();
  const extensions = host?.extensions ?? [];

  // No extensions registered: preserve the pre-slot behavior exactly.
  if (extensions.length === 0) {
    return <>{fallback}</>;
  }

  const active = extensions[0]!.id;
  const ctx: OfficeExtensionContext = close
    ? { appKey, host: host!, close }
    : { appKey, host: host! };

  const classes = ['office-ai-slot'];
  if (collapsed) classes.push('office-ai-slot-collapsed');
  if (className) classes.push(className);

  if (collapsed) {
    return (
      <div className={classes.join(' ')}>
        <button
          type="button"
          className="office-ext-rail"
          title="Expand Allternit Office Agent"
          onClick={expand}
          disabled={!expand}
        >
          <AllternitBrandMark size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className={classes.join(' ')}>
      <div className="office-ext-body">
        {extensions.map((ext) => (
          <div
            key={ext.id}
            className="office-ext-pane"
            hidden={active !== ext.id}
          >
            {ext.render(ctx)}
          </div>
        ))}
      </div>
    </div>
  );
}
