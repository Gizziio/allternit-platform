# The Problem: LLMs Are Blind

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Bridge Concept

Large language models can reason about text with near-human fluency, but they have no eyes. They cannot see a dashboard, a form field, or a physical object unless someone converts that visual information into text or tokens. This creates a hard boundary: any agent that needs to interact with GUIs, mobile apps, robots, or the physical world must have a vision layer.

This module establishes the problem space. We look at how computer vision bridges the gap between pixels and language, and why OpenCV remains the foundational tool for this translation layer. We also introduce the modern agentic vision stack: screen capture → region-of-interest extraction → captioning or OCR → LLM reasoning → action.

## Learning Objectives

- [ ] Explain why multimodal LLMs still require structured vision preprocessing for reliable automation.
- [ ] Map the vision-to-agent pipeline: capture → preprocess → encode → reason → act.
- [ ] Evaluate when to use classical CV (OpenCV) vs. end-to-end vision models (CLIP, GPT-4V).

## Demo Outline (10 min)

1. **The Blindness Test:** Ask a text-only LLM to describe a complex dashboard screenshot. It fails. Then feed it an OpenCV-extracted region-of-interest + OCR text. It succeeds.
2. **Pipeline Diagram:** Draw the full computer-use agent loop with OpenCV at the capture/preprocess stage.
3. **Latency Comparison:** Show the cost of sending a raw 4K screenshot to a cloud vision API vs. preprocessing locally with OpenCV and sending only the relevant crop.

## Challenge (5 min)

> **Screen Capture + Crop:** Write a Python script that captures your screen, uses OpenCV to draw a bounding box around a specific UI element (e.g., a button or text field), and saves only that crop. Do not send it to any API.

## Allternit Connection

- **Internal system:** agui-gateway uses a vision preprocessor for GUI automation tasks.
- **Reference repo/file:** \"services/vision-preprocessor/\" (conceptual; not yet public).
- **Key difference from standard approach:** Allternit preprocesses vision inputs locally with OpenCV before sending minimal, structured context to the LLM. This preserves privacy and reduces token costs by 90%+.
