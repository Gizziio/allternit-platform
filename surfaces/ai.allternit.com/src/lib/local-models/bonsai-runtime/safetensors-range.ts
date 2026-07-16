export type SafeTensorDtype = "BF16" | "F16" | "F32" | "I32" | "U32" | "U8";

export interface SafeTensorInfo {
  dtype: SafeTensorDtype;
  shape: number[];
  data_offsets: [number, number];
}

export interface SafeTensorHeader {
  __metadata__?: Record<string, string>;
  [tensor: string]: SafeTensorInfo | Record<string, string> | undefined;
}

const HEADER_PREFIX_BYTES = 8;
const MAX_HEADER_BYTES = 64 * 1024 * 1024;

function littleEndianUint64(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const value = view.getBigUint64(0, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Safetensors header exceeds JavaScript's safe integer range");
  return Number(value);
}

async function requireRange(
  url: string,
  start: number,
  endInclusive: number,
  fetchImpl: typeof fetch,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetchImpl(url, {
    headers: { Range: `bytes=${start}-${endInclusive}` },
    signal,
    cache: "no-store",
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (response.status !== 206) throw new Error(`Safetensors source refused byte range ${start}-${endInclusive} (${response.status})`);
  const contentRange = response.headers.get("content-range");
  if (!contentRange?.startsWith(`bytes ${start}-${endInclusive}/`)) {
    throw new Error(`Unexpected Content-Range: ${contentRange ?? "missing"}`);
  }
  const buffer = await response.arrayBuffer();
  const expected = endInclusive - start + 1;
  if (buffer.byteLength !== expected) throw new Error(`Range returned ${buffer.byteLength} bytes; expected ${expected}`);
  return buffer;
}

export class SafeTensorsRangeReader {
  private header?: SafeTensorHeader;
  private dataStart?: number;

  constructor(
    readonly url: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async readHeader(signal?: AbortSignal): Promise<SafeTensorHeader> {
    if (this.header) return this.header;
    const prefix = new Uint8Array(await requireRange(this.url, 0, HEADER_PREFIX_BYTES - 1, this.fetchImpl, signal));
    const headerBytes = littleEndianUint64(prefix);
    if (headerBytes <= 1 || headerBytes > MAX_HEADER_BYTES) throw new Error(`Invalid safetensors header length: ${headerBytes}`);
    const encoded = await requireRange(this.url, HEADER_PREFIX_BYTES, HEADER_PREFIX_BYTES + headerBytes - 1, this.fetchImpl, signal);
    const parsed = JSON.parse(new TextDecoder().decode(encoded)) as SafeTensorHeader;
    this.header = parsed;
    this.dataStart = HEADER_PREFIX_BYTES + headerBytes;
    return parsed;
  }

  async tensorInfo(name: string, signal?: AbortSignal): Promise<SafeTensorInfo> {
    const entry = (await this.readHeader(signal))[name] as SafeTensorInfo | undefined;
    if (!entry || !Array.isArray(entry.data_offsets) || !Array.isArray(entry.shape)) {
      throw new Error(`Tensor not found in safetensors header: ${name}`);
    }
    return entry;
  }

  async readTensor(name: string, signal?: AbortSignal): Promise<{ info: SafeTensorInfo; data: ArrayBuffer }> {
    const info = await this.tensorInfo(name, signal);
    const dataStart = this.dataStart;
    if (dataStart === undefined) throw new Error("Safetensors header was not initialized");
    const [start, endExclusive] = info.data_offsets;
    if (start < 0 || endExclusive <= start) throw new Error(`Invalid offsets for tensor ${name}`);
    return {
      info,
      data: await requireRange(this.url, dataStart + start, dataStart + endExclusive - 1, this.fetchImpl, signal),
    };
  }

  async readRows(name: string, rows: readonly number[], signal?: AbortSignal): Promise<{ info: SafeTensorInfo; data: ArrayBuffer }> {
    const info = await this.tensorInfo(name, signal);
    if (info.shape.length !== 2) throw new Error(`${name} is not a two-dimensional tensor`);
    const bytesPerElement = dtypeBytes(info.dtype);
    const rowBytes = info.shape[1] * bytesPerElement;
    const dataStart = this.dataStart;
    if (dataStart === undefined) throw new Error("Safetensors header was not initialized");
    const tensorStart = dataStart + info.data_offsets[0];
    const parts = await Promise.all(rows.map(async row => {
      if (!Number.isInteger(row) || row < 0 || row >= info.shape[0]) throw new Error(`Invalid row ${row} for ${name}`);
      const start = tensorStart + row * rowBytes;
      return new Uint8Array(await requireRange(this.url, start, start + rowBytes - 1, this.fetchImpl, signal));
    }));
    const combined = new Uint8Array(rows.length * rowBytes);
    parts.forEach((part, index) => combined.set(part, index * rowBytes));
    return { info: { ...info, shape: [rows.length, info.shape[1]], data_offsets: [0, combined.byteLength] }, data: combined.buffer };
  }
}

function dtypeBytes(dtype: SafeTensorDtype): number {
  if (dtype === "U8") return 1;
  if (dtype === "BF16" || dtype === "F16") return 2;
  return 4;
}
