# A://Labs - Udemy Course Catalog

## Overview

The **Udemy Course Catalog** is a browsable interface for discovering and curating **free** Udemy courses that match A://Labs subject areas. No authentication required - uses Udemy's public search API.

## Access

Click the **🌐 Globe icon** in the bottom-left footer of the Allternit platform, OR click **"Browse Free Catalog"** from the A://Labs view.

## A://Labs Course Categories

The catalog is organized by **3 tiers** matching the A://Labs curriculum:

### Tier CORE (Foundations) - Beginner Level
| Category | What It Covers |
|----------|---------------|
| **AI Reasoning & Prompt Engineering** | Prompt engineering, chain of thought, structured output, LLM prompting |
| **Multimodal AI Workflows** | Computer vision, document processing, OCR, image analysis |
| **AI Evaluation & Trust** | AI safety, evaluation criteria, trust boundaries, quality assessment |

### Tier OPS (Operations) - Intermediate Level
| Category | What It Covers |
|----------|---------------|
| **AI Workflow Design** | Business process automation, AI productivity, Zapier AI |
| **Research Operations** | AI-assisted research, web scraping, data extraction |
| **Content Operations** | AI content generation, writing automation, copywriting |
| **Knowledge Management** | Knowledge bases, enterprise search, document management, Notion AI |

### Tier AGENTS (Advanced/Build) - Expert Level
| Category | What It Covers |
|----------|---------------|
| **RAG & Document Intelligence** | RAG systems, vector databases (Pinecone, Chroma), semantic search, LangChain |
| **Multi-Agent Orchestration** | LangGraph, CrewAI, AutoGen, agent collaboration, orchestration |
| **AI Copilot & Code Generation** | Coding assistants, code generation, automated code review |
| **Web Research Agent** | Web scraping, web automation, research synthesis |
| **Knowledge Base Assistant** | RAG chatbots, document Q&A, multi-source ingestion |

## How to Use

### 1. Browse by Category
1. Open the Catalog view (Globe icon in footer)
2. Click **"Browse Categories"** tab
3. Expand a tier (CORE, OPS, or AGENTS)
4. Click on a category to explore

### 2. Search
1. Click the **"Search"** tab
2. Enter a search term (e.g., "LangChain RAG", "prompt engineering")
3. Press Enter or click Search
4. Filter by level, price, or tier

### 3. Curate Courses
When you find a course that should be part of A://Labs:
1. Click **"✓ Add to A://Labs"** on the course card
2. The course is added to your curated list (stored in localStorage)
3. View all curated courses in the **"Curated"** tab

### 4. Export to Canvas LMS
- Click **"Export to Canvas LMS"** in the Curated tab
- This will use the existing Canvas API integration to upload curated courses
- (Feature in development)

## Course Card Info

Each course card shows:
- **Title & Headline** - Course name and description
- **Rating** - Star rating with review count
- **Subscribers** - Number of enrolled students
- **Level** - Beginner (🟢), Intermediate (🟡), Expert (🔴)
- **Price** - Free/Paid indicator
- **Curated Status** - Whether already added to A://Labs

## Filters

| Filter | Options | Description |
|--------|---------|-------------|
| **Tier** | All / CORE / OPS / AGENTS | Filter by A://Labs tier |
| **Level** | All / Beginner / Intermediate / Expert | Filter by difficulty |
| **Price** | Free Only / Paid Only / All | Filter by cost |

## Technical Notes

### CORS & Backend Proxy
Direct browser access to Udemy's API may be blocked by CORS. In production:
1. Route searches through your backend API
2. Backend proxies the Udemy API with proper headers
3. Returns results to the frontend

### Rate Limiting
The search client includes 500ms delays between requests to be respectful to Udemy's servers.

### Curated Course Storage
Currently stored in `localStorage` under key `allternit-labs-curated-courses`. In production:
- Move to database
- Track who curated it and when
- Support team curation workflows

## Search Terms Used Per Category

The catalog automatically searches multiple related terms per category:

**Example - RAG & Document Intelligence:**
- "RAG AI"
- "retrieval augmented generation"
- "vector database"
- "LangChain RAG"
- "semantic search AI"
- "Pinecone"
- "Chroma DB"

Results are deduplicated by course ID and sorted by rating + subscriber count.

## Next Steps

1. **Backend Proxy** - Set up API endpoint to avoid CORS issues
2. **Live Search** - Actually fetch from Udemy API through backend
3. **Course Details Modal** - Full course description, curriculum preview
4. **Canvas LMS Upload** - Export curated courses to Canvas
5. **Team Curation** - Multiple people can suggest/review courses
6. **Course Mapping** - Map external courses to A://Labs internal courses
7. **Periodic Sync** - Re-check curated courses for updates

## Files Created

| File | Purpose |
|------|---------|
| `services/udemy-downloader/src/udemy-publicsearch.ts` | Public search API client + category definitions |
| `surfaces/allternit-platform/src/views/CatalogView.tsx` | Main catalog UI component |
| `surfaces/allternit-platform/src/nav/nav.types.ts` | Added "catalog" view type |
| `surfaces/allternit-platform/src/nav/nav.policy.ts` | Added catalog spawn policy |
| `surfaces/allternit-platform/src/shell/ShellApp.tsx` | Registered CatalogView in registry |
| `surfaces/allternit-platform/src/views/LabsView.tsx` | Added "Browse Free Catalog" button |
| `surfaces/allternit-platform/src/shell/ShellRail.tsx` | Added Globe nav button |
