# summit.canvas.course_ingestor

## Purpose
Crawl a Canvas course and generate a structured index for the RAG retrieval system.

## Inputs
```json
{
  "course_id": <integer>,
  "include_files": <boolean>,
  "depth": "full" | "incremental"
}
```

## PLAN
1) List all modules: `canvas.list_modules(course_id)`
2) For each module, list items.
3) For each Page/Assignment, read content.
4) (If include_files) List and download course files.
5) Transform content into the `summit_course_index` schema.

## EXECUTE
1) Execute discovery tool calls.
2) Call Platform Embedding Service to generate vectors for each item.
3) Store the final index in `memory/course_indices/course_{id}.json`.

## STOP CONDITIONS
- If Canvas API rate limit is reached: pause and resume after 60s.
- If course_id is inaccessible: abort and log permission error.
