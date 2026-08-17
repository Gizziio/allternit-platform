import { useMemo, useRef } from 'react';
import {
  PdfApp as VendoredPdfApp,
  type PdfAppProps as VendoredPdfAppProps,
} from '@allternit/office-pdf-app';
import { useOfficeHostRequired } from '../bridge/OfficeHostContext';

export interface PdfAppProps extends Omit<VendoredPdfAppProps, 'onSave'> {}

/**
 * Host-aware PDF adapter.
 *
 * Consumes `OfficeHost` from context and wires `host.saveFile` into the
 * vendored PDF app as its persistence callback. A ref keeps the callback
 * stable across host updates because the vendored bridge is installed only
 * on the first render.
 */
export function PdfApp(props: PdfAppProps): React.ReactNode {
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

  return <VendoredPdfApp {...props} onSave={onSave} />;
}
