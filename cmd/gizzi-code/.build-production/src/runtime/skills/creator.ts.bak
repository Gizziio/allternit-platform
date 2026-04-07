/**
 * Skill Creator - TypeScript implementation of the skill-creator primitive
 * 
 * This module provides skill creation functionality for the Gizzi CLI,
 * implementing the same 6-step process as the Rust primitive:
 * 1. Understanding - Gather examples
 * 2. Planning - Identify resources
 * 3. Initializing - Create directory structure
 * 4. Editing - Manual editing
 * 5. Packaging - Create distributable
 * 6. Iteration - Improve based on usage
 */

import path from "path"
import fs from "fs/promises"
import { Filesystem } from "@/shared/util/filesystem"

export type SkillTemplate = "minimal" | "tool-integration" | "data-processing" | "workflow-automation"

export interface CreateSkillOptions {
  name: string
  description: string
  template: SkillTemplate
  targetPath: string
}

export interface SkillCreationSession {
  id: string
  skillName: string
  currentStep: CreationStep
  examples: SkillExample[]
  skillPath?: string
  createdAt: number
}

export type CreationStep = 
  | "understanding" 
  | "planning" 
  | "initializing" 
  | "editing" 
  | "packaging" 
  | "completed"

export interface SkillExample {
  userQuery: string
  expectedBehavior: string
  category: "primary" | "secondary" | "edge-case"
}

export class SkillCreator {
  private sessions: Map<string, SkillCreationSession> = new Map()
  private sessionCounter = 0

  /**
   * Create a new skill creation session
   */
  startSession(skillName: string): string {
    const sessionId = `session-${this.sessionCounter++}`
    const session: SkillCreationSession = {
      id: sessionId,
      skillName,
      currentStep: "understanding",
      examples: [],
      createdAt: Date.now(),
    }
    this.sessions.set(sessionId, session)
    return sessionId
  }

  /**
   * Add an example to a session
   */
  addExample(
    sessionId: string, 
    userQuery: string, 
    expectedBehavior: string, 
    category: SkillExample["category"] = "primary"
  ): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }
    
    session.examples.push({
      userQuery,
      expectedBehavior,
      category,
    })
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SkillCreationSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Create a skill from a template (one-shot creation)
   */
  static async createSkill(options: CreateSkillOptions): Promise<string> {
    const { name, description, template, targetPath } = options
    
    // Validate skill name
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error("Skill name must be kebab-case (lowercase letters, numbers, hyphens only)")
    }
    
    const skillDir = path.join(targetPath, name)
    
    // Check if skill already exists
    if (await Filesystem.exists(skillDir)) {
      throw new Error(`Skill already exists at ${skillDir}`)
    }
    
    // Create directory structure
    await fs.mkdir(skillDir, { recursive: true })
    await fs.mkdir(path.join(skillDir, "scripts"), { recursive: true })
    await fs.mkdir(path.join(skillDir, "references"), { recursive: true })
    await fs.mkdir(path.join(skillDir, "assets"), { recursive: true })
    
    // Generate SKILL.md
    const skillMd = generateSkillMd(name, description, template)
    await fs.writeFile(path.join(skillDir, "SKILL.md"), skillMd)
    
    // Add template-specific files
    await addTemplateFiles(skillDir, template)
    
    return skillDir
  }

  /**
   * Package a skill into a .skill file (ZIP archive)
   */
  static async packageSkill(skillDir: string, outputPath?: string): Promise<string> {
    const { exec } = await import("child_process")
    const { promisify } = await import("util")
    const execAsync = promisify(exec)
    
    const skillName = path.basename(skillDir)
    const output = outputPath || path.join(path.dirname(skillDir), `${skillName}.skill`)
    
    // Create ZIP archive
    await execAsync(`cd "${skillDir}" && zip -r "${output}" .`)
    
    return output
  }

  /**
   * Validate a skill directory
   */
  static async validateSkill(skillDir: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = []
    
    // Check SKILL.md exists
    const skillMdPath = path.join(skillDir, "SKILL.md")
    if (!(await Filesystem.exists(skillMdPath))) {
      errors.push("SKILL.md is required")
      return { valid: false, errors }
    }
    
    // Read and validate SKILL.md
    const content = await fs.readFile(skillMdPath, "utf-8")
    
    // Check frontmatter
    if (!content.startsWith("---")) {
      errors.push("SKILL.md must start with YAML frontmatter")
    } else {
      const endIndex = content.indexOf("---", 3)
      if (endIndex === -1) {
        errors.push("SKILL.md frontmatter not properly closed")
      } else {
        const frontmatter = content.slice(3, endIndex).trim()
        if (!frontmatter.includes("name:")) {
          errors.push("SKILL.md frontmatter must contain 'name' field")
        }
        if (!frontmatter.includes("description:")) {
          errors.push("SKILL.md frontmatter must contain 'description' field")
        }
      }
    }
    
    // Check for forbidden files
    const forbiddenFiles = ["README.md", "CHANGELOG.md", "INSTALLATION_GUIDE.md"]
    for (const file of forbiddenFiles) {
      if (await Filesystem.exists(path.join(skillDir, file))) {
        errors.push(`Forbidden file found: ${file}`)
      }
    }
    
    return { valid: errors.length === 0, errors }
  }
}

/**
 * Generate SKILL.md content
 */
function generateSkillMd(name: string, description: string, template: SkillTemplate): string {
  const templateSpecificContent = getTemplateContent(template)
  
  return `---
name: ${name}
description: ${description}
---

# ${name}

${description}

## Quick Start

${templateSpecificContent.quickStart}

## Usage

Describe how to use this skill effectively.

## Examples

### Example 1

**User Query:** "How do I use this skill?"

**Expected Behavior:** The skill should...

## Resources

### Scripts
- \`scripts/\` - ${template === "minimal" ? "Add executable scripts here" : "See included scripts"}

### References
- \`references/\` - ${template === "minimal" ? "Add documentation here" : "See included references"}

### Assets
- \`assets/\` - ${template === "minimal" ? "Add templates and assets here" : "See included assets"}

${templateSpecificContent.additionalSections}
`
}

/**
 * Get template-specific content
 */
function getTemplateContent(template: SkillTemplate): { 
  quickStart: string
  additionalSections: string
} {
  switch (template) {
    case "tool-integration":
      return {
        quickStart: `1. Configure API credentials in environment
2. Use the API client script for requests
3. Handle errors appropriately`,
        additionalSections: `## Scripts

- \`scripts/api_client.py\` - HTTP client with retries and error handling

## References

- \`references/api_reference.md\` - API documentation`,
      }
      
    case "data-processing":
      return {
        quickStart: `1. Place input data in the appropriate format
2. Run the transform script
3. Output will be in the specified format`,
        additionalSections: `## Scripts

- \`scripts/transform.py\` - Data transformation utilities

## References

- \`references/data_schema.md\` - Data schema documentation`,
      }
      
    case "workflow-automation":
      return {
        quickStart: `1. Define your workflow configuration
2. Run the pipeline script
3. Monitor execution progress`,
        additionalSections: `## Scripts

- \`scripts/pipeline.py\` - Workflow pipeline execution

## References

- \`references/workflow_patterns.md\` - Common workflow patterns`,
      }
      
    case "minimal":
    default:
      return {
        quickStart: "Add your quick start guide here.",
        additionalSections: "",
      }
  }
}

/**
 * Add template-specific files to skill directory
 */
async function addTemplateFiles(skillDir: string, template: SkillTemplate): Promise<void> {
  switch (template) {
    case "tool-integration":
      await fs.writeFile(
        path.join(skillDir, "scripts", "api_client.py"),
        API_CLIENT_SCRIPT
      )
      await fs.writeFile(
        path.join(skillDir, "references", "api_reference.md"),
        API_REFERENCE_MD
      )
      break
      
    case "data-processing":
      await fs.writeFile(
        path.join(skillDir, "scripts", "transform.py"),
        DATA_TRANSFORM_SCRIPT
      )
      await fs.writeFile(
        path.join(skillDir, "references", "data_schema.md"),
        DATA_SCHEMA_MD
      )
      break
      
    case "workflow-automation":
      await fs.writeFile(
        path.join(skillDir, "scripts", "pipeline.py"),
        PIPELINE_SCRIPT
      )
      await fs.writeFile(
        path.join(skillDir, "references", "workflow_patterns.md"),
        WORKFLOW_PATTERNS_MD
      )
      break
      
    case "minimal":
    default:
      // No additional files for minimal template
      break
  }
}

// Template file contents
const API_CLIENT_SCRIPT = `#!/usr/bin/env python3
"""API Client with retry logic and error handling."""

import requests
import time
from typing import Optional, Dict, Any


def api_request(
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    json_data: Optional[Dict[str, Any]] = None,
    max_retries: int = 3,
    timeout: int = 30
) -> Dict[str, Any]:
    """Make an API request with retry logic."""
    for attempt in range(max_retries):
        try:
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=json_data,
                timeout=timeout
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)  # Exponential backoff
    
    return {}


if __name__ == "__main__":
    # Example usage
    result = api_request("GET", "https://api.example.com/data")
    print(result)
`

const API_REFERENCE_MD = `# API Reference

## Base URL

https://api.example.com/v1

## Authentication

API requests require authentication via Bearer token.

## Endpoints

### GET /resource

Retrieve a list of resources.

### POST /resource

Create a new resource.

## Error Handling

- 400 - Bad Request
- 401 - Unauthorized
- 404 - Not Found
- 500 - Internal Server Error
`

const DATA_TRANSFORM_SCRIPT = `#!/usr/bin/env python3
"""Data transformation utilities."""

import json
import csv
from typing import List, Dict, Any


def transform_json(data: Dict[str, Any]) -> Dict[str, Any]:
    """Transform JSON data."""
    # Add transformation logic here
    return data


def transform_csv(rows: List[List[str]]) -> List[List[str]]:
    """Transform CSV data."""
    # Add transformation logic here
    return rows


def load_json(filepath: str) -> Dict[str, Any]:
    """Load JSON from file."""
    with open(filepath, 'r') as f:
        return json.load(f)


def save_json(data: Dict[str, Any], filepath: str) -> None:
    """Save JSON to file."""
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2)


if __name__ == "__main__":
    # Example usage
    data = load_json("input.json")
    transformed = transform_json(data)
    save_json(transformed, "output.json")
`

const DATA_SCHEMA_MD = `# Data Schema

## Input Format

Describe the expected input data format.

## Output Format

Describe the output data format.

## Validation Rules

- Field A: required, string
- Field B: optional, number
`

const PIPELINE_SCRIPT = `#!/usr/bin/env python3
"""Workflow pipeline execution."""

import json
from typing import List, Dict, Any, Callable
from dataclasses import dataclass
from enum import Enum


class StepStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class PipelineStep:
    name: str
    action: Callable[[], Any]
    depends_on: List[str] = None
    status: StepStatus = StepStatus.PENDING
    result: Any = None


class Pipeline:
    """Workflow pipeline executor."""
    
    def __init__(self, name: str):
        self.name = name
        self.steps: Dict[str, PipelineStep] = {}
    
    def add_step(self, step: PipelineStep) -> None:
        """Add a step to the pipeline."""
        self.steps[step.name] = step
    
    def run(self) -> Dict[str, Any]:
        """Execute the pipeline."""
        results = {}
        
        for name, step in self.steps.items():
            if step.status == StepStatus.PENDING:
                try:
                    step.status = StepStatus.RUNNING
                    step.result = step.action()
                    step.status = StepStatus.COMPLETED
                    results[name] = step.result
                except Exception as e:
                    step.status = StepStatus.FAILED
                    raise RuntimeError(f"Step {name} failed: {e}")
        
        return results


def example_step():
    """Example pipeline step."""
    return {"status": "success"}


if __name__ == "__main__":
    pipeline = Pipeline("example")
    pipeline.add_step(PipelineStep(
        name="step1",
        action=example_step
    ))
    results = pipeline.run()
    print(json.dumps(results, indent=2))
`

const WORKFLOW_PATTERNS_MD = `# Workflow Patterns

## Sequential Execution

Steps execute one after another in order.

## Parallel Execution

Independent steps execute concurrently.

## Conditional Branching

Steps execute based on conditions.

## Error Handling

- Retry with backoff
- Circuit breaker
- Dead letter queue
`
