// @ts-nocheck
import type {
  LocalJSXCommandContext,
  LocalJSXCommandOnDone,
} from '../../types/command.js'
import { getExternalEditor } from '../../utils/editor.js'
import { toIDEDisplayName } from '../../utils/ide.js'
import { editPromptInEditor } from '../../utils/promptEditor.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
): Promise<null> {
  const editor = getExternalEditor()
  if (!editor) {
    onDone(
      'No editor found. Set $VISUAL or $EDITOR (Gizzi tries vi last).',
      { display: 'system' },
    )
    return null
  }

  const result = await Promise.resolve(editPromptInEditor(''))
  if (result.error) {
    onDone(`Failed to edit prompt in ${toIDEDisplayName(editor)}: ${result.error}`, {
      display: 'system',
    })
    return null
  }

  if (result.content === null) {
    onDone(`Opened ${toIDEDisplayName(editor)} but the draft was discarded.`, {
      display: 'system',
    })
    return null
  }

  onDone(undefined, {
    display: 'skip',
    nextInput: result.content,
  })
  return null
}
