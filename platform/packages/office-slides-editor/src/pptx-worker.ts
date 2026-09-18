import { createBlankPptx, openPptx, savePptx } from '@allternit/office-pptx-engine'

export type PptxWorkerRequest =
  | { type: 'roundtrip-file'; bytes: Uint8Array }
  | { type: 'roundtrip-blank' }

export type PptxWorkerResponse =
  | { type: 'roundtrip-result'; originalSize: number; outputSize: number; changed: boolean; title: string }
  | { type: 'error'; message: string }

function deckTitle(slides: { elements: unknown[] }[]): string {
  for (const slide of slides) {
    for (const el of slide.elements) {
      const text = (el as { text?: { paragraphs?: { runs?: { text?: string }[] }[] } }).text
      const line = text?.paragraphs
        ?.map((p) => (p.runs ?? []).map((r) => r.text ?? '').join('').trim())
        .find((l) => l)
      if (line) return line
    }
  }
  return 'Untitled'
}

self.onmessage = async (event: MessageEvent<PptxWorkerRequest>) => {
  try {
    const req = event.data
    let bytes: Uint8Array

    if (req.type === 'roundtrip-blank') {
      bytes = await createBlankPptx()
    } else if (req.type === 'roundtrip-file') {
      bytes = req.bytes
    } else {
      self.postMessage({ type: 'error', message: 'unknown request type' } as PptxWorkerResponse)
      return
    }

    const opened = await openPptx(bytes)
    const output = await savePptx(opened)

    self.postMessage({
      type: 'roundtrip-result',
      originalSize: bytes.byteLength,
      outputSize: output.byteLength,
      changed: bytes.byteLength !== output.byteLength,
      title: deckTitle(opened.deck.slides),
    } as PptxWorkerResponse)
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message } as PptxWorkerResponse)
  }
}
