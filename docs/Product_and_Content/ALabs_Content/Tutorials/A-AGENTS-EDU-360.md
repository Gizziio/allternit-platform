# A://AGENTS-EDU-360 — Build a Lesson Generation System

**Outcome:** Automated curriculum creation from source material  
**Artifact:** Working lesson generator with module/assessment output  
**Prerequisites:** A://OPS-CONTENT-203, A://CORE-REASONING-001  
**Time:** 6-8 hours  
**Difficulty:** Advanced

---

## Problem

Creating educational content is slow:
- Manual curriculum design
- Inconsistent structure
- Hard to update
- No systematic approach

---

## What You're Building

A lesson generation system that:
1. Ingests source material
2. Extracts learning objectives
3. Generates structured modules
4. Creates assessments
5. Outputs curriculum package

**System Flow:**
```
Source → Analyze → Extract Objectives → Generate Modules → Create Assessments → Package
```

---

## Stack

| Component | Recommendation | Alternative |
|-----------|---------------|-------------|
| Source Parsing | Python + libraries | Unstructured.io |
| Content Gen | GPT-4 | Claude 3 |
| Structure | JSON Schema | YAML |
| Storage | PostgreSQL + JSONB | MongoDB |
| Backend | Python/FastAPI | Node.js |

---

## Implementation

### Step 1: Source Analysis

```python
from typing import List, Dict
import openai

class SourceAnalyzer:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def analyze(self, source_text: str, target_audience: str = "general") -> Dict:
        """Analyze source and extract curriculum structure."""
        
        prompt = f"""Analyze the following source material and extract curriculum components.

Target Audience: {target_audience}

Source Material:
{source_text[:8000]}

Extract and return JSON:
{{
    "title": "Course title",
    "description": "Course description",
    "learning_objectives": ["obj 1", "obj 2", "obj 3"],
    "key_concepts": ["concept 1", "concept 2"],
    "prerequisites": ["prereq 1"],
    "estimated_duration": "X hours",
    "difficulty": "beginner|intermediate|advanced",
    "module_outline": [
        {{
            "title": "Module 1 title",
            "learning_objectives": ["obj 1", "obj 2"],
            "key_topics": ["topic 1", "topic 2"],
            "content_summary": "What this module covers"
        }}
    ]
}}"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
```

### Step 2: Module Generator

```python
class ModuleGenerator:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def generate_module(self, module_outline: Dict, source_text: str) -> Dict:
        """Generate full module content."""
        
        prompt = f"""Generate a complete learning module based on the outline and source material.

Module Outline:
Title: {module_outline['title']}
Objectives: {', '.join(module_outline['learning_objectives'])}
Topics: {', '.join(module_outline['key_topics'])}

Source Material:
{source_text[:6000]}

Generate JSON:
{{
    "module_title": "title",
    "module_objectives": ["list"],
    "lessons": [
        {{
            "lesson_title": "title",
            "content": "Detailed lesson content with explanations and examples",
            "examples": ["example 1", "example 2"],
            "exercises": [
                {{
                    "type": "quiz|coding|written",
                    "question": "question text",
                    "answer": "expected answer"
                }}
            ],
            "estimated_minutes": 30
        }}
    ],
    "module_assessment": {{
        "questions": [
            {{
                "question": "assessment question",
                "type": "multiple_choice|open_ended|practical",
                "options": ["if multiple choice"],
                "correct_answer": "answer",
                "points": 10
            }}
        ]
    }}
}}"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
```

### Step 3: Assessment Generator

```python
class AssessmentGenerator:
    def __init__(self):
        openai.api_key = os.getenv("OPENAI_API_KEY")
    
    def generate_assessment(self, learning_objectives: List[str], difficulty: str = "intermediate") -> Dict:
        """Generate comprehensive assessment."""
        
        objectives_text = "\n".join(f"- {obj}" for obj in learning_objectives)
        
        prompt = f"""Create a comprehensive assessment for the following learning objectives.

Learning Objectives:
{objectives_text}

Difficulty: {difficulty}

Generate JSON:
{{
    "assessment_title": "Final Assessment",
    "total_points": 100,
    "time_limit_minutes": 60,
    "sections": [
        {{
            "section_name": "Knowledge Check",
            "section_type": "multiple_choice",
            "questions": [
                {{
                    "question": "question text",
                    "options": ["A", "B", "C", "D"],
                    "correct": "A",
                    "explanation": "why this is correct",
                    "points": 5
                }}
            ]
        }},
        {{
            "section_name": "Practical Application",
            "section_type": "practical",
            "questions": [
                {{
                    "scenario": "scenario description",
                    "task": "what learner must do",
                    "rubric": ["criterion 1", "criterion 2"],
                    "points": 30
                }}
            ]
        }}
    ]
}}"""

        response = openai.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"}
        )
        
        return json.loads(response.choices[0].message.content)
```

### Step 4: Full Pipeline

```python
class LessonGenerationPipeline:
    def __init__(self):
        self.analyzer = SourceAnalyzer()
        self.module_gen = ModuleGenerator()
        self.assessment_gen = AssessmentGenerator()
    
    def generate_curriculum(self, source_text: str, target_audience: str = "general") -> Dict:
        """Run full generation pipeline."""
        
        # Step 1: Analyze source
        analysis = self.analyzer.analyze(source_text, target_audience)
        
        # Step 2: Generate modules
        modules = []
        for module_outline in analysis.get("module_outline", []):
            module = self.module_gen.generate_module(module_outline, source_text)
            modules.append(module)
        
        # Step 3: Generate final assessment
        assessment = self.assessment_gen.generate_assessment(
            analysis.get("learning_objectives", []),
            analysis.get("difficulty", "intermediate")
        )
        
        # Compile curriculum
        curriculum = {
            "title": analysis["title"],
            "description": analysis["description"],
            "metadata": {
                "target_audience": target_audience,
                "difficulty": analysis["difficulty"],
                "estimated_duration": analysis["estimated_duration"],
                "prerequisites": analysis["prerequisites"]
            },
            "learning_objectives": analysis["learning_objectives"],
            "modules": modules,
            "final_assessment": assessment
        }
        
        return curriculum
```

### Step 5: API

```python
from fastapi import FastAPI, UploadFile
from pydantic import BaseModel
import json

app = FastAPI()
pipeline = LessonGenerationPipeline()

class GenerateRequest(BaseModel):
    source_text: str
    target_audience: str = "general"
    course_title: str = None

@app.post("/generate")
async def generate_curriculum(request: GenerateRequest):
    """Generate curriculum from source text."""
    curriculum = pipeline.generate_curriculum(
        request.source_text,
        request.target_audience
    )
    return curriculum

@app.post("/generate/upload")
async def generate_from_upload(file: UploadFile, target_audience: str = "general"):
    """Generate curriculum from uploaded file."""
    content = await file.read()
    text = content.decode('utf-8')
    
    curriculum = pipeline.generate_curriculum(text, target_audience)
    return curriculum

@app.post("/generate/refine")
async def refine_module(module: dict, feedback: str):
    """Refine a module based on feedback."""
    # TODO: Implement refinement logic
    return {"status": "refined"}
```

---

## Capstone

Submit:
1. Generated curriculum package
2. Before/after comparison
3. Assessment quality evaluation
4. Export to LMS format (SCORM/JSON)

---

**Build this. Deploy it. Teach at scale.**
