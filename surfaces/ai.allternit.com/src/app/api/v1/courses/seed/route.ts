import { NextResponse } from "next/server";
import { db } from "@/lib/db/client-sqlite";
import { alabsCourse } from "@/lib/db/schema-sqlite";

const SEED_COURSES = [
  {
    code: "ALABS-CORE-COPILOT",
    title: "Build AI-Assisted Software with Copilot & Cursor",
    description: "Learn to use GitHub Copilot and Cursor as infrastructure layers for code generation, refactoring, and MCP tool building.",
    tier: "CORE" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14593493",
    modules: 7,
    capstone: "Build a TypeScript MCP Server with Cursor",
    coverImage: "/images/alabs-covers/ALABS-CORE-COPILOT.png",
    sortOrder: 1,
    published: true,
  },
  {
    code: "ALABS-CORE-PROMPTS",
    title: "Prompt Engineering & Systematic LLM Reasoning",
    description: "Master prompt engineering from first principles: systematic prompting, Python API patterns, and red-teaming.",
    tier: "CORE" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14593495",
    modules: 7,
    capstone: "Design a 3-Prompt Suite + Red-Team Report",
    coverImage: "/images/alabs-covers/ALABS-CORE-PROMPTS.png",
    sortOrder: 2,
    published: true,
  },
  {
    code: "ALABS-OPS-N8N",
    title: "Orchestrate Agents & Automations with n8n",
    description: "Build production business workflows with n8n: architecture, patterns, OpenAI agent nodes, and self-hosted scaling.",
    tier: "OPS" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14593499",
    modules: 8,
    capstone: "Build a Self-Hosted n8n MCP Workflow",
    coverImage: "/images/alabs-covers/ALABS-OPS-N8N.png",
    sortOrder: 3,
    published: true,
  },
  {
    code: "ALABS-OPS-VISION",
    title: "Computer Vision for Agent Systems",
    description: "Connect OpenCV and vision models to agent systems. Feature detection, object tracking, and screen-state analysis.",
    tier: "OPS" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14593501",
    modules: 6,
    capstone: "Build a Screen-State Analyzer for LLM Agents",
    coverImage: "/images/alabs-covers/ALABS-OPS-VISION.png",
    sortOrder: 4,
    published: true,
  },
  {
    code: "ALABS-OPS-RAG",
    title: "Local RAG & Document Intelligence",
    description: "Build privacy-preserving RAG pipelines with local LLMs, semantic search, and offline document Q&A agents.",
    tier: "OPS" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14593503",
    modules: 7,
    capstone: "Offline Document-QA Agent",
    coverImage: "/images/alabs-covers/ALABS-OPS-RAG.png",
    sortOrder: 5,
    published: true,
  },
  {
    code: "ALABS-AGENTS-ML",
    title: "ML Models as Agent Tools",
    description: "When to use ML vs. LLMs vs. rules. Wrap scikit-learn models as MCP tools and integrate them into agent workflows.",
    tier: "AGENTS" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14593505",
    modules: 6,
    capstone: "Wrap a Scikit-Learn Model as an MCP Tool",
    coverImage: "/images/alabs-covers/ALABS-AGENTS-ML.png",
    sortOrder: 6,
    published: true,
  },
  {
    code: "ALABS-AGENTS-AGENTS",
    title: "Multi-Agent Systems & Orchestration",
    description: "Design collaborative agent swarms: tool-using agents, code-generation agents, and multi-agent orchestration patterns.",
    tier: "AGENTS" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14593507",
    modules: 7,
    capstone: "Design a 3-Agent Collaborative Blog-Writing System",
    coverImage: "/images/alabs-covers/ALABS-AGENTS-AGENTS.png",
    sortOrder: 7,
    published: true,
  },
  {
    code: "ALABS-ADV-PLUGINSDK",
    title: "Build Plugins for Allternit",
    description: "Deep dive into the Allternit Plugin SDK: architecture, adapters, PluginHost, publishing, and production integration.",
    tier: "ADV" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14612851",
    modules: 4,
    capstone: "Build a Cross-Platform Plugin with PluginHost",
    coverImage: "/images/alabs-covers/ALABS-ADV-PLUGINSDK.png",
    demosUrl: "/demos/ALABS-ADV-PLUGINSDK-module1.html",
    sortOrder: 8,
    published: true,
  },
  {
    code: "ALABS-ADV-WORKFLOW",
    title: "The Allternit Workflow Engine",
    description: "Visual DAG orchestration, scheduler, execution model, and production workflow integration.",
    tier: "ADV" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14612861",
    modules: 3,
    capstone: "Build a Custom Workflow Node",
    coverImage: "/images/alabs-covers/ALABS-ADV-WORKFLOW.png",
    demosUrl: "/demos/ALABS-ADV-WORKFLOW-module1.html",
    sortOrder: 9,
    published: true,
  },
  {
    code: "ALABS-ADV-ADAPTERS",
    title: "Provider Adapters & Unified APIs",
    description: "Abstraction layers, rate limiting, resilience patterns, failover, and production API integration.",
    tier: "ADV" as const,
    canvasUrl: "https://canvas.instructure.com/courses/14612869",
    modules: 3,
    capstone: "Build a Provider Adapter for a New API",
    coverImage: "/images/alabs-covers/ALABS-ADV-ADAPTERS.png",
    demosUrl: "/demos/ALABS-ADV-ADAPTERS-module1.html",
    sortOrder: 10,
    published: true,
  },
];

export async function POST() {
  try {
    const results = [];
    for (const course of SEED_COURSES) {
      try {
        const [inserted] = await db
          .insert(alabsCourse)
          .values(course)
          .onConflictDoNothing({ target: alabsCourse.code })
          .returning();
        if (inserted) results.push(inserted);
      } catch {
        // Skip duplicates
      }
    }
    return NextResponse.json({
      message: `Seeded ${results.length} courses`,
      courses: results,
    });
  } catch (error) {
    console.error("[POST /api/v1/courses/seed] error:", error);
    return NextResponse.json({ error: "Failed to seed courses" }, { status: 500 });
  }
}
