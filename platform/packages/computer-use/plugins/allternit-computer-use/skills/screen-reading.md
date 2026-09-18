# Skill: screen-reading

**Triggers:** "what's on screen", "describe the page", "read this", "what do you see", accessibility mode, any observe-only intent

## Purpose

Read and describe the current screen state using accessibility trees, extracted text, or vision analysis. The observe-only layer — no actions taken.

## Read Modes

### 1. Accessibility Mode (Default)
```python
content = read_screen(session_id, mode="accessibility")
# Returns: hierarchical text of roles, labels, values
```
Best for: understanding interactive elements, form state, navigation structure.

### 2. Text Mode
```python
content = read_screen(session_id, mode="text")
# Returns: clean visible text, no markup
```
Best for: reading article content, extracting raw copy, checking for specific text.

### 3. Structured Mode
```python
content = read_screen(session_id, mode="structured")
# Returns: JSON outline of headings, links, inputs, forms
```
Best for: understanding page architecture, planning extraction strategy.

### 4. Vision Mode (Screenshot Analysis)
When accessibility and text modes are insufficient (image-heavy pages, canvas, PDF):
- Take screenshot
- Pass to vision provider with prompt: "Describe all visible UI elements and text"
- Return structured description

## Output Format

```
Page: [title] at [url]
---
NAVIGATION: [nav links]
HEADINGS: [h1, h2, h3 hierarchy]
MAIN CONTENT: [primary text content]
INTERACTIVE: [buttons, links, inputs with labels]
FORMS: [form fields and current values]
IMAGES: [alt text or visual description]
```

## Context-Aware Reading

Adapt depth based on intent:
- "What's the title?" → return `title` only
- "What forms are on this page?" → return `FORMS` section only
- "Describe everything" → return full structured output
- "Is there a Submit button?" → scan interactive elements, yes/no answer

## Use in Planning Loop

During reflection phase, use screen-reading to:
1. Confirm action succeeded ("Is the checkbox now checked?")
2. Read error messages ("Is there a validation error visible?")
3. Detect page change ("Has the URL or title changed?")
4. Find next target ("Where is the 'Continue' button?")
