import { buildBlankDocx, parseDocx, saveDocx } from '@allternit/office-docx-engine'

export type DocxWorkerRequest =
  | { type: 'roundtrip-file'; bytes: Uint8Array }
  | { type: 'roundtrip-blank' }

export type DocxWorkerResponse =
  | { type: 'roundtrip-result'; originalSize: number; outputSize: number; changed: boolean; title: string }
  | { type: 'error'; message: string }

self.onmessage = async (event: MessageEvent<DocxWorkerRequest>) => {
  try {
    const req = event.data
    let bytes: Uint8Array

    if (req.type === 'roundtrip-blank') {
      bytes = await buildBlankDocx()
    } else if (req.type === 'roundtrip-file') {
      bytes = req.bytes
    } else {
      self.postMessage({ type: 'error', message: 'unknown request type' } as DocxWorkerResponse)
      return
    }

    const doc = await parseDocx(bytes)
    const visibleBlocks = doc.blocks.filter((b) => !b.hidden && b.docxIndex != null)
    const saveBlocks = visibleBlocks.map((b) => ({ kind: 'original' as const, docxIndex: b.docxIndex! }))
    const output = await saveDocx(doc, saveBlocks)

    const titleBlock = doc.blocks.find((b) => (b.type === 'paragraph' || b.type === 'heading') && b.runs?.some((r) => r.text?.trim()))
    const title = titleBlock?.runs?.map((r) => r.text).join('').trim() ?? 'Untitled'

    self.postMessage({
      type: 'roundtrip-result',
      originalSize: bytes.byteLength,
      outputSize: output.byteLength,
      changed: bytes.byteLength !== output.byteLength,
      title,
    } as DocxWorkerResponse)
  } catch (err) {
    self.postMessage({ type: 'error', message: (err as Error).message } as DocxWorkerResponse)
  }
}
