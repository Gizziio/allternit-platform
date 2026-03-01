# summit.canvas.module_builder

## Purpose
Create a Canvas Module with Pages and optional Assignments, using deterministic steps.

## Inputs
forms/module_builder.form.json

## Output
memory/schemas/artifact_receipt.schema.json

## PLAN (must output plan.json first)
Plan format:
```json
{
  "skill": "summit.canvas.module_builder",
  "confirmed": false,
  "course_id": <int>,
  "module": { "name": "...", "published": false },
  "items": [
    { "id": "step-1", "type": "page", "title": "...", "body": "...", "published": false },
    { "id": "step-2", "type": "assignment", "title": "...", "description": "...", "points": 10 }
  ]
}
```

Rules:
- No tool calls in PLAN phase.
- Stable ordering of items.
- Any randomness forbidden.

## EXECUTE
Steps:
1) canvas.create_module(course_id, module.name, published=false)
2) For each item in order:
   - if page: canvas.create_page(...)
   - add module item: canvas.add_module_item(...)
   - if assignment: canvas.create_assignment(...)
3) If inputs.publish==true then canvas.publish_module(...)

## STOP CONDITIONS
- If any write step fails twice: stop and emit partial receipt.

## RECEIPT
Must include created object ids + URLs and a step->object map.
