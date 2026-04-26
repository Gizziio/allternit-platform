# Capstone: Build a Screen-State Analyzer for LLM Agents

**Course:** ALABS-OPS-VISION — Computer Vision for AI Systems  
**Tier:** OPS

## Bridge Concept

The capstone integrates everything: you will build a screen-state analyzer that captures a region of the screen, preprocesses it with OpenCV, extracts meaningful structure, and feeds that structure to an LLM agent as context. The agent must then answer a question about the UI or propose an action.

Because we have no downloaded vision course, this capstone leans heavily on original content and free OpenCV documentation. The goal is not to train a neural network from scratch; it is to build the *plumbing* that connects classical computer vision to modern agent systems.

## Learning Objectives

- [ ] Build an end-to-end pipeline: screenshot → OpenCV preprocessing → structured JSON → LLM reasoning.
- [ ] Handle real-world noise: varying resolutions, dark mode, overlapping elements.
- [ ] Document the interface contract between the vision layer and the agent layer.

## Demo Outline (10 min)

1. **The Analyzer:** Show the screen-state analyzer running on a real application (e.g., a settings page).
2. **Noisy Input:** Run it on the same page in light mode and dark mode. Show how thresholding adapts.
3. **Agent Query:** Ask the LLM: \"How do I enable two-factor authentication?\" The agent uses the structured screen state to answer without ever seeing the raw screenshot.

## Challenge (Capstone — 60 min)

> **Build:** Create a screen-state analyzer that:
> - Captures a user-defined screen region.
> - Uses OpenCV to detect text regions and interactive elements.
> - Outputs a structured JSON description of the UI.
> - Accepts a natural-language question and passes the JSON + question to an LLM.
> - Returns the LLM's answer and any proposed actions.
>
> **Deliverable:** A GitHub repo link + a demo video showing the analyzer on two different applications.

## Allternit Connection

- **Internal system:** agui-gateway's GUI automation module uses a similar analyzer for click-and-type workflows.
- **Reference repo/file:** OpenCV official docs: docs.opencv.org (free resource).
- **Key difference from standard approach:** Allternit's analyzer is model-agnostic. It works with local LLMs, cloud LLMs, or even rule-based agents because the interface is pure structured JSON.
