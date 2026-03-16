/**
 * Action Icons
 * 
 * Icons for user actions, operations, and interactive elements.
 * 
 * @module @a2r/platform/icons/categories/actions
 */

export const actionIcons = [
  'add',
  'remove',
  'edit',
  'delete',
  'save',
  'cancel',
  'submit',
  'search',
  'filter',
  'sort',
  'refresh',
  'download',
  'upload',
  'copy',
  'paste',
  'cut',
  'undo',
  'redo',
  'more-horizontal',
  'more-vertical',
  'drag-handle',
  'maximize',
  'minimize',
  'pin',
  'unpin',
  'link',
  'unlink',
  'send',
  'play',
  'pause',
  'stop',
] as const;

export type ActionIcon = typeof actionIcons[number];
