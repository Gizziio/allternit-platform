import { useState } from 'react'
import type { ExtensionSidepanelComposerProps } from '../../../../../extension-shared/extension-sidepanel/ExtensionSidepanelShell.types'
import { CaptureComposer } from '@/html-to-figma/ui/CaptureComposer'

interface ResearchComposerProps extends ExtensionSidepanelComposerProps {}

const RESEARCH_PROMPT_PREFIX = `[Ultrabrowse deep-research mode]\nInvestigate the following topic thoroughly. Open multiple relevant tabs, compare sources, and synthesize a concise answer with citations. Prefer authoritative sources. Be skeptical of low-credibility pages. Topic:\n\n`

async function createResearchTask(query: string): Promise<void> {
  const result = await chrome.storage.local.get('AllternitClerkJwt')
  const token = result.AllternitClerkJwt
  if (!token) return

  try {
    await fetch('http://127.0.0.1:8013/api/v1/beta/research', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        mode: 'ultrabrowse',
        max_depth: 3,
        max_sources: 10,
      }),
    })
  } catch (error) {
    // Research task tracking is best-effort.
    console.debug('[Allternit Research] Failed to create task:', error)
  }
}

export function ResearchComposer(props: ResearchComposerProps) {
  const [researchMode, setResearchMode] = useState(false)

  const handleSubmit = (value?: string) => {
    const task = typeof value === 'string' ? value : props.value
    if (researchMode) {
      void createResearchTask(task)
      props.onSubmit(`${RESEARCH_PROMPT_PREFIX}${task}`)
    } else {
      props.onSubmit(task)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={researchMode}
            onChange={(e) => setResearchMode(e.target.checked)}
            className="size-3 rounded border-muted-foreground"
          />
          <span>Ultrabrowse deep-research mode</span>
        </label>
        {researchMode && (
          <span className="text-[9px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
            Multi-tab research
          </span>
        )}
      </div>
      <CaptureComposer
        {...props}
        onSubmit={handleSubmit}
        placeholder={
          researchMode
            ? 'Ask a research question...'
            : props.placeholder
        }
      />
    </div>
  )
}
