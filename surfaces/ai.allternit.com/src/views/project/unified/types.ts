/**
 * Unified project types used by the cross-mode Projects hub.
 *
 * Each mode (chat, cowork, code, design) keeps its own canonical project data.
 * This layer is a read-only/normalized projection used for listing, filtering,
 * and dispatching to the correct mode-specific detail view.
 */

export type ProjectMode = 'chat' | 'cowork' | 'code' | 'design' | 'bb';

export interface UnifiedProject {
  /** Stable ID used by the Projects hub (mode-prefixed to avoid collisions). */
  id: string;
  /** The native ID in the owning mode store. */
  nativeId: string;
  /** Display title. */
  title: string;
  /** Which mode owns this project. */
  mode: ProjectMode;
  /** Creation timestamp (ms). */
  createdAt: number;
  /** Last update timestamp (ms). */
  updatedAt: number;
  /** Whether the project is favorited by the user. */
  isFavorite: boolean;
  /** Whether the project is archived. */
  isArchived: boolean;
  /** Count of chat threads / code sessions / design sessions attached. */
  threadCount: number;
  /** Count of tasks (cowork) or agent sessions (chat/design). */
  taskCount: number;
  /** Count of attached files/sources. */
  fileCount: number;
  /** Optional description/subtitle. */
  description?: string;
}

export type ProjectCategory = 'all' | ProjectMode;

export interface ProjectStats {
  total: number;
  chat: number;
  cowork: number;
  code: number;
  design: number;
  bb: number;
  favorite: number;
  archived: number;
}
