# Canvas LMS Manual Setup Guide for A://Labs

## ⚠️ Important Context

Your Canvas account is on the **Free For Teacher** plan. API-based course creation returns `403 unauthorized`. This guide provides the **exact manual steps** to set up all 7 A://Labs remix courses.

**Time required:** ~25 minutes  
**What you need:** A web browser, your Canvas login, and this guide open side-by-side.

---

## Step 0: Log In to Canvas

1. Go to [https://canvas.instructure.com](https://canvas.instructure.com)
2. Log in with your credentials.
3. You should land on the **Dashboard**.

---

## Part 1: Create a Course

Repeat the following steps for each of the 7 courses listed in Part 2.

### Generic Course Creation Steps

1. On the **Dashboard**, click the green **"Start a New Course"** button (top-right of the "My Courses" section).
2. In the modal that appears, fill in:
   - **Course Name:** (copy from the table below)
   - **Reference Code:** (copy from the table below)
3. Click **"Create course"**.
4. You will be taken to the new course homepage.

### Add Course Details

5. In the left sidebar, click **"Settings"**.
6. Under **"Course Details"**, verify:
   - **Name:** matches exactly.
   - **Course Code:** matches exactly.
   - **Time Zone:** set to your local time zone (recommended: `Eastern Time (US & Canada)`).
7. Scroll down and click **"Update Course Details"**.

### Build the Modules

8. In the left sidebar, click **"Modules"**.
9. You will see an empty page. Click **"+ Module"**.
10. Enter the **Module Name** (from the table below).
11. Click **"Add Module"**.
12. With the module created, click the **"+"** icon on the right side of the module header.
13. In the dropdown:
    - Select **"Assignment"** → **"[ New Assignment ]"**
    - Name the assignment exactly: `Capstone Project: [Project Name from table]`
    - Points: `100`
    - Assignment Group: `Assignments`
    - Display Grade as: `Points`
    - Click **"Add Item"**
14. For remaining modules (the lecture modules), repeat step 12 but select:
    - **"Page"** → **"[ New Page ]"**
    - Name each page exactly as the module name.
    - Click **"Add Item"**
15. Reorder modules by dragging them. The Capstone module should be **last**.

### Publish the Course

16. On the course homepage (or in Settings), look for the **"Publish"** button near the top-right.
17. Click **"Publish"**. The course is now live.

---

## Part 2: The 7 Courses to Create

### Course 1: CORE — AI-Assisted Engineering

| Field | Value |
|-------|-------|
| **Course Name** | `A://Labs — Build AI-Assisted Software` |
| **Reference Code** | `ALABS-CORE-COPILOT` |
| **Capstone** | Build a TypeScript MCP Server with Cursor |

**Modules (in order):**
1. The Problem: Manual Coding is the Bottleneck
2. Copilot as Infrastructure
3. Cursor Workflows
4. Prompting for Clean Code
5. Extending Assistants with Tools
6. Bridge: Allternit's Cursor + Copilot Stack
7. Capstone Project: Build a TypeScript MCP Server with Cursor

---

### Course 2: CORE — Prompt Engineering

| Field | Value |
|-------|-------|
| **Course Name** | `A://Labs — Engineer Prompts for Agent Systems` |
| **Reference Code** | `ALABS-CORE-PROMPTS` |
| **Capstone** | Design a 3-Prompt Suite + Red-Team Report |

**Modules (in order):**
1. The Problem: Guesswork vs. Systematic Prompt Engineering
2. The Prompt Engineering Stack
3. Python + OpenAI API Patterns
4. System Prompt Design
5. Developer Prompt Patterns
6. Bridge: Allternit's agui-gateway Prompt Tiers
7. Capstone Project: Design a 3-Prompt Suite + Red-Team Report

---

### Course 3: OPS — n8n Automation

| Field | Value |
|-------|-------|
| **Course Name** | `A://Labs — Orchestrate Agents & Automations` |
| **Reference Code** | `ALABS-OPS-N8N` |
| **Capstone** | Build a Self-Hosted n8n MCP Workflow |

**Modules (in order):**
1. The Problem: Why n8n Over SaaS Automation
2. n8n Architecture
3. Business Workflow Patterns
4. OpenAI Agent Nodes
5. n8n as Connector Layer
6. Self-Hosting & Scaling
7. Bridge: How Allternit Uses n8n
8. Capstone Project: Build a Self-Hosted n8n MCP Workflow

---

### Course 4: OPS — Computer Vision

| Field | Value |
|-------|-------|
| **Course Name** | `A://Labs — Computer Vision for AI Systems` |
| **Reference Code** | `ALABS-OPS-VISION` |
| **Capstone** | Build a Screen-State Analyzer for LLM Agents |

**Modules (in order):**
1. The Problem: LLMs Are Blind
2. OpenCV + Python Foundations
3. Feature Detection & Tracking
4. Face & Object Detection with Deep Learning
5. Bridge: Connecting OpenCV to Agent Systems
6. Capstone Project: Build a Screen-State Analyzer for LLM Agents

---

### Course 5: OPS — Private RAG

| Field | Value |
|-------|-------|
| **Course Name** | `A://Labs — Private RAG & Document Intelligence` |
| **Reference Code** | `ALABS-OPS-RAG` |
| **Capstone** | Build an Offline Document-QA Agent |

**Modules (in order):**
1. The Problem: Cloud RAG Leaks Data
2. RAG Architecture
3. Local LLM Inference
4. Semantic Search Implementation
5. Agentic RAG
6. Bridge: Allternit's mcp-apps-adapter RAG
7. Capstone Project: Build an Offline Document-QA Agent

---

### Course 6: AGENTS — ML as Tools

| Field | Value |
|-------|-------|
| **Course Name** | `A://Labs — ML as Agent Tools` |
| **Reference Code** | `ALABS-AGENTS-ML` |
| **Capstone** | Wrap a Scikit-Learn Model as an MCP Tool |

**Modules (in order):**
1. The Problem: Agents Are Bad at Structured Data Math
2. When to Use ML vs. LLMs vs. Rules
3. Scikit-Learn Patterns
4. Feature Engineering for Structured Data
5. Bridge: Wrapping ML Models as MCP Tools
6. Capstone Project: Wrap a Scikit-Learn Model as an MCP Tool

---

### Course 7: AGENTS — Multi-Agent Systems

| Field | Value |
|-------|-------|
| **Course Name** | `A://Labs — Architect Multi-Agent Systems` |
| **Reference Code** | `ALABS-AGENTS-AGENTS` |
| **Capstone** | Design a 3-Agent Collaborative Blog-Writing System |

**Modules (in order):**
1. The Problem: One LLM Can't Do Everything
2. Agent Architecture Patterns
3. Tool-Using Agents
4. Code-Generation Agents
5. Multi-Agent Orchestration
6. Bridge: Allternit's Agent Swarm Communication
7. Capstone Project: Design a 3-Agent Collaborative Blog-Writing System

---

## Part 3: Configure Learning Paths (Optional but Recommended)

Canvas Free For Teacher does not have native "learning paths," but you can simulate them using **Modules** and **Prerequisites**.

### To set a module prerequisite:
1. Go to **Modules** inside a course.
2. Click the **three-dot menu** (⋮) on the right side of a module header.
3. Click **"Edit"**.
4. Under **"Prerequisites"**, click **"Add Prerequisite"**.
5. Select the previous module from the dropdown.
6. Click **"Update Module"**.

**Recommended prerequisite chain:**
- Module 2 requires Module 1
- Module 3 requires Module 2
- ...and so on.
- The Capstone module requires the Bridge module immediately before it.

This ensures learners cannot skip ahead without completing the prior content.

---

## Part 4: Add Course Description Text

For each course, go to **Settings → Course Details → Description** and paste the following template (customized per course):

```
A://Labs [Tier] Course — [Course Title]

This is a dense, project-first course for engineers building AI systems. 
By the end, you will ship a working capstone artifact.

Prerequisites: [List any prereqs]
Estimated time: [X] hours
Assessment: Capstone project submission (no quizzes)
```

**Example for ALABS-OPS-N8N:**
```
A://Labs OPS Course — Orchestrate Agents & Automations

This is a dense, project-first course for engineers building AI-powered 
automation infrastructure. By the end, you will deploy a self-hosted n8n 
workflow exposed as an MCP tool.

Prerequisites: Basic HTTP/API familiarity
Estimated time: 5–6 hours
Assessment: Capstone project submission (no quizzes)
```

---

## Part 5: Publish Checklist

After creating all 7 courses, verify:

- [ ] All 7 courses appear on your Dashboard.
- [ ] Each course shows as **Published** (green checkmark or "Published" label).
- [ ] Each course has the correct **Reference Code** in Settings.
- [ ] Each course has modules in the correct order.
- [ ] Each course has a **Capstone Project** assignment as the final module.
- [ ] Prerequisite chains are set (optional but recommended).
- [ ] Course descriptions are filled in.

---

## Part 6: Quick Troubleshooting

| Issue | Fix |
|-------|-----|
| Cannot find "Start a New Course" | Make sure you are on the **Dashboard**, not inside another course. |
| "Publish" button is grayed out | You may need to publish at least one module first. Go to Modules → click the cloud icon next to the module. |
| Cannot add prerequisites | Prerequisites require at least two published modules. Publish your modules first. |
| Course name is too long | Canvas supports up to ~255 characters. All A://Labs names fit comfortably. |

---

*Setup time: ~25 minutes. Result: a professional 7-course A://Labs learning environment in Canvas.*
