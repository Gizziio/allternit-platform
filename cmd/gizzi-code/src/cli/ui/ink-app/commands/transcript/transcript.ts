// @ts-nocheck
import type { LocalCommandCall } from '../../types/command.js'
import { runInPager } from '../../utils/editor.js'
import { getTranscriptPath } from '../../utils/sessionStorage.js'

export const call: LocalCommandCall = async () => {
  const transcriptPath = getTranscriptPath()
  const launched = runInPager(transcriptPath)
  if (!launched) {
    return {
      type: 'text',
      value: `Could not open a pager. Transcript path: ${transcriptPath}`,
    }
  }
  return { type: 'skip' }
}
