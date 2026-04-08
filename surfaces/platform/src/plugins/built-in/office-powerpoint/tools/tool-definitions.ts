export interface PowerPointToolDefinition {
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

export const powerpointTools: PowerPointToolDefinition[] = [
  {
    name: "ppt_get_slide_count",
    description: "Return the total number of slides in the current presentation.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "ppt_read_slide_text",
    description:
      "Read all text content from a slide at the given 0-based index. Returns an array of shapes with their names and text.",
    inputSchema: {
      type: "object",
      properties: {
        slideIndex: {
          type: "number",
          description: "0-based index of the slide to read (0 = first slide).",
        },
      },
      required: ["slideIndex"],
    },
  },
  {
    name: "ppt_write_slide_text",
    description:
      "Write title and/or body text to a slide at the given 0-based index. Finds existing title/content placeholder shapes and updates their text.",
    inputSchema: {
      type: "object",
      properties: {
        slideIndex: {
          type: "number",
          description: "0-based index of the target slide.",
        },
        title: {
          type: "string",
          description: "Text for the title shape. Omit to leave the title unchanged.",
        },
        body: {
          type: "string",
          description:
            "Text for the content/body shape. Use newlines for bullet points. Omit to leave unchanged.",
        },
      },
      required: ["slideIndex"],
    },
  },
  {
    name: "ppt_add_slide",
    description:
      "Add a new blank slide to the end of the presentation. Optionally populate it with a title and body text.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Optional title text for the new slide.",
        },
        body: {
          type: "string",
          description: "Optional body/content text for the new slide.",
        },
      },
      required: [],
    },
  },
  {
    name: "ppt_delete_slide",
    description:
      "Delete the slide at the given 0-based index. The presentation must have more than one slide.",
    inputSchema: {
      type: "object",
      properties: {
        slideIndex: {
          type: "number",
          description: "0-based index of the slide to delete.",
        },
      },
      required: ["slideIndex"],
    },
  },
  {
    name: "ppt_read_all_titles",
    description:
      "Read the title text from every slide in the presentation. Returns an array of { index, title } objects.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "ppt_set_notes",
    description: "Set the speaker notes for a slide at the given 0-based index.",
    inputSchema: {
      type: "object",
      properties: {
        slideIndex: {
          type: "number",
          description: "0-based index of the target slide.",
        },
        notes: {
          type: "string",
          description: "Speaker notes text to write. Use empty string to clear existing notes.",
        },
      },
      required: ["slideIndex", "notes"],
    },
  },
  {
    name: "ppt_read_notes",
    description:
      "Read the speaker notes from a slide, or from all slides if no index is provided.",
    inputSchema: {
      type: "object",
      properties: {
        slideIndex: {
          type: "number",
          description:
            "0-based index of the slide to read notes from. Omit to read all slides.",
        },
      },
      required: [],
    },
  },
  {
    name: "ppt_add_textbox",
    description:
      "Add a positioned text box to a slide at the given 0-based index. Position and size are in points (Widescreen slide = 960×540pt).",
    inputSchema: {
      type: "object",
      properties: {
        slideIndex: {
          type: "number",
          description: "0-based index of the target slide.",
        },
        text: {
          type: "string",
          description: "Text content for the text box.",
        },
        left: {
          type: "number",
          description: "Left edge position in points from the left of the slide.",
          default: 60,
        },
        top: {
          type: "number",
          description: "Top edge position in points from the top of the slide.",
          default: 140,
        },
        width: {
          type: "number",
          description: "Width of the text box in points.",
          default: 840,
        },
        height: {
          type: "number",
          description: "Height of the text box in points.",
          default: 300,
        },
      },
      required: ["slideIndex", "text"],
    },
  },
];

export default powerpointTools;
