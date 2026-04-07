/**
 * File persistence types
 */

export interface FilePersistenceConfig {
  basePath: string
  maxFileSize?: number
  allowedExtensions?: string[]
}

export interface PersistedFile {
  path: string
  content: string
  timestamp: number
  checksum: string
}

export interface FileScanResult {
  files: string[]
  totalSize: number
  lastModified: number
}

// Constants
export const DEFAULT_UPLOAD_CONCURRENCY = 3
export const FILE_COUNT_LIMIT = 100
export const OUTPUTS_SUBDIR = 'outputs'

// Event types
export interface FilesPersistedEventData {
  files: string[]
  timestamp: number
  failed?: FailedPersistence[]
}

export interface FailedPersistence {
  path: string
  error: string
  timestamp: number
}

export type TurnStartTime = number
