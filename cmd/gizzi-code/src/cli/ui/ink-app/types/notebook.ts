export function notebook_ts(): void {
  // Not yet implemented
}

export default notebook_ts

// Jupyter notebook (nbformat v4) shapes consumed by NotebookEditTool and
// shared/utils/notebook.ts. The upstream canonical types live outside this
// fork; these mirrors cover the cell/document slice the tools read and write.
export interface NotebookCell {
  cell_type: string
  source: string[] | string
  metadata: Record<string, unknown>
  outputs?: unknown[]
  execution_count?: number | null
  id?: string
}

export interface NotebookContent {
  cells: NotebookCell[]
  metadata: {
    language_info?: { name?: string }
    [key: string]: unknown
  }
  nbformat: number
  nbformat_minor: number
}
