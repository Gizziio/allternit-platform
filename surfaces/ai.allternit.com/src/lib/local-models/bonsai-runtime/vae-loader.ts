import { BONSAI_MODEL_REPOSITORY, BONSAI_MODEL_REVISION, BONSAI_VAE } from "./model-spec";
import { bfloat16ToFloat32 } from "./numeric";
import type { LoadedDenseTensor } from "./packed-affine-loader";
import { SafeTensorsRangeReader } from "./safetensors-range";

export class BonsaiVaeReader {
  readonly tensors: SafeTensorsRangeReader;
  private readonly cache = new Map<string, Promise<LoadedDenseTensor>>();
  constructor(fetchImpl: typeof fetch = fetch) {
    this.tensors = new SafeTensorsRangeReader(
      `https://huggingface.co/${BONSAI_MODEL_REPOSITORY}/resolve/${BONSAI_MODEL_REVISION}/${BONSAI_VAE.path}`, fetchImpl);
  }
  async load(name: string, signal?: AbortSignal): Promise<LoadedDenseTensor> {
    let promise = this.cache.get(name);
    if (!promise) {
      promise = this.tensors.readTensor(name, signal).then(tensor => {
        if (tensor.info.dtype !== "BF16") throw new Error(`${name} is not a BF16 VAE tensor`);
        return { name, shape: [...tensor.info.shape], values: bfloat16ToFloat32(tensor.data) };
      }).catch(error => { this.cache.delete(name); throw error; });
      this.cache.set(name, promise);
    }
    return promise;
  }
  clear(): void { this.cache.clear(); }
}
