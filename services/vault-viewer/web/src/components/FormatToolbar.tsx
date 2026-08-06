import { useEffect, useState } from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';
import {
  fmtInline,
  fmtChecklist,
  fmtPrefixLines,
  fmtInsert,
  fmtLink,
  fmtIndent,
  fmtOutdent,
  fmtUndo,
  fmtRedo,
} from '../lib/activeEditor';

type Btn = { icon: IconName; title: string; run: () => void };

const BUTTONS: Btn[] = [
  { icon: 'heading', title: 'Heading', run: () => fmtPrefixLines('# ') },
  { icon: 'bold', title: 'Bold', run: () => fmtInline('**') },
  { icon: 'italic', title: 'Italic', run: () => fmtInline('*') },
  { icon: 'list', title: 'Bullet list', run: () => fmtPrefixLines('- ') },
  { icon: 'check-square', title: 'Checklist', run: () => fmtChecklist() },
  { icon: 'quote', title: 'Quote', run: () => fmtPrefixLines('> ') },
  { icon: 'brackets', title: 'Internal link', run: () => fmtInsert('[[]]', 2) },
  { icon: 'link', title: 'Link', run: () => fmtLink() },
  { icon: 'code', title: 'Inline code', run: () => fmtInline('`') },
  { icon: 'hash', title: 'Tag', run: () => fmtInsert('#') },
  { icon: 'indent-increase', title: 'Indent', run: () => fmtIndent() },
  { icon: 'indent-decrease', title: 'Outdent', run: () => fmtOutdent() },
  { icon: 'undo', title: 'Undo', run: () => fmtUndo() },
  { icon: 'redo', title: 'Redo', run: () => fmtRedo() },
];

function Buttons({ size }: { size: number }) {
  return (
    <>
      {BUTTONS.map((b) => (
        <button
          key={b.title}
          title={b.title}
          // Keep the editor focused / the keyboard open when a button is pressed.
          onPointerDown={(e) => e.preventDefault()}
          onClick={b.run}
        >
          <Icon name={b.icon} size={size} />
        </button>
      ))}
    </>
  );
}

/**
 * Markdown formatting toolbar (Obsidian Mobile-style). Two layouts:
 * - mobile: fixed above the on-screen keyboard (anchored via the visual viewport,
 *   since iOS Safari doesn't reflow fixed elements for the keyboard).
 * - desktop: an in-flow strip rendered right under the view header.
 */
export default function FormatToolbar({ mobile = false }: { mobile?: boolean }) {
  const [bottom, setBottom] = useState(0);

  useEffect(() => {
    if (!mobile) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      // Gap between the layout-viewport bottom and the visual-viewport bottom =
      // height of the on-screen keyboard (0 when hidden).
      const gap = window.innerHeight - (vv.height + vv.offsetTop);
      setBottom(Math.max(0, gap));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [mobile]);

  if (mobile) {
    return (
      <div className="mobile-toolbar" style={{ bottom }}>
        <Buttons size={20} />
      </div>
    );
  }
  return (
    <div className="format-toolbar">
      <Buttons size={16} />
    </div>
  );
}
