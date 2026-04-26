# SCREENSHOT_PIPELINE.md
**Observation Artifact Pipeline**
_version 2.0 — generalized observation flow_

---

## 0. Purpose

This document specifies the end-to-end pipeline for:
- Capturing "observations" (screenshots) from the KMS/X11 surface
- Processing these as immutable **artifacts**
- Preparing them for **any** vision model (UI-TARS, GPT-4o, etc.)
- Storing them in the IO Journal

**Framing Shift:**
We are not building a "UI-TARS pipeline". We are building an **Observation Artifact Pipeline**.
Models are just consumers of these artifacts.

---

## 1. Pipeline Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      OBSERVATION ARTIFACT PIPELINE                       │
│                                                                          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │
│  │   OBSERVE   │───▶│  NORMALIZE  │───▶│   ARTIFACT  │───▶│  CONSUME  │ │
│  │             │    │             │    │             │    │           │ │
│  │ KMS Canvas  │    │ Scale/Crop  │    │ Hash (CAS)  │    │ UI-TARS   │ │
│  │ Timestamp   │    │ Format      │    │ Journal Ref │    │ Archive   │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └───────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Observe Stage (Capture)

**Source:** WebVM KMS Canvas / X11 Buffer.

```typescript
interface ObservationSource {
  capture(): Promise<RawPixels>;
}
```

**Constraint:** Capture must be atomic and synchronous with the VM state to avoid tearing.

---

## 3. Normalize Stage (Process)

Models expect specific inputs (e.g., 1024x768). The pipeline normalizes *before* storage if needed, or stores raw and normalizes on-the-fly.

**Decision:** Store **RAW** (master) and cache **NORMALIZED** (derived).

---

## 4. Artifact Stage (Storage)

Every observation is an **Artifact**.

**Schema:**
- `artifact_id`: `sha256:{hash}`
- `type`: `image/png`
- `metadata`: `{ source: "kms", width: 1920, height: 1080, ... }`

**Storage:**
- Local: `.gizzi/artifacts/blobs/{hash}`
- Reference: Journal entry refers to `artifact_id`.

---

## 5. Consume Stage (Inference)

When `model.ui_tars.propose` is called:
1. IO resolves `screenshot_id` to file path.
2. IO reads file -> base64/blob.
3. IO sends to Inference Provider (Remote/Browser).

The pipeline ends when the artifact is delivered to the consumer.