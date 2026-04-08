/**
 * Chrome Extension Tool Definitions
 *
 * These tools are available to the Allternit Chrome extension agent.
 * They are injected into the AI context when the sidebar is active.
 * Each tool maps to a capability exposed by the extension's background
 * service worker via chrome.runtime.sendMessage.
 */

export interface ChromeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const CHROME_TOOLS: ChromeTool[] = [
  {
    name: 'get_page_content',
    description:
      'Read the full content of the active browser tab: title, URL, extracted body text, metadata, and all visible links.',
    input_schema: {
      type: 'object',
      properties: {
        include_links: {
          type: 'boolean',
          description: 'Whether to include all hyperlinks from the page. Default true.',
        },
        include_meta: {
          type: 'boolean',
          description: 'Whether to include Open Graph and meta tag data. Default true.',
        },
        selection_only: {
          type: 'boolean',
          description:
            'If true, return only the text the user has highlighted. Default false.',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_page_screenshot',
    description: 'Capture a screenshot of the visible area of the current tab.',
    input_schema: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'A label for the screenshot artifact (e.g. "before-state", "after-state").',
        },
      },
      required: ['label'],
    },
  },
  {
    name: 'click_element',
    description:
      'Click an element on the current page. REQUIRES user approval before execution. Use only within approved automation flows.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the element to click.',
        },
        description: {
          type: 'string',
          description: 'Human-readable description of what this click does (shown to user for approval).',
        },
        is_destructive: {
          type: 'boolean',
          description:
            'Whether this click submits data, sends a message, or mutates server-side state. Default false.',
        },
      },
      required: ['selector', 'description'],
    },
  },
  {
    name: 'fill_input',
    description:
      'Type text into an input field on the current page. REQUIRES user approval if the field is part of a form that will be submitted.',
    input_schema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector for the input element.',
        },
        value: {
          type: 'string',
          description: 'Text to type into the field.',
        },
        clear_first: {
          type: 'boolean',
          description: 'Whether to clear the field before typing. Default true.',
        },
      },
      required: ['selector', 'value'],
    },
  },
  {
    name: 'extract_structured_data',
    description:
      'Extract structured data from the page using a schema. Returns tables, lists, contacts, prices, or custom entity types.',
    input_schema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['tables', 'lists', 'contacts', 'prices', 'dates', 'custom'],
          description: 'Type of data to extract.',
        },
        selector: {
          type: 'string',
          description:
            'Optional CSS selector to scope extraction to a specific section of the page.',
        },
        custom_schema: {
          type: 'object',
          description:
            'For target="custom": a JSON schema describing the entity to extract.',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'copy_to_clipboard',
    description: 'Copy text to the user\'s clipboard.',
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The text to copy.',
        },
        format: {
          type: 'string',
          enum: ['markdown', 'plaintext', 'json'],
          description: 'Format hint for the content. Default: markdown.',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'open_tab',
    description: 'Open a URL in a new browser tab.',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to open.',
        },
        background: {
          type: 'boolean',
          description: 'Open in background without switching focus. Default false.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'save_to_storage',
    description:
      'Save a key-value pair to extension storage. Used for persisting user preferences, session context, or extracted data across tabs.',
    input_schema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Storage key.',
        },
        value: {
          type: 'string',
          description: 'Value to store (JSON-serialized if object).',
        },
      },
      required: ['key', 'value'],
    },
  },
];
