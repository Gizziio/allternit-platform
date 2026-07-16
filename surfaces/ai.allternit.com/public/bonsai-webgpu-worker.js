'use strict';

const SOURCE = 'allternit-bonsai-webgpu';
const BUNDLE_URL = 'https://huggingface.co/spaces/webml-community/bonsai-image-webgpu/raw/main/assets/index-Bf-HmMxp.js';
const BUNDLE_HASH = '8e1726c485bfdae81ad7fa479a73a60cc27313a40e5b76b588245d1c9416f0eb';
const BUNDLE_CACHE = 'allternit-bonsai-webgpu-runtime-v1';
const BUNDLE_KEY = '/__allternit/bonsai-webgpu/index-Bf-HmMxp.js';
const MODEL_CACHE = 'bonsai-image-v1';
const MODEL_REPOSITORY = 'prism-ml/bonsai-image-ternary-4B-mlx-2bit';
const MODEL_REVISION = '2c24c81b934a658ba5590cf39088ba929985b4a8';
const MODEL_FILES = new Set([
  'manifest.json', 'model_index.json', 'scheduler/scheduler_config.json',
  'transformer-packed-mflux/config.json',
  'transformer-packed-mflux/diffusion_pytorch_model.safetensors',
  'transformer-packed-mflux/quantization_config.json',
  'vae/config.json', 'vae/diffusion_pytorch_model.safetensors',
  'text_encoder-mlx-4bit/added_tokens.json', 'text_encoder-mlx-4bit/config.json',
  'text_encoder-mlx-4bit/merges.txt', 'text_encoder-mlx-4bit/model.safetensors',
  'text_encoder-mlx-4bit/model.safetensors.index.json',
  'text_encoder-mlx-4bit/special_tokens_map.json', 'text_encoder-mlx-4bit/tokenizer.json',
  'text_encoder-mlx-4bit/tokenizer_config.json', 'text_encoder-mlx-4bit/vocab.json',
  'tokenizer/added_tokens.json', 'tokenizer/chat_template.jinja', 'tokenizer/merges.txt',
  'tokenizer/special_tokens_map.json', 'tokenizer/tokenizer.json',
  'tokenizer/tokenizer_config.json', 'tokenizer/vocab.json',
]);
// Stop with 2 GB of headroom so polling/cache write amplification cannot cross
// the user's absolute 8 GB temporary-disk ceiling.
const MAX_INSTALL_STORAGE_GROWTH = 6_000_000_000;
const PRELUDE_END_MARKER = '})();';
const APP_START_MARKER = 'var gh=';
const controllers = new Map();
const capture = { version: 1, shaders: [], fetches: [], pipelines: [], bindGroups: [], writes: [], dispatches: [] };
const MAX_EVENTS = 20000;
let pipelinePromise;
let runtimePromise;
let activeController;

async function storageUsage() {
  return Number((await navigator.storage?.estimate?.())?.usage ?? 0);
}

function monitorStorageGrowth(baseline, controller) {
  const timer = setInterval(async () => {
    try {
      const growth = (await storageUsage()) - baseline;
      if (growth >= MAX_INSTALL_STORAGE_GROWTH) {
        controller.abort(new Error('Bonsai WebGPU stopped before exceeding its 8 GB installation storage limit'));
      }
    } catch {
      // The range/cache layer remains fail-closed; storage estimation is an
      // additional disk guard and is not available in every browser.
    }
  }, 250);
  return () => clearInterval(timer);
}

const reply = (id, message) => postMessage({ source: SOURCE, id, ...message });
const hex = buffer => [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const record = (bucket, value) => {
  const events = capture[bucket];
  if (events.length < MAX_EVENTS) events.push({ sequence: events.length, ...value });
};

function installInstrumentation() {
  if (self.__allternitBonsaiInstrumented) return;
  self.__allternitBonsaiInstrumented = true;
  const originalFetch = self.fetch.bind(self);
  self.fetch = async (input, init = {}) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const allowedBundle = url.href === BUNDLE_URL;
    const modelPrefix = `/${MODEL_REPOSITORY}/resolve/${MODEL_REVISION}/`;
    const allowedModel = url.origin === 'https://huggingface.co' && url.pathname.startsWith(modelPrefix) &&
      MODEL_FILES.has(decodeURIComponent(url.pathname.slice(modelPrefix.length)));
    if (!['GET', 'HEAD'].includes(request.method) || (!allowedBundle && !allowedModel)) {
      throw new Error(`Bonsai WebGPU blocked an undeclared network request: ${request.method} ${url.origin}${url.pathname}`);
    }
    const guardedRequest = new Request(request, { signal: activeController?.signal ?? request.signal });
    const response = await originalFetch(guardedRequest);
    record('fetches', {
      url: request.url,
      method: request.method,
      range: request.headers.get('range'),
      status: response.status,
      contentLength: Number(response.headers.get('content-length')) || undefined,
      contentRange: response.headers.get('content-range'),
    });
    return response;
  };
  const hook = (prototype, method, wrap) => {
    if (!prototype?.[method]) return;
    const original = prototype[method];
    prototype[method] = wrap(original);
  };
  hook(self.GPUDevice?.prototype, 'createShaderModule', original => function(descriptor) {
    record('shaders', { label: descriptor.label, code: descriptor.code });
    return original.call(this, descriptor);
  });
  for (const method of ['createComputePipeline', 'createComputePipelineAsync']) {
    hook(self.GPUDevice?.prototype, method, original => function(descriptor) {
      record('pipelines', { method, label: descriptor.label, entryPoint: descriptor.compute?.entryPoint });
      return original.call(this, descriptor);
    });
  }
  hook(self.GPUDevice?.prototype, 'createBindGroup', original => function(descriptor) {
    record('bindGroups', { label: descriptor.label, entries: descriptor.entries?.map(entry => ({ binding: entry.binding })) });
    return original.call(this, descriptor);
  });
  hook(self.GPUQueue?.prototype, 'writeBuffer', original => function(buffer, offset, data, dataOffset, size) {
    record('writes', { offset, dataOffset, size: size ?? data?.byteLength });
    return original.call(this, buffer, offset, data, dataOffset, size);
  });
  hook(self.GPUComputePassEncoder?.prototype, 'dispatchWorkgroups', original => function(x, y, z) {
    record('dispatches', { x, y: y ?? 1, z: z ?? 1 });
    return original.call(this, x, y, z);
  });
}

async function bundleSource(id, signal) {
  const cache = await caches.open(BUNDLE_CACHE);
  let response = await cache.match(BUNDLE_KEY);
  if (!response) {
    response = await fetch(BUNDLE_URL, { signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`Runtime download failed (${response.status})`);
    const bytes = await response.arrayBuffer();
    reply(id, { progress: { completedBytes: bytes.byteLength, totalBytes: bytes.byteLength, message: 'Downloaded third-party WebGPU runtime' } });
    const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
    if (digest !== BUNDLE_HASH) throw new Error(`Runtime checksum mismatch: expected ${BUNDLE_HASH}, received ${digest}`);
    response = new Response(bytes, { headers: { 'content-type': 'text/javascript' } });
    await cache.put(BUNDLE_KEY, response.clone());
  }
  const bytes = await response.arrayBuffer();
  const digest = hex(await crypto.subtle.digest('SHA-256', bytes));
  if (digest !== BUNDLE_HASH) {
    await cache.delete(BUNDLE_KEY);
    throw new Error('Cached Bonsai WebGPU runtime failed checksum verification');
  }
  return new TextDecoder().decode(bytes);
}

async function runtime(id, signal) {
  if (!runtimePromise) runtimePromise = (async () => {
    installInstrumentation();
    const source = await bundleSource(id, signal);
    const preludeEnd = source.indexOf(PRELUDE_END_MARKER) + PRELUDE_END_MARKER.length;
    const appStart = source.indexOf(APP_START_MARKER);
    if (preludeEnd !== 698 || appStart !== 857940) {
      throw new Error(`Pinned runtime boundaries changed (${preludeEnd}, ${appStart}); refusing to execute it`);
    }
    const patched = `self.window=self;${source.slice(preludeEnd, appStart)}self.__allternitBonsaiRuntime={BonsaiImage:Bi};`;
    const url = URL.createObjectURL(new Blob([patched], { type: 'text/javascript' }));
    try {
      importScripts(url);
    } finally {
      URL.revokeObjectURL(url);
    }
    if (!self.__allternitBonsaiRuntime?.BonsaiImage) throw new Error('BonsaiImage API was not exposed by the pinned runtime');
    return self.__allternitBonsaiRuntime;
  })().catch(error => { runtimePromise = undefined; throw error; });
  return runtimePromise;
}

async function pipeline(id, signal) {
  if (!pipelinePromise) pipelinePromise = runtime(id, signal).then(({ BonsaiImage }) =>
    BonsaiImage.from_pretrained(null, {
      revision: MODEL_REVISION,
      cacheStorage: caches,
      cacheName: MODEL_CACHE,
      signal,
      onProgress: progress => reply(id, { progress: {
        completedBytes: progress?.loaded ?? progress?.completedBytes,
        totalBytes: progress?.total ?? progress?.totalBytes,
        message: progress?.status ?? progress?.file ?? 'Downloading model weights',
      } }),
    })
  ).catch(error => { pipelinePromise = undefined; throw error; });
  return pipelinePromise;
}

addEventListener('message', async event => {
  if (event.data?.source !== 'allternit-parent') return;
  const { id, action } = event.data;
  if (action === 'cancel') {
    controllers.get(id)?.abort();
    return;
  }
  if (activeController) {
    reply(id, { ok: false, error: 'Bonsai WebGPU is busy with another operation' });
    return;
  }
  const controller = new AbortController();
  controllers.set(id, controller);
  activeController = controller;
  try {
    if (action === 'probe-runtime') {
      await runtime(id, controller.signal);
      reply(id, { ok: true });
    } else if (action === 'install') {
      const baseline = await storageUsage();
      const stopMonitoring = monitorStorageGrowth(baseline, controller);
      try {
        await pipeline(id, controller.signal);
        reply(id, { ok: true });
      } catch (error) {
        await caches.delete(MODEL_CACHE);
        throw error;
      } finally {
        stopMonitoring();
      }
    } else if (action === 'generate') {
      const baseline = await storageUsage();
      const stopMonitoring = monitorStorageGrowth(baseline, controller);
      let instance;
      try {
        instance = await pipeline(id, controller.signal);
        const result = await instance.generate({
          prompt: event.data.prompt,
          width: event.data.width,
          height: event.data.height,
          numInferenceSteps: event.data.numInferenceSteps,
          guidanceScale: 1,
          seed: event.data.seed,
          signal: controller.signal,
        });
        const blob = await result.toBlob();
        reply(id, { ok: true, result: { blob, seed: event.data.seed } });
      } catch (error) {
        pipelinePromise = undefined;
        await caches.delete(MODEL_CACHE);
        throw error;
      } finally {
        stopMonitoring();
      }
    } else if (action === 'export-spec') {
      reply(id, { ok: true, result: { spec: structuredClone(capture) } });
    } else {
      throw new Error(`Unsupported worker action: ${action}`);
    }
  } catch (error) {
    reply(id, { ok: false, error: error instanceof Error ? error.message : String(error) });
  } finally {
    if (activeController === controller) activeController = undefined;
    controllers.delete(id);
  }
});
