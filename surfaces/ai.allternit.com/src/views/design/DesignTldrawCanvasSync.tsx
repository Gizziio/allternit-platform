"use client";

/**
 * Sync-enabled wrapper for the design canvas.
 *
 * Loaded lazily from DesignTldrawCanvas when `roomId` is provided.
 * Kept in a separate file so useSyncStore (a hook) is always called
 * at the top level — not conditionally — while the parent can still
 * decide whether to render this at all.
 *
 * Requires @tldraw/sync (installed via pnpm install after adding to package.json).
 * Sync server: `pnpm sync:dev`  (scripts/tldraw-sync-server.mjs on :5858)
 */

import React, { useCallback, useRef } from 'react';
import {
  Tldraw,
  createShapeId,
  Editor,
  type TLAnyShapeUtilConstructor,
  type TLAssetStore,
} from 'tldraw';
import { useSync } from '@tldraw/sync';
import type { DesignTldrawCanvasInnerProps } from './DesignTldrawCanvas';
import '@/lib/tldraw/custom-shapes';

const SYNC_SERVER_URL = process.env.NEXT_PUBLIC_TLDRAW_SYNC_URL ?? 'ws://localhost:5858';

const syncAssetStore: TLAssetStore = {
  upload: async (_asset, file) => ({
    src: URL.createObjectURL(file),
  }),
  resolve: (asset) => asset.props.src,
};

interface DesignTldrawCanvasSyncProps extends DesignTldrawCanvasInnerProps {
  roomId: string;
  customShapeUtils: readonly TLAnyShapeUtilConstructor[];
}

export function DesignTldrawCanvasSync({
  roomId,
  projectName = 'Untitled',
  customShapeUtils,
  onMount: onMountExternal,
}: DesignTldrawCanvasSyncProps) {
  const uri = `${SYNC_SERVER_URL}/connect?roomId=${encodeURIComponent(roomId)}`;

  const store = useSync({
    uri,
    assets: syncAssetStore,
    userInfo: {
      id: typeof window !== 'undefined' ? (sessionStorage.getItem('userId') ?? 'anon') : 'anon',
      name: 'Designer',
      color: '#e27c59',
    },
  });

  const editorRef = useRef<Editor | null>(null);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;
    // Seed default frame only if the synced document is empty
    const shapes = editor.getCurrentPageShapes();
    if (shapes.length === 0) {
      editor.createShapes([{
        id: createShapeId('default-frame'),
        type: 'design-frame',
        x: 80, y: 80,
        props: { w: 390, h: 844, label: projectName, fill: '#ffffff' },
      }]);
      editor.zoomToFit({ animation: { duration: 0 } });
    }
    onMountExternal?.(editor);
  }, [projectName, onMountExternal]);

  return (
    <Tldraw
      store={store}
      shapeUtils={customShapeUtils}
      onMount={handleMount}
      inferDarkMode
    />
  );
}
