import * as React from 'react'
import { Dialog } from '../../components/design-system/Dialog'
import { MemoryFileSelector } from '../../components/memory/MemoryFileSelector'
import { Box, Text } from '../../ink'
import type { SetToolJSXFn } from '../../Tool.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { clearMemoryFileCaches } from '../gizzimd.js'
import { logError } from '../log.js'
import {
  appendToMemoryFile,
  extractMemoryQuickAddText,
} from '../memory/quickAdd.js'
import {
  createCommandInputMessage,
  createMemoryUpdatedMessage,
  createUserMessage,
} from '../messages.js'
import type {
  ProcessUserInputBaseResult,
  ProcessUserInputContext,
} from './processUserInput.js'

type QuickAddDialogProps = {
  memoryText: string
  onSaved: (memoryPath: string) => void
  onCancel: (errorText?: string) => void
}

function MemoryQuickAddDialog({
  memoryText,
  onSaved,
  onCancel,
}: QuickAddDialogProps): React.ReactNode {
  const handleSelect = async (memoryPath: string) => {
    try {
      await appendToMemoryFile(memoryPath, memoryText)
      clearMemoryFileCaches()
      onSaved(memoryPath)
    } catch (error) {
      logError(error)
      onCancel(`Error saving memory: ${error}`)
    }
  }
  return (
    <Dialog title="Save to memory" onCancel={() => onCancel()} color="remember">
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text>{memoryText}</Text>
        </Box>
        <React.Suspense fallback={null}>
          <MemoryFileSelector
            variant="quick-add"
            onSelect={handleSelect}
            onCancel={() => onCancel()}
          />
        </React.Suspense>
      </Box>
    </Dialog>
  )
}

/**
 * `#` quick-add (Claude Code memory parity): `#<note>` opens a selector over
 * the same file candidates as /memory, appends the note as a bullet to the
 * chosen file (creating it when missing), and confirms with the
 * MemoryUpdateNotification banner in the transcript. A bare `#` routes to the
 * /memory editor flow instead (nothing to append).
 */
export async function processMemoryQuickAdd(
  inputString: string,
  context: ProcessUserInputContext,
  setToolJSX: SetToolJSXFn,
  uuid?: string,
): Promise<ProcessUserInputBaseResult> {
  const memoryText = extractMemoryQuickAddText(inputString)

  if (!memoryText) {
    const { call } = await import('../../commands/memory/memory.js')
    return new Promise(resolve => {
      let done = false
      const onDone: LocalJSXCommandOnDone = (result, options) => {
        done = true
        resolve({
          messages: [
            createUserMessage({ content: inputString, uuid }),
            ...(result && options?.display !== 'skip'
              ? [
                  createCommandInputMessage(
                    `<local-command-stdout>${result}</local-command-stdout>`,
                  ),
                ]
              : []),
          ],
          shouldQuery: false,
        })
      }
      void Promise.resolve(call(onDone, context, '')).then(jsx => {
        if (jsx && !done) {
          setToolJSX({
            jsx,
            shouldHidePromptInput: false,
            isLocalJSXCommand: true,
          })
        }
      })
    })
  }

  return new Promise(resolve => {
    const finish = (memoryPath?: string, errorText?: string) => {
      resolve({
        messages: [
          createUserMessage({ content: inputString, uuid }),
          ...(memoryPath ? [createMemoryUpdatedMessage(memoryPath)] : []),
          ...(errorText
            ? [
                createCommandInputMessage(
                  `<local-command-stderr>${errorText}</local-command-stderr>`,
                ),
              ]
            : []),
        ],
        shouldQuery: false,
      })
    }
    setToolJSX({
      jsx: (
        <MemoryQuickAddDialog
          memoryText={memoryText}
          onSaved={memoryPath => finish(memoryPath)}
          onCancel={errorText => finish(undefined, errorText)}
        />
      ),
      shouldHidePromptInput: false,
    })
  })
}
