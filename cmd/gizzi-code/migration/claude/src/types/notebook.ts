/**
 * Notebook types
 */

export interface NotebookCell {
  id: string
  type: 'code' | 'markdown'
  cell_type?: 'code' | 'markdown'
  content?: string
  source?: string | string[]
  output?: string
  executionCount?: number
  execution_count?: number
  outputs?: NotebookCellOutput[]
  [key: string]: unknown
}

export interface NotebookCellOutput {
  output_type: 'stream' | 'execute_result' | 'display_data' | 'error'
  text?: string | string[]
  data?: Record<string, unknown>
  ename?: string
  evalue?: string
  traceback?: string[]
  image?: {
    image_data: string
    media_type: string
  }
  [key: string]: unknown
}

export interface NotebookCellSource {
  cellType?: 'code' | 'markdown'
  source?: string
  execution_count?: number
  cell_id?: string
  language?: string
  [key: string]: unknown
}

export interface NotebookCellSourceOutput {
  output_type?: string
  text?: string | string[]
  image?: {
    image_data: string
    media_type: string
  }
  [key: string]: unknown
}

export interface NotebookOutputImage {
  image_data: string
  media_type: string
  [key: string]: unknown
}

export interface Notebook {
  cells: NotebookCell[]
  metadata: Record<string, unknown>
  version: string
}

export interface NotebookEdit {
  cellId: string
  oldContent: string
  newContent: string
}

export interface NotebookContent {
  cells: NotebookCell[]
  metadata: Record<string, unknown>
}
