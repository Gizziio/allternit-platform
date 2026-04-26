# Inference & Generative Architecture (Polyglot)

> **Version:** 1.0.0 (Locked)
> **Status:** Approved for Implementation

This document defines the architecture for the **Local Inference Service**, integrating both high-efficiency Rust runners and specialized Python runtimes for bleeding-edge models.

---

## 1. The "Polyglot" Strategy

We acknowledge that no single runtime can handle all SOTA models.
*   **Rust (`llama.cpp`/`candle`):** Best for standard LLMs (Llama 3, Qwen 2.5) and Vision-Language (Qwen-VL). Zero-overhead, memory-efficient.
*   **Python (`torch`/`diffusers`):** Best for non-standard architectures (Liquid LFM) and Generative Image models (Qwen-Image, Flux).

## 2. Component Architecture

```mermaid
graph TD
    Router[Router-Model] -->|Text/Vision Request| LocalInf[Local Inference (Rust)]
    Router -->|Image Gen Request| LocalInf
    
    subgraph "Service: local-inference"
        LocalInf -->|GGUF Models| EngineRust[Rust Engine (llama-cpp-2)]
        LocalInf -->|Specialized| Bridge[IPC Bridge]
    end
    
    subgraph "Service: python-gateway"
        Bridge <-->|Unix Socket / HTTP| PyServer[Python Server]
        PyServer -->|LFM-2| LiquidEngine[Liquid AI Runtime]
        PyServer -->|Qwen-Image| DiffusersEngine[HuggingFace Diffusers]
    end
```

## 3. Model Registry & Routing Table

| Model Family | Specific Model | Task Type | Backend | Format |
| :--- | :--- | :--- | :--- | :--- |
| **Qwen** | `Qwen2.5-7B-Instruct` | General Chat | **Rust** | GGUF (Q4_K_M) |
| **Qwen** | `Qwen2.5-Coder-7B` | Coding | **Rust** | GGUF (Q4_K_M) |
| **Qwen VL** | `Qwen2-VL-7B` | Vision Analysis | **Rust** | GGUF + Projector |
| **Liquid** | `LFM-3B` | Efficient/Edge | **Python** | Safetensors |
| **Qwen Gen** | `Qwen-Image-2512` | Image Generation | **Python** | Safetensors/Diffusers |

## 4. Implementation Specifications

### A. `services/local-inference` (Rust Manager)
*   **Responsibility:** The single entry point for all local AI.
*   **API:** `POST /v1/chat/completions` (OpenAI compatible), `POST /v1/images/generations`.
*   **Logic:**
    *   Initialize `llama-cpp-2` context for GGUF models.
    *   Manage the child process `python-gateway` (start/stop/health).
    *   Route requests based on `model_id`.

### B. `services/python-gateway` (Python Worker)
*   **Responsibility:** Host "Heavy" or "Specialized" PyTorch models.
*   **Stack:** `FastAPI` or `Uvicorn` (Unix Socket mode).
*   **Modules:**
    *   `routers/liquid.py`: Loads LFM via official Liquid SDK.
    *   `routers/image_gen.py`: Loads Qwen-Image via Diffusers pipeline.

### C. `scripts/setup_models.sh`
*   **Responsibility:** Download large weights from HuggingFace to `models/`.
*   **Optimization:** Uses `huggingface-cli download` with resume support.

## 5. Directory Structure (Locked)

```text
/allternit
├── /models                  <-- .gitignore this!
│   ├── /gguf                <-- Rust models
│   └── /hub                 <-- Python cache (HF Home)
├── /services
│   ├── /local-inference     <-- Rust Router & LLM Engine
│   └── /python-gateway      <-- Python Engines (Liquid/Image)
```

## 6. Integration Workflow (Image Gen)

1.  **User:** "Generate a futuristic city."
2.  **Runtime:** Identifies intent -> `FunctionCall: generate_image(prompt="futuristic city")`.
3.  **Executor:** Calls `local-inference` API.
4.  **Local-Inference:** Forwards to `python-gateway`.
5.  **Python-Gateway:**
    *   Runs Qwen-Image pipeline.
    *   Saves `futuristic_city.png` to `assets/generated/`.
    *   Returns `{ "url": "file:///.../futuristic_city.png" }`.
6.  **Gateway-iMessage:**
    *   Reads file path.
    *   Sends Blue Bubble with attachment.

---

**Approved By:** Architecture Lead
**Date:** January 2026
