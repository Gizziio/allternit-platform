---
id: canvas
name: Canvas
version: 1.0.0
description: Canvas LMS integration for course management
author: GizziClaw Team
license: MIT
capabilities:
  - list-courses
  - get-assignments
  - submit-assignment
  - get-grades
dependencies:
  - canvas-api
---

# Canvas Skill

This skill provides Canvas LMS integration for course management.

## Usage

```typescript
// List courses
const courses = await skills.canvas.listCourses();

// Get assignments
const assignments = await skills.canvas.getAssignments(courseId);

// Submit assignment
await skills.canvas.submitAssignment(courseId, assignmentId, submission);
```

## Configuration

Requires `CANVAS_API_URL` and `CANVAS_API_TOKEN` environment variables.
