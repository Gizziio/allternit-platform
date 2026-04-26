# UITARS_INFERENCE_LAYER.md
**Inference Placement Strategy for UI-TARS**
_version 2.0 — simplified placement strategy_

---

## 0. Purpose

Defines where the UI-TARS model inference runs relative to the WebVM.

**Constraint:** Inference **NEVER** runs inside the WebVM/CheerpX environment. It is too heavy.

---

## 1. Placement Strategy

### 1.1 Remote API (Default / MVP)
**Location:** External GPU Server (e.g., vLLM / TGI)
**Latency:** Low (< 500ms network + inference)
**Model:** UI-TARS-7B or 72B

```
[ WebVM / IO ]  ---> (screenshot base64) ---> [ Remote API ]
[ WebVM / IO ]  <--- (action JSON)      <--- [ Remote API ]
```

### 1.2 Browser WebGPU (Optional / Offline)
**Location:** Main Browser Thread / WebWorker
**Latency:** Variable (depends on client GPU)
**Model:** UI-TARS-7B-Quantized (WebLLM)

```
[ WebVM / IO ]  ---> (screenshot blob)  ---> [ Browser Worker (WebLLM) ]
[ WebVM / IO ]  <--- (action JSON)      <--- [ Browser Worker (WebLLM) ]
```

---

## 2. Interface

Regardless of placement, the IO skill `model.ui_tars.propose` uses this abstract interface:

```typescript
interface InferenceProvider {
  propose(
    screenshot: Blob,
    task: string
  ): Promise<ActionProposal[]>;
}
```

## 3. Configuration

IO selects the provider at startup via `config.json`:

```json
{
  "inference": {
    "provider": "remote", // or "browser"
    "remote_url": "https://api.allternit.com/v1/ui-tars",
    "browser_model": "ui-tars-7b-q4f16"
  }
}
```