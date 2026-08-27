import { useMemo, useRef } from 'react';
import {
  SlidesApp as VendoredSlidesApp,
  type SlidesAppProps as VendoredSlidesAppProps,
} from '@allternit/office-slides-app';
import { useOfficeHostRequired } from '../bridge/OfficeHostContext';

export interface SlidesAppProps
  extends Omit<VendoredSlidesAppProps, 'onSave'> {
  readOnly?: boolean;
}

/**
 * Host-aware Slides adapter.
 *
 * Consumes `OfficeHost` from context and wires `host.saveFile` into the
 * vendored Slides app as its persistence callback. A ref keeps the callback
 * stable across host updates because the vendored bridge is installed only
 * on the first render.
 */
export function SlidesApp(props: SlidesAppProps): React.ReactNode {
  const host = useOfficeHostRequired();
  const hostRef = useRef(host);
  hostRef.current = host;

  const onSave = useMemo(
    () =>
      (bytes: Uint8Array, name: string): void => {
        void hostRef.current.saveFile(bytes, name).catch(() => {
          // Persistence failures are surfaced by the host itself.
        });
      },
    [],
  );

  return <VendoredSlidesApp {...props} onSave={onSave} />;
}
