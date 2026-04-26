# Bridge: Connecting OpenCV to Agent Systems

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Bridge Concept

OpenCV is 25 years old. It was built for robotics and surveillance, not LLM agents. But its speed, maturity, and zero-cost license make it the perfect preprocessing layer for modern agent systems. The bridge challenge is connecting OpenCV's pixel-centric world (matrices, contours, keypoints) to an LLM's token-centric world (text, JSON, structured descriptions).

This module shows how to build that bridge. We cover screen-state extraction, OCR integration, object localization, and the structured formats (JSON, Markdown tables) that let an LLM act on visual information. We also look at how Anthropic's computer-use SDK and OpenAI's Operator use similar patterns under the hood.

## Learning Objectives

- [ ] Extract structured state from a GUI screenshot using OpenCV + pytesseract.
- [ ] Format visual findings as a JSON object an LLM can consume.
- [ ] Implement a feedback loop where the LLM's action triggers a new screen capture.

## Demo Outline (10 min)

1. **Screen-State Parser:** Capture a web form. Use OpenCV to find text fields and buttons, then OCR to read labels. Output a JSON schema: { fields: [{label, bbox, type}], buttons: [{label, bbox}] }.
2. **LLM Action:** Feed the JSON to an LLM. Ask it to fill out the form. Parse its response into click/type coordinates.
3. **Feedback Loop:** Execute the action, capture the new screen state, and verify the form was filled correctly.

## Challenge (5 min)

> **The Login Bot:** Build a script that captures a login screen, uses OpenCV + OCR to locate the username field, password field, and submit button, and outputs a step-by-step action plan in JSON. (Do not actually enter credentials.)

## Allternit Connection

- **Internal system:** Allternit's workflow engine uses OpenCV to detect UI state changes before triggering downstream actions.
- **Reference repo/file:** \"agents/computer-use/screen_parser.py\" (conceptual).
- **Key difference from standard approach:** Allternit never sends full screenshots to cloud APIs. Vision is local-first; only structured, anonymized state descriptions leave the machine.
