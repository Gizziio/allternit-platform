import type { OfficeFileInput } from './types';

export async function readFileArrayBuffer(file: OfficeFileInput): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Response(file as any).arrayBuffer();
}
