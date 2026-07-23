/**
 * Document Generator Connector
 *
 * Bridges Allternit agents to the Document Generator FastAPI service.
 * The service lives at services/document-generator/ and provides:
 * - PPTX photo-card deck generation
 * - DOCX/PDF study guide generation
 * - XLSX rubric/spreadsheet generation
 * - SharePoint upload
 * - Canvas module creation
 *
 * @module tools/document-generator
 */

import { z } from "zod";

// Tool metadata
export const tool = {
  id: "document-generator",
  title: "Document Generator",
  description: "Generate documents (PPTX, DOCX, XLSX, PDF) via the Document Generator FastAPI service. Supports photo-card decks, study guides, rubrics, and Canvas module creation.",
  kind: "write" as const,
  safety_level: "safe" as const,
  version: "1.0.0",
  tags: ["documents", "presentations", "spreadsheets", "academic", "office"],
  author: "Allternit",
  license: "MIT",
};

// Configuration
const SERVICE_BASE_URL = process.env.DOCUMENT_GENERATOR_URL || "http://localhost:8000";
const API_KEY = process.env.DOCUMENT_GENERATOR_API_KEY || "your-secret-api-key";

// Input schema
export const inputSchema = z.object({
  action: z.enum([
    "generatePhotoCardDeck",
    "generateStudyGuide",
    "generateRubricSpreadsheet",
    "createCanvasModule",
    "healthCheck",
  ]).describe("Which Summit Copilot action to invoke"),

  // Common fields
  title: z.string().optional().describe("Title for the artifact"),
  topic: z.string().optional().describe("Topic for study guides"),

  // Deck fields
  slide_count: z.number().min(4).max(10).optional().default(6).describe("Number of slides (4-10)"),
  key_points: z.array(z.string()).optional().describe("Key points for slides"),
  deck_style: z.string().optional().default("photo_card"),
  images: z.array(z.string()).optional().describe("Image URLs for backgrounds"),

  // Study guide fields
  learning_objectives: z.array(z.string()).optional(),
  key_terms: z.array(z.string()).optional(),
  include_self_check: z.boolean().optional().default(true),
  examples: z.array(z.string()).optional(),
  format: z.enum(["docx", "pdf", "pptx", "xlsx"]).optional().default("docx"),
  length: z.enum(["short", "medium"]).optional().default("short"),

  // Rubric fields
  template_type: z.enum(["rubric", "tracker", "study_plan", "grade_calc"]).optional(),
  columns: z.array(z.string()).optional(),
  rows: z.array(z.array(z.string())).optional(),
  formulas: z.record(z.any()).optional(),
  validation: z.record(z.any()).optional(),

  // Canvas fields
  course_id: z.string().optional().describe("Canvas course ID"),
  module_name: z.string().optional().describe("Canvas module name"),

  // Citations
  citations: z.array(
    z.object({
      title: z.string(),
      url: z.string(),
      source_id: z.string().optional(),
      excerpt: z.string().optional(),
    })
  ).optional(),

  // SharePoint
  sharepoint_target: z.object({
    site_url: z.string(),
    folder_path: z.string(),
    drive_id: z.string().optional(),
  }).optional(),

  // Output options
  file_name_hint: z.string().optional(),
  include_timestamp_in_filename: z.boolean().optional().default(true),
  include_citations_slide_or_section: z.boolean().optional().default(true),

  // Metadata
  user_id: z.string().optional(),
  course_id_meta: z.string().optional(),
  module_id: z.string().optional(),
  assignment_id: z.string().optional(),
  locale: z.string().optional(),
});

// Output schema
export const outputSchema = z.object({
  success: z.boolean(),
  request_id: z.string().optional(),
  artifact_type: z.string().optional(),
  file_name: z.string().optional(),
  sharepoint_file_url: z.string().optional(),
  local_file_path: z.string().optional(),
  error: z.string().optional(),
});

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

/**
 * Call the Document Generator API
 */
async function callDocumentGenerator(action: string, payload: any): Promise<any> {
  const url = `${SERVICE_BASE_URL}/actions/${action}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Document Generator error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Main execution function
 */
export async function execute(input: Input): Promise<Output> {
  const startTime = Date.now();

  try {
    // Health check short-circuit
    if (input.action === "healthCheck") {
      const res = await fetch(`${SERVICE_BASE_URL}/health`);
      const data = await res.json();
      return {
        success: data.ok === true,
        request_id: `health_${Date.now()}`,
        error: data.ok ? undefined : "Service unhealthy",
      };
    }

    // Build request_meta
    const request_meta = {
      user_id: input.user_id,
      course_id: input.course_id_meta,
      module_id: input.module_id,
      assignment_id: input.assignment_id,
      locale: input.locale,
    };

    // Build output options
    const output = {
      file_name_hint: input.file_name_hint,
      include_timestamp_in_filename: input.include_timestamp_in_filename,
      include_citations_slide_or_section: input.include_citations_slide_or_section,
    };

    // Build citations
    const citations = input.citations || [];

    let payload: any = { request_meta, output, citations };

    switch (input.action) {
      case "generatePhotoCardDeck":
        payload = {
          ...payload,
          title: input.title || "Untitled Deck",
          slide_count: input.slide_count,
          deck_style: input.deck_style,
          key_points: input.key_points || [],
          images: input.images || [],
          audience: "student",
        };
        break;

      case "generateStudyGuide":
        payload = {
          ...payload,
          topic: input.topic || input.title || "Untitled Guide",
          format: input.format,
          length: input.length,
          learning_objectives: input.learning_objectives || [],
          key_terms: input.key_terms || [],
          include_self_check: input.include_self_check,
          examples: input.examples || [],
          audience: "student",
        };
        break;

      case "generateRubricSpreadsheet":
        payload = {
          ...payload,
          template_type: input.template_type || "rubric",
          title: input.title || "Untitled Rubric",
          columns: input.columns || [],
          rows: input.rows || [],
          formulas: input.formulas || {},
          validation: input.validation || {},
        };
        break;

      case "createCanvasModule":
        payload = {
          course_id: input.course_id,
          name: input.module_name || input.title || "New Module",
          request_meta,
        };
        break;

      default:
        return { success: false, error: `Unknown action: ${input.action}` };
    }

    const result = await callSummitCopilot(input.action, payload);

    return {
      success: true,
      request_id: result.request_id,
      artifact_type: result.artifact_type,
      file_name: result.file_name,
      sharepoint_file_url: result.sharepoint_file_url,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Tool registration export
export default {
  ...tool,
  inputs_schema: inputSchema,
  outputs_schema: outputSchema,
  execute,
};
