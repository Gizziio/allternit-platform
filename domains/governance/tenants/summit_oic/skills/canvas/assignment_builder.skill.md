# Canvas Assignment Builder Skill

**Skill ID:** `summit.canvas.assignment_builder`  
**Version:** 1.0.0  
**Type:** Canvas Integration  

---

## Purpose

Create assignments in Canvas modules with **consistent, teacher-specific formatting** that works reliably every time.

---

## Teacher Context System

### Teacher Profile Schema

```json
{
  "teacher_id": "string",
  "name": "string",
  "preferences": {
    "assignment_format": {
      "include_objectives": true,
      "include_rubric": true,
      "include_materials_list": true,
      "include_timeline": true,
      "points_default": 100,
      "submission_type": "online_upload",
      "file_types": ["pdf", "docx", "txt"],
      "due_time": "23:59"
    },
    "grading": {
      "late_policy": "10% per day",
      "missing_policy": "0 points",
      "allow_resubmission": true
    },
    "communication": {
      "announcement_template": "string",
      "email_notifications": true
    }
  },
  "course_defaults": {
    "module_structure": ["Overview", "Content", "Practice", "Assessment"],
    "assignment_types": ["discussion", "quiz", "project", "reflection"]
  }
}
```

---

## Assignment Template System

### Standard Assignment Format

Every assignment created follows this **consistent structure**:

```markdown
# {Assignment Title}

## 📋 Learning Objectives
- Objective 1
- Objective 2
- Objective 3

## 📝 Instructions
{Detailed assignment instructions}

## 📚 Materials Needed
- Material 1
- Material 2

## 📅 Timeline
- Start: {date}
- Due: {date}
- Estimated time: {hours} hours

## ✅ Submission Requirements
- File type: {types}
- Max files: {count}
- Word count: {min}-{max}

## 📊 Rubric
| Criteria | Excellent | Good | Needs Work |
|----------|-----------|------|------------|
| {Criterion 1} | ... | ... | ... |

## 💡 Tips for Success
- Tip 1
- Tip 2
```

---

## Skill Inputs

### Create Assignment Request

```json
{
  "course_id": "string",
  "module_id": "string",
  "assignment": {
    "name": "string",
    "type": "discussion|quiz|project|reflection|essay",
    "week": "number",
    "topic": "string",
    "objectives": ["string"],
    "instructions": "string",
    "materials": ["string"],
    "estimated_hours": "number",
    "points": "number",
    "due_date": "ISO8601",
    "rubric_criteria": [
      {
        "name": "string",
        "levels": [
          {"name": "Excellent", "points": 10, "description": "string"},
          {"name": "Good", "points": 8, "description": "string"},
          {"name": "Needs Work", "points": 5, "description": "string"}
        ]
      }
    ]
  },
  "teacher_preferences": "TeacherProfile | null"
}
```

---

## Skill Outputs

### Assignment Created

```json
{
  "success": true,
  "assignment": {
    "id": "number",
    "name": "string",
    "url": "string",
    "points": "number",
    "due_date": "string",
    "rubric_id": "number"
  },
  "module_updated": true,
  "receipt": {
    "id": "string",
    "created_at": "ISO8601",
    "teacher_id": "string"
  }
}
```

---

## Implementation

### Canvas API Calls

1. **Create Assignment**
   ```
   POST /api/v1/courses/{course_id}/assignments
   ```

2. **Create Rubric**
   ```
   POST /api/v1/courses/{course_id}/rubrics
   ```

3. **Add to Module**
   ```
   POST /api/v1/courses/{course_id}/modules/{module_id}/items
   ```

4. **Create Assignment Group** (if needed)
   ```
   POST /api/v1/courses/{course_id}/assignment_groups
   ```

---

## Assignment Type Templates

### Discussion Assignment

```json
{
  "template_id": "discussion",
  "structure": {
    "initial_post": {
      "word_count": "200-300",
      "due": "Thursday 23:59"
    },
    "responses": {
      "count": 2,
      "word_count": "100-150 each",
      "due": "Sunday 23:59"
    },
    "rubric": {
      "criteria": ["Initial Post Quality", "Response Quality", "Timeliness"]
    }
  }
}
```

### Project Assignment

```json
{
  "template_id": "project",
  "structure": {
    "phases": [
      {"name": "Proposal", "points": 10, "due": "Week 1"},
      {"name": "Draft", "points": 20, "due": "Week 2"},
      {"name": "Final", "points": 70, "due": "Week 3"}
    ],
    "deliverables": ["document", "presentation", "code"],
    "rubric": {
      "criteria": ["Technical Quality", "Creativity", "Documentation", "Presentation"]
    }
  }
}
```

### Quiz Assignment

```json
{
  "template_id": "quiz",
  "structure": {
    "question_count": 10,
    "time_limit": 60,
    "attempts": 2,
    "question_types": ["multiple_choice", "true_false", "short_answer"],
    "rubric": {
      "scoring": "points_per_question"
    }
  }
}
```

### Reflection Assignment

```json
{
  "template_id": "reflection",
  "structure": {
    "prompts": [
      "What did you learn?",
      "What challenges did you face?",
      "How will you apply this?"
    ],
    "word_count": "300-500",
    "rubric": {
      "criteria": ["Depth of Reflection", "Connection to Content", "Self-Awareness"]
    }
  }
}
```

---

## Usage Examples

### Example 1: Create Discussion Assignment

```json
{
  "skill": "summit.canvas.assignment_builder",
  "action": "create_assignment",
  "input": {
    "course_id": "14389375",
    "module_id": "22666851",
    "assignment": {
      "name": "Week 1 Discussion: AI Ethics",
      "type": "discussion",
      "week": 1,
      "topic": "Ethical Implications of AI",
      "objectives": [
        "Identify key ethical concerns in AI development",
        "Articulate multiple perspectives on AI regulation",
        "Respond thoughtfully to peer viewpoints"
      ],
      "instructions": "Research current AI ethics debates and share your perspective...",
      "points": 100,
      "due_date": "2026-03-20T23:59:00Z"
    },
    "teacher_preferences": {
      "discussion": {
        "initial_post_words": 250,
        "response_count": 2,
        "response_words": 100
      }
    }
  }
}
```

### Example 2: Create Project Assignment

```json
{
  "skill": "summit.canvas.assignment_builder",
  "action": "create_assignment",
  "input": {
    "course_id": "14389375",
    "module_id": "22666851",
    "assignment": {
      "name": "Week 1 Project: AI Tool Analysis",
      "type": "project",
      "week": 1,
      "topic": "Analyze an AI Tool",
      "objectives": [
        "Evaluate AI tool capabilities",
        "Assess limitations and biases",
        "Propose improvements"
      ],
      "phases": [
        {"name": "Tool Selection", "due": "2026-03-15"},
        {"name": "Analysis Report", "due": "2026-03-22"},
        {"name": "Presentation", "due": "2026-03-29"}
      ],
      "points": 100
    }
  }
}
```

---

## Error Handling

### Validation Errors

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TEMPLATE",
    "message": "Assignment type 'workshop' not supported",
    "supported_types": ["discussion", "quiz", "project", "reflection", "essay"]
  }
}
```

### Canvas API Errors

```json
{
  "success": false,
  "error": {
    "code": "CANVAS_API_ERROR",
    "status": 400,
    "message": "Due date cannot be in the past",
    "field": "due_date"
  }
}
```

---

## Receipt Schema

```json
{
  "id": "receipt_{timestamp}",
  "skill": "summit.canvas.assignment_builder",
  "teacher_id": "string",
  "course_id": "string",
  "assignment_id": "number",
  "actions": [
    {"step": 1, "action": "create_assignment", "status": "success"},
    {"step": 2, "action": "create_rubric", "status": "success"},
    {"step": 3, "action": "add_to_module", "status": "success"}
  ],
  "created_objects": [
    {"type": "assignment", "id": "number", "name": "string"},
    {"type": "rubric", "id": "number", "name": "string"}
  ],
  "verification": {
    "assignment_exists": true,
    "rubric_attached": true,
    "module_updated": true
  },
  "created_at": "ISO8601"
}
```

---

## Integration with Allternit Operator

This skill integrates with the Allternit Operator through:

1. **Canvas Connector** - API calls
2. **Policy Engine** - Teacher preference enforcement
3. **Receipt System** - Audit trail
4. **Plan Generator** - Assignment sequencing

### Execution Flow

```
Teacher Request
    ↓
Plan Generator (creates assignment plan)
    ↓
Policy Engine (applies teacher preferences)
    ↓
Canvas Connector (API calls)
    ↓
Verification (confirm created)
    ↓
Receipt (audit trail)
```

---

*Skill Version: 1.0.0*  
*Last Updated: 2026-03-13*
