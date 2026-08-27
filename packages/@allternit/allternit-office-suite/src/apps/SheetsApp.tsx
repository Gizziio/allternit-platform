import { useMemo, useRef } from 'react';
import {
  SheetsApp as VendoredSheetsApp,
  type SheetsAppProps as VendoredSheetsAppProps,
} from '@allternit/office-sheets-app';
import { useOfficeHostRequired } from '../bridge/OfficeHostContext';

export interface SheetsAppProps
  extends Omit<VendoredSheetsAppProps, 'onSave'> {
  readOnly?: boolean;
}

/**
 * Host-aware Sheets adapter.
 *
 * Consumes `OfficeHost` from context and wires `host.saveFile` into the
 * vendored Sheets app as its persistence callback. A ref keeps the callback
 * stable across host updates because the vendored bridge is installed only
 * on the first render.
 */
export function SheetsApp(props: SheetsAppProps): React.ReactNode {
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

  return <VendoredSheetsApp {...props} onSave={onSave} />;
}
