# Skill: visual-grounding

**Triggers:** Element not found in a11y tree, coordinate-based targeting required, image-heavy pages, canvas elements, dynamic UI

## Purpose

Locate UI elements by visual appearance when accessibility tree and DOM selectors are insufficient. Implements a hybrid grounding approach to avoid brittle pixel-perfect coordinate prediction.

## Grounding Strategy Hierarchy

```
1. Accessibility tree find (fast, semantic)
        ↓ not found
2. CSS selector inference (reliable for known patterns)
        ↓ not found
3. Text match (get_by_text, visible text)
        ↓ not found or ambiguous
4. Vision model grounding (screenshot → coordinate)
        ↓ low confidence (< 0.6)
5. Interactive cursor search (refine coordinate iteratively)
```

## Vision Grounding Protocol

When falling back to vision:
1. Take screenshot at full resolution
2. Build grounding prompt:
   ```
   Find the element: "{description}"
   Return: { "found": bool, "x": int, "y": int, "confidence": float, "description": str }
   Coordinates should be in pixels from top-left corner.
   ```
3. Parse coordinates from response
4. Validate: coordinates within viewport bounds
5. If confidence < 0.6: apply interactive refinement

## Interactive Cursor Refinement

Inspired by GUI-Cursor (NeurIPS 2025):
1. Start from vision-predicted coordinates
2. Take zoomed screenshot (2× zoom centered on predicted point)
3. Re-run grounding on zoomed view
4. Remap zoomed coordinates back to screen space
5. Average predictions across zoom levels

## Multi-Candidate Approach

For ambiguous descriptions ("the button", "the link"):
1. Request all matching candidates: `{ "candidates": [{ "x", "y", "confidence", "description" }] }`
2. Score by confidence + context (position, surrounding elements)
3. Pick highest score; if tie: prompt user to disambiguate

## Coordinate Validation

Before using any coordinate:
- Check: `0 <= x <= viewport_width`, `0 <= y <= viewport_height`
- Check: not in a blocked zone (e.g., browser chrome, OS taskbar)
- Hover first if confidence < 0.8 to verify cursor change (pointer cursor = interactive element)

## Fallback Chain on Failure

```
find_element failed → visual grounding failed → 
  → read_screen to describe current state
  → report: "Could not find '{description}'. Current screen shows: [description]"
  → ask user to clarify or redirect
```
