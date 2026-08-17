import { useMemo, useRef } from 'react';
import {
  DocsApp as VendoredDocsApp,
  type DocsAppProps as VendoredDocsAppProps,
} from '@allternit/office-docs-app';
import { useOfficeHostRequired } from '../bridge/OfficeHostContext';

export interface DocsAppProps
  extends Omit<VendoredDocsAppProps, 'onSave'> {
  readOnly?: boolean;
}

/**
 * Host-aware Docs adapter.
 *
 * Consumes `OfficeHost` from context and wires `host.saveFile` into the
 * vendored Docs app as its persistence callback. A ref keeps the callback
 * stable across host updates because the vendored bridge is installed only
 * on the first render.
 */
export function DocsApp(props: DocsAppProps): React.ReactNode {
  const host = useOfficeHostRequired();
  const hostRef = useRef(host);
  hostRef.current = host;

  const onSave = useMemo(
    () =>
      (bytes: Uint8Array, name: string): void => {
        void hostRef.current.saveFile(bytes, name).catch(() => {
          // The vendored bridge has no error channel; persistence failures are
          // surfaced by the host itself.
        });
      },
    [],
  );

  return <VendoredDocsApp {...props} onSave={onSave} />;
}
