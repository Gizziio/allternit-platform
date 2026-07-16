function alignedSize(bytes: number): number {
  return Math.max(4, Math.ceil(bytes / 4) * 4);
}

export class GpuBufferArena {
  private readonly buffers = new Set<GPUBuffer>();

  constructor(private readonly device: GPUDevice) {}

  create(bytes: number, usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, label?: string): GPUBuffer {
    const buffer = this.device.createBuffer({ size: alignedSize(bytes), usage, label });
    this.buffers.add(buffer);
    return buffer;
  }

  upload(data: ArrayBufferView, usage = GPUBufferUsage.STORAGE, label?: string): GPUBuffer {
    const buffer = this.create(data.byteLength, usage | GPUBufferUsage.COPY_DST, label);
    this.device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
    return buffer;
  }

  uniform(values: readonly number[], label?: string): GPUBuffer {
    return this.upload(new Uint32Array(values), GPUBufferUsage.UNIFORM, label);
  }

  release(buffer: GPUBuffer): void {
    if (!this.buffers.delete(buffer)) return;
    buffer.destroy();
  }

  destroy(): void {
    for (const buffer of this.buffers) buffer.destroy();
    this.buffers.clear();
  }
}

