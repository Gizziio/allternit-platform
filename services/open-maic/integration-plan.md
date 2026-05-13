# OpenMAIC Integration Plan

## 1. Goal

Enable A://Labs Classroom to generate and deliver immersive AI-powered lessons using OpenMAIC's multi-agent classroom technology.

## 2. Technical Stack Alignment

| Layer | OpenMAIC | Allternit |
|-------|----------|-----------|
| Frontend | Next.js 15 + React 18 + Tailwind | Next.js 15 + React 18 + Tailwind |
| State Machine | LangGraph | Custom agent system |
| Orchestration | Multi-agent (teacher + classmates) | Multi-agent swarms |
| Voice | TTS + ASR | Not yet implemented |

## 3. API Contract

### 3.1 Lesson Generation

```
POST /api/v1/lessons/generate
```

Request:
```json
{
  "topic": "Introduction to RAG Pipelines",
  "sourceDocument": "optional-base64-pdf",
  "tier": "OPS",
  "targetDuration": 30,
  "sceneTypes": ["slides", "quiz", "simulation"]
}
```

Response:
```json
{
  "lessonId": "uuid",
  "title": "Introduction to RAG Pipelines",
  "scenes": [
    {
      "type": "slide",
      "content": { ... },
      "narration": "optional-tts-text"
    },
    {
      "type": "quiz",
      "questions": [ ... ]
    }
  ],
  "metadata": {
    "estimatedDuration": 28,
    "difficulty": "intermediate"
  }
}
```

### 3.2 Scene Renderer Registry

| Scene Type | Component | Status |
|-----------|-----------|--------|
| `slide` | `SlideDeck` | Planned |
| `quiz` | `QuizPlayer` | Planned |
| `simulation` | `SimSandbox` | Planned |
| `whiteboard` | `Whiteboard` | Planned |
| `pbl` | `PBLWorkspace` | Planned |

## 4. Database Schema

```sql
CREATE TABLE alabsLesson (
  id TEXT PRIMARY KEY,
  courseId TEXT REFERENCES ALABSCourse(id),
  title TEXT NOT NULL,
  description TEXT,
  tier TEXT NOT NULL,
  sceneJson TEXT NOT NULL, -- JSON array of scenes
  status TEXT DEFAULT 'draft',
  generatedBy TEXT DEFAULT 'openmaic',
  createdAt INTEGER,
  updatedAt INTEGER
);
```

## 5. Implementation Roadmap

### Week 1: Foundation
- [ ] Set up `services/open-maic/` directory
- [ ] Create `alabsLesson` table in schema
- [ ] Build generation bridge (topic → OpenMAIC outline → scene JSON)
- [ ] Add "Classroom" tab to A://Labs (placeholder)

### Week 2: Scene Components
- [ ] Build `SlideDeck` component
- [ ] Build `QuizPlayer` component
- [ ] Build `SimSandbox` component
- [ ] Lesson player container with progress tracking

### Week 3: Content Pipeline
- [ ] Integrate OpenMAIC generation into course creation flow
- [ ] Auto-generate lessons for CORE tier courses
- [ ] Store generated content in DB

### Week 4: Multi-Agent Features
- [ ] AI Teacher persona configuration
- [ ] AI Classmates for discussions
- [ ] TTS integration for narration

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| AGPL-3.0 license | Use as external service, not linked binary |
| LangGraph dependency bloat | Run as separate service |
| Generated content quality | Human review gate before publishing |
| Performance of complex scenes | Lazy loading + code splitting |
