import { GpuBufferArena } from "./gpu-buffer-arena";
import type { LoadedDenseTensor } from "./packed-affine-loader";
import { VaeKernels } from "./vae-kernels";
import { BonsaiVaeReader } from "./vae-loader";
import { maximumBandRows, VaeTiledFeatureOps, type VaeTiledFeatureMap } from "./vae-tiled-feature-map";

export interface VaeDecodeResult { pixels: GPUBuffer; width: number; height: number; arena: GpuBufferArena }
interface FeatureMap { buffer: GPUBuffer; height: number; width: number; channels: number; arena: GpuBufferArena }

export class BonsaiVaeDecoder {
  private readonly kernels: VaeKernels;
  private readonly tiled: VaeTiledFeatureOps;
  constructor(private readonly device: GPUDevice, private readonly reader = new BonsaiVaeReader()) {
    this.kernels = new VaeKernels(device);
    this.tiled = new VaeTiledFeatureOps(device);
  }

  async decode(packedLatents: GPUBuffer, width: number, height: number, signal?: AbortSignal): Promise<VaeDecodeResult> {
    if (width % 32 || height % 32 || width <= 0 || height <= 0) throw new Error("VAE dimensions must be positive multiples of 32");
    let current = await this.prepareInput(packedLatents, width, height, signal);
    try {
      current = await this.replace(current, this.resnet(current, "decoder.mid_block.resnets.0", 512, signal));
      current = await this.replace(current, this.attention(current, "decoder.mid_block.attentions.0", signal));
      current = await this.replace(current, this.resnet(current, "decoder.mid_block.resnets.1", 512, signal));
      const channels = [512, 512, 256, 128];
      for (let block = 0; block < 4; block += 1) {
        for (let layer = 0; layer < 3; layer += 1) {
          current = await this.replace(current, this.resnet(current, `decoder.up_blocks.${block}.resnets.${layer}`,
            channels[block], signal));
        }
        if (block === 1 && (width > 512 || height > 512)) {
          const nextOutputRows = maximumBandRows(current.width * 2, channels[block]);
          let tiled = await this.tiled.fromBuffer(current.buffer, current.height, current.width, current.channels,
            Math.max(1, Math.floor(nextOutputRows / 2)));
          current.arena.destroy();
          try {
            tiled = await this.replaceTiled(tiled, this.convolutionTiled(tiled,
              `decoder.up_blocks.${block}.upsamplers.0.conv`, channels[block], 3, true, signal));
            for (let tiledBlock = 2; tiledBlock < 4; tiledBlock += 1) {
              for (let layer = 0; layer < 3; layer += 1) {
                tiled = await this.replaceTiled(tiled, this.resnetTiled(tiled,
                  `decoder.up_blocks.${tiledBlock}.resnets.${layer}`, channels[tiledBlock], signal));
              }
              if (tiledBlock < 3) tiled = await this.replaceTiled(tiled, this.convolutionTiled(tiled,
                `decoder.up_blocks.${tiledBlock}.upsamplers.0.conv`, channels[tiledBlock], 3, true, signal));
            }
            const result = await this.finishTiled(tiled, signal);
            tiled.arena.destroy();
            return result;
          } catch (error) { tiled.arena.destroy(); throw error; }
        }
        if (block < 3) current = await this.replace(current,
          this.convolution(current, `decoder.up_blocks.${block}.upsamplers.0.conv`, channels[block], 3, true, signal));
      }
      const result = await this.finish(current, signal);
      current.arena.destroy();
      return result;
    } catch (error) { current.arena.destroy(); throw error; }
  }

  clearCache(): void { this.reader.clear(); }

  private async prepareInput(packed: GPUBuffer, width: number, height: number, signal?: AbortSignal): Promise<FeatureMap> {
    const names = ["bn.running_mean", "bn.running_var", "post_quant_conv.weight", "post_quant_conv.bias",
      "decoder.conv_in.weight", "decoder.conv_in.bias"];
    const [mean, variance, postWeight, postBias, convWeight, convBias] = await Promise.all(names.map(name => this.reader.load(name, signal)));
    const packedHeight = height / 16, packedWidth = width / 16, latentHeight = height / 8, latentWidth = width / 8;
    const arena = new GpuBufferArena(this.device);
    try {
      const upload = (tensor: LoadedDenseTensor) => arena.upload(tensor.values, undefined, tensor.name);
      const unpatched = arena.create(latentHeight * latentWidth * 32 * 4, undefined, "bonsai-vae-unpatched");
      const post = arena.create(latentHeight * latentWidth * 32 * 4, undefined, "bonsai-vae-post-quant");
      const output = arena.create(latentHeight * latentWidth * 512 * 4, undefined, "bonsai-vae-conv-in");
      const unpatchShape = arena.uniform([packedHeight, packedWidth, 128, 32]);
      const postShape = arena.uniform([latentHeight, latentWidth, 32, 32, 1, 0, 0, latentHeight]);
      const convShape = arena.uniform([latentHeight, latentWidth, 32, 512, 3, 1, 0, latentHeight]);
      const encoder = this.device.createCommandEncoder({ label: "bonsai-owned-vae-input" });
      this.kernels.encodeUnpatch(encoder, [packed, upload(mean), upload(variance), unpatched, unpatchShape],
        packedHeight * packedWidth * 128);
      this.kernels.encodeConvolution(encoder, [unpatched, upload(postWeight), upload(postBias), post, postShape],
        latentWidth, latentHeight, 32);
      this.kernels.encodeConvolution(encoder, [post, upload(convWeight), upload(convBias), output, convShape],
        latentWidth, latentHeight, 512);
      this.device.queue.submit([encoder.finish()]); await this.device.queue.onSubmittedWorkDone();
      return { buffer: output, height: latentHeight, width: latentWidth, channels: 512, arena };
    } catch (error) { arena.destroy(); throw error; }
  }

  private async resnet(input: FeatureMap, prefix: string, outputChannels: number, signal?: AbortSignal): Promise<FeatureMap> {
    const shortcut = input.channels !== outputChannels;
    const suffixes = ["norm1.weight", "norm1.bias", "conv1.weight", "conv1.bias", "norm2.weight", "norm2.bias",
      "conv2.weight", "conv2.bias", ...(shortcut ? ["conv_shortcut.weight", "conv_shortcut.bias"] : [])];
    const tensors = await Promise.all(suffixes.map(suffix => this.reader.load(`${prefix}.${suffix}`, signal)));
    const [norm1w, norm1b, conv1w, conv1b, norm2w, norm2b, conv2w, conv2b, shortcutW, shortcutB] = tensors;
    const arena = new GpuBufferArena(this.device), elements = input.height * input.width;
    try {
      const up = (tensor: LoadedDenseTensor) => arena.upload(tensor.values, undefined, tensor.name);
      const norm1 = arena.create(elements * input.channels * 4); const conv1 = arena.create(elements * outputChannels * 4);
      const norm2 = arena.create(elements * outputChannels * 4); const conv2 = arena.create(elements * outputChannels * 4);
      const residual = shortcut ? arena.create(elements * outputChannels * 4) : input.buffer;
      const output = arena.create(elements * outputChannels * 4);
      const norm1Shape = arena.uniform([input.height, input.width, input.channels, 32, floatBits(1e-6), 1]);
      const norm2Shape = arena.uniform([input.height, input.width, outputChannels, 32, floatBits(1e-6), 1]);
      const conv1Shape = arena.uniform([input.height, input.width, input.channels, outputChannels, 3, 1, 0, input.height]);
      const conv2Shape = arena.uniform([input.height, input.width, outputChannels, outputChannels, 3, 1, 0, input.height]);
      const encoder = this.device.createCommandEncoder({ label: `bonsai-owned-${prefix}` });
      this.kernels.encodeNormalization("group_norm", encoder, [input.buffer, up(norm1w), up(norm1b), norm1, norm1Shape], 32);
      this.kernels.encodeConvolution(encoder, [norm1, up(conv1w), up(conv1b), conv1, conv1Shape], input.width, input.height, outputChannels);
      this.kernels.encodeNormalization("group_norm", encoder, [conv1, up(norm2w), up(norm2b), norm2, norm2Shape], 32);
      this.kernels.encodeConvolution(encoder, [norm2, up(conv2w), up(conv2b), conv2, conv2Shape], input.width, input.height, outputChannels);
      if (shortcut) {
        const shape = arena.uniform([input.height, input.width, input.channels, outputChannels, 1, 0, 0, input.height]);
        this.kernels.encodeConvolution(encoder, [input.buffer, up(shortcutW!), up(shortcutB!), residual, shape], input.width, input.height, outputChannels);
      }
      this.kernels.encodeNormalization("add", encoder, [conv2, residual, conv2, output, norm2Shape],
        Math.ceil(elements * outputChannels / 256));
      this.device.queue.submit([encoder.finish()]); await this.device.queue.onSubmittedWorkDone();
      return { buffer: output, height: input.height, width: input.width, channels: outputChannels, arena };
    } catch (error) { arena.destroy(); throw error; }
  }

  private async attention(input: FeatureMap, prefix: string, signal?: AbortSignal): Promise<FeatureMap> {
    const suffixes = ["group_norm.weight", "group_norm.bias", "to_q.weight", "to_q.bias", "to_k.weight", "to_k.bias",
      "to_v.weight", "to_v.bias", "to_out.0.weight", "to_out.0.bias"];
    const [nw, nb, qw, qb, kw, kb, vw, vb, ow, ob] = await Promise.all(suffixes.map(s => this.reader.load(`${prefix}.${s}`, signal)));
    const arena = new GpuBufferArena(this.device), sequence = input.height * input.width, channels = input.channels;
    try {
      const up = (t: LoadedDenseTensor) => arena.upload(t.values, undefined, t.name);
      const buffers = Array.from({ length: 7 }, () => arena.create(sequence * channels * 4));
      const [norm, q, k, v, attended, projected, output] = buffers;
      const normShape = arena.uniform([input.height, input.width, channels, 32, floatBits(1e-6), 0]);
      const convShape = arena.uniform([input.height, input.width, channels, channels, 1, 0, 0, input.height]);
      const attentionShape = arena.uniform([sequence, channels, 0, 0]);
      const encoder = this.device.createCommandEncoder({ label: "bonsai-owned-vae-mid-attention" });
      this.kernels.encodeNormalization("group_norm", encoder, [input.buffer, up(nw), up(nb), norm, normShape], 32);
      for (const [weight, bias, destination] of [[qw, qb, q], [kw, kb, k], [vw, vb, v]] as const)
        this.kernels.encodeConvolution(encoder, [norm, up(weight), up(bias), destination, convShape], input.width, input.height, channels);
      this.kernels.encodeAttention(encoder, [q, k, v, attended, attentionShape], sequence);
      this.kernels.encodeConvolution(encoder, [attended, up(ow), up(ob), projected, convShape], input.width, input.height, channels);
      this.kernels.encodeNormalization("add", encoder, [input.buffer, projected, projected, output, normShape],
        Math.ceil(sequence * channels / 256));
      this.device.queue.submit([encoder.finish()]); await this.device.queue.onSubmittedWorkDone();
      return { buffer: output, height: input.height, width: input.width, channels, arena };
    } catch (error) { arena.destroy(); throw error; }
  }

  private async convolution(input: FeatureMap, key: string, outputChannels: number, kernel: number, upsample: boolean,
    signal?: AbortSignal): Promise<FeatureMap> {
    const [weight, bias] = await Promise.all([this.reader.load(`${key}.weight`, signal), this.reader.load(`${key}.bias`, signal)]);
    const arena = new GpuBufferArena(this.device), outputHeight = input.height * (upsample ? 2 : 1), outputWidth = input.width * (upsample ? 2 : 1);
    try {
      const output = arena.create(outputHeight * outputWidth * outputChannels * 4);
      const shape = arena.uniform([input.height, input.width, input.channels, outputChannels, kernel, Math.floor(kernel / 2), upsample ? 1 : 0, outputHeight]);
      const encoder = this.device.createCommandEncoder();
      this.kernels.encodeConvolution(encoder, [input.buffer, arena.upload(weight.values), arena.upload(bias.values), output, shape], outputWidth, outputHeight, outputChannels);
      this.device.queue.submit([encoder.finish()]); await this.device.queue.onSubmittedWorkDone();
      return { buffer: output, height: outputHeight, width: outputWidth, channels: outputChannels, arena };
    } catch (error) { arena.destroy(); throw error; }
  }

  private async finish(input: FeatureMap, signal?: AbortSignal): Promise<VaeDecodeResult> {
    const [nw, nb, weight, bias] = await Promise.all(["decoder.conv_norm_out.weight", "decoder.conv_norm_out.bias",
      "decoder.conv_out.weight", "decoder.conv_out.bias"].map(name => this.reader.load(name, signal)));
    const arena = new GpuBufferArena(this.device), pixels = input.height * input.width;
    try {
      const normalized = arena.create(pixels * input.channels * 4); const output = arena.create(pixels * 3 * 4);
      const normShape = arena.uniform([input.height, input.width, input.channels, 32, floatBits(1e-6), 1]);
      const convShape = arena.uniform([input.height, input.width, input.channels, 3, 3, 1, 0, input.height]);
      const encoder = this.device.createCommandEncoder({ label: "bonsai-owned-vae-output" });
      this.kernels.encodeNormalization("group_norm", encoder, [input.buffer, arena.upload(nw.values), arena.upload(nb.values), normalized, normShape], 32);
      this.kernels.encodeConvolution(encoder, [normalized, arena.upload(weight.values), arena.upload(bias.values), output, convShape], input.width, input.height, 3);
      this.device.queue.submit([encoder.finish()]); await this.device.queue.onSubmittedWorkDone();
      return { pixels: output, width: input.width, height: input.height, arena };
    } catch (error) { arena.destroy(); throw error; }
  }

  private async resnetTiled(input: VaeTiledFeatureMap, prefix: string, outputChannels: number,
    signal?: AbortSignal): Promise<VaeTiledFeatureMap> {
    const shortcut = input.channels !== outputChannels;
    const suffixes = ["norm1.weight", "norm1.bias", "conv1.weight", "conv1.bias", "norm2.weight", "norm2.bias",
      "conv2.weight", "conv2.bias", ...(shortcut ? ["conv_shortcut.weight", "conv_shortcut.bias"] : [])];
    const [norm1w, norm1b, conv1w, conv1b, norm2w, norm2b, conv2w, conv2b, shortcutW, shortcutB] =
      await Promise.all(suffixes.map(suffix => this.reader.load(`${prefix}.${suffix}`, signal)));
    signal?.throwIfAborted();
    const norm1 = await this.tiled.groupNorm(input, norm1w, norm1b, true);
    let conv1: VaeTiledFeatureMap | undefined;
    let norm2: VaeTiledFeatureMap | undefined;
    let conv2: VaeTiledFeatureMap | undefined;
    let residual: VaeTiledFeatureMap | undefined;
    try {
      conv1 = await this.tiled.convolve(norm1, conv1w, conv1b, outputChannels);
      norm1.arena.destroy();
      norm2 = await this.tiled.groupNorm(conv1, norm2w, norm2b, true);
      conv1.arena.destroy(); conv1 = undefined;
      conv2 = await this.tiled.convolve(norm2, conv2w, conv2b, outputChannels);
      norm2.arena.destroy(); norm2 = undefined;
      residual = shortcut ? await this.tiled.convolve(input, shortcutW!, shortcutB!, outputChannels, 1) : input;
      const output = await this.tiled.add(conv2, residual);
      conv2.arena.destroy(); conv2 = undefined;
      if (shortcut) { residual.arena.destroy(); residual = undefined; }
      return output;
    } catch (error) {
      norm1.arena.destroy(); conv1?.arena.destroy(); norm2?.arena.destroy(); conv2?.arena.destroy();
      if (shortcut) residual?.arena.destroy();
      throw error;
    }
  }

  private async convolutionTiled(input: VaeTiledFeatureMap, key: string, outputChannels: number, kernel: number,
    upsample: boolean, signal?: AbortSignal): Promise<VaeTiledFeatureMap> {
    const [weight, bias] = await Promise.all([
      this.reader.load(`${key}.weight`, signal), this.reader.load(`${key}.bias`, signal),
    ]);
    signal?.throwIfAborted();
    let source = input;
    if (upsample) {
      const outputRows = maximumBandRows(input.width * 2, outputChannels);
      const inputRows = Math.max(1, Math.floor(outputRows / 2));
      if (input.bands.some(band => band.rows > inputRows)) source = await this.tiled.retile(input, inputRows);
    }
    try {
      return await this.tiled.convolve(source, weight, bias, outputChannels, kernel, upsample);
    } finally {
      if (source !== input) source.arena.destroy();
    }
  }

  private async finishTiled(input: VaeTiledFeatureMap, signal?: AbortSignal): Promise<VaeDecodeResult> {
    const [nw, nb, weight, bias] = await Promise.all(["decoder.conv_norm_out.weight", "decoder.conv_norm_out.bias",
      "decoder.conv_out.weight", "decoder.conv_out.bias"].map(name => this.reader.load(name, signal)));
    const normalized = await this.tiled.groupNorm(input, nw, nb, true);
    let rgb: VaeTiledFeatureMap | undefined;
    const arena = new GpuBufferArena(this.device);
    try {
      rgb = await this.tiled.convolve(normalized, weight, bias, 3);
      normalized.arena.destroy();
      const pixels = arena.create(input.height * input.width * 3 * 4, undefined, "bonsai-vae-tiled-rgb");
      const encoder = this.device.createCommandEncoder({ label: "bonsai-vae-join-rgb-bands" });
      for (const band of rgb.bands) encoder.copyBufferToBuffer(band.buffer, 0, pixels,
        band.startRow * input.width * 3 * 4, band.rows * input.width * 3 * 4);
      this.device.queue.submit([encoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      rgb.arena.destroy(); rgb = undefined;
      return { pixels, width: input.width, height: input.height, arena };
    } catch (error) {
      normalized.arena.destroy(); rgb?.arena.destroy(); arena.destroy(); throw error;
    }
  }

  private async replace(previous: FeatureMap, next: Promise<FeatureMap>): Promise<FeatureMap> {
    const value = await next; previous.arena.destroy(); return value;
  }

  private async replaceTiled(previous: VaeTiledFeatureMap,
    next: Promise<VaeTiledFeatureMap>): Promise<VaeTiledFeatureMap> {
    const value = await next; previous.arena.destroy(); return value;
  }
}
function floatBits(value: number): number { const b = new ArrayBuffer(4); new Float32Array(b)[0] = value; return new Uint32Array(b)[0]; }
