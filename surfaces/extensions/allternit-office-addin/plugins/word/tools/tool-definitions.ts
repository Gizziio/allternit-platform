export interface WordToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      default?: unknown;
    }>;
    required: string[];
  };
}

export const wordTools: WordToolDefinition[] = [
  {
    name: "word_read_body",
    description:
      "Read the full text content of the active Word document. For large documents (>5000 words), returns the first 2000 characters plus an outline of headings.",
    inputSchema: {
      type: "object",
      properties: {
        fullText: {
          type: "boolean",
          description: "If true, return the complete body text regardless of length. Use with caution for large documents.",
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: "word_read_selection",
    description:
      "Read the currently selected text in the document. Returns empty string if nothing is selected (cursor only).",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "word_insert_text",
    description:
      "Insert text at the cursor position or replace the current selection. Use InsertLocation to control placement.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to insert. Use \\n for paragraph breaks.",
        },
        location: {
          type: "string",
          description: "Where to insert relative to the current selection or cursor.",
          enum: ["replace", "before", "after", "start", "end"],
          default: "end",
        },
        style: {
          type: "string",
          description: "Optional paragraph style to apply (e.g. 'Heading 1', 'Normal', 'Quote').",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "word_replace_text",
    description:
      "Find a specific text string in the document and replace it with new text. Replaces only the first match by default.",
    inputSchema: {
      type: "object",
      properties: {
        searchText: {
          type: "string",
          description: "Exact text to search for.",
        },
        replacementText: {
          type: "string",
          description: "Text to replace the match with.",
        },
        matchCase: {
          type: "boolean",
          description: "Whether the search is case-sensitive.",
          default: false,
        },
        replaceAll: {
          type: "boolean",
          description: "If true, replace all occurrences. If false, replace only the first.",
          default: false,
        },
        useTrackedChanges: {
          type: "boolean",
          description: "If true, enable Track Changes before replacing so the edit is visible as a tracked change.",
          default: true,
        },
      },
      required: ["searchText", "replacementText"],
    },
  },
  {
    name: "word_get_document_outline",
    description:
      "Return the heading structure of the document as a hierarchical outline (H1–H4 headings only).",
    inputSchema: {
      type: "object",
      properties: {
        maxLevel: {
          type: "number",
          description: "Maximum heading depth to include (1–4).",
          default: 3,
        },
      },
      required: [],
    },
  },
  {
    name: "word_get_document_properties",
    description:
      "Return document metadata: title, author, word count, character count, last save time.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "word_insert_table",
    description:
      "Insert a table into the document at the cursor or end of document. Provide data as a 2D string array where the first row is the header row.",
    inputSchema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description:
            "2D string array — outer array = rows, inner array = cells. First row is the header row. All values must be strings.",
        },
        style: {
          type: "string",
          description: "Word table style to apply.",
          default: "Light List Accent 1",
        },
        location: {
          type: "string",
          description: "Where to insert the table.",
          enum: ["end", "start", "after_selection"],
          default: "end",
        },
      },
      required: ["data"],
    },
  },
  {
    name: "word_set_track_changes",
    description:
      "Enable or disable tracked changes (revision marks) on the document.",
    inputSchema: {
      type: "object",
      properties: {
        enabled: {
          type: "boolean",
          description: "True to enable track changes (trackAll mode), false to turn off.",
        },
      },
      required: ["enabled"],
    },
  },
  {
    name: "word_get_content_controls",
    description:
      "List all content controls in the document with their tags, titles, and current text values.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "word_fill_content_control",
    description:
      "Set the text value of a content control identified by its tag or title.",
    inputSchema: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "The developer tag of the content control to fill.",
        },
        title: {
          type: "string",
          description: "The title of the content control (used if tag is not found).",
        },
        value: {
          type: "string",
          description: "The text value to insert into the content control.",
        },
      },
      required: ["value"],
    },
  },
];

export default wordTools;
