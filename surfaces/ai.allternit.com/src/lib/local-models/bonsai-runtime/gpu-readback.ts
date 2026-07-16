export async function readGpuFloat32(device: GPUDevice, source: GPUBuffer, elements: number): Promise<Float32Array> {
  const bytes = elements * 4;
  const read = device.createBuffer({ size: Math.max(4, bytes), usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  try {
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(source, 0, read, 0, bytes);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    return new Float32Array(read.getMappedRange().slice(0));
  } finally {
    if (read.mapState === "mapped") read.unmap();
    read.destroy();
  }
}

export async function gpuPixelsToPng(device: GPUDevice, source: GPUBuffer, width: number, height: number): Promise<Blob> {
  const values = await readGpuFloat32(device, source, width * height * 3);
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      rgba[pixel * 4 + channel] = Math.round(Math.max(0, Math.min(255, (values[pixel * 3 + channel] + 1) * 127.5)));
    }
    rgba[pixel * 4 + 3] = 255;
  }
  if (typeof OffscreenCanvas === "undefined") throw new Error("Owned Bonsai PNG conversion requires OffscreenCanvas");
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create a 2D canvas for Bonsai output");
  context.putImageData(new ImageData(rgba, width, height), 0, 0);
  return canvas.convertToBlob({ type: "image/png" });
}

