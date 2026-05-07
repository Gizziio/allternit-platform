export interface ExcelToolDefinition {
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

export const excelTools: ExcelToolDefinition[] = [
  {
    name: "excel_read_range",
    description:
      "Read values and optionally formulas from a cell range or the entire used range of the active sheet.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description:
            "Range address (e.g. 'A1:C10') or the special value 'used' to read the full used range.",
        },
        includeFormulas: {
          type: "boolean",
          description: "If true, also return the raw formula strings for each cell.",
          default: false,
        },
        includeNumberFormat: {
          type: "boolean",
          description: "If true, return the number format string for each cell.",
          default: false,
        },
      },
      required: ["address"],
    },
  },
  {
    name: "excel_write_range",
    description:
      "Write values or formulas to a cell range on the active sheet. Use formulas when the input starts with '='.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Top-left cell address or full range address (e.g. 'B2' or 'B2:D5').",
        },
        values: {
          type: "array",
          description:
            "2D array of values to write. Each inner array is one row. Use formula strings (starting with '=') to write formulas.",
        },
        numberFormat: {
          type: "string",
          description:
            "Optional number format string to apply to the written range (e.g. '$#,##0', '0.0%').",
        },
      },
      required: ["address", "values"],
    },
  },
  {
    name: "excel_get_sheet_names",
    description: "Return the names of all visible worksheets in the active workbook.",
    inputSchema: {
      type: "object",
      properties: {
        includeHidden: {
          type: "boolean",
          description: "If true, also include hidden sheets.",
          default: false,
        },
      },
      required: [],
    },
  },
  {
    name: "excel_create_chart",
    description:
      "Create a chart from a data range on the active sheet. The chart is positioned below the data.",
    inputSchema: {
      type: "object",
      properties: {
        dataAddress: {
          type: "string",
          description:
            "Range address of the source data including headers (e.g. 'A1:C7').",
        },
        chartType: {
          type: "string",
          description: "Excel chart type to create.",
          enum: [
            "columnClustered",
            "barClustered",
            "line",
            "lineMarkers",
            "pie",
            "doughnut",
            "xyscatter",
            "xyscatterSmooth",
            "area",
            "waterfall",
            "histogram",
            "treemap",
            "funnel",
          ],
        },
        title: {
          type: "string",
          description: "Chart title text.",
        },
        seriesBy: {
          type: "string",
          description: "Whether series are in columns or rows of the data range.",
          enum: ["columns", "rows"],
          default: "columns",
        },
      },
      required: ["dataAddress", "chartType", "title"],
    },
  },
  {
    name: "excel_create_table",
    description:
      "Convert a range into an Excel table (ListObject) with optional name and style.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description:
            "Range address including headers (e.g. 'A1:D50'). Use 'used' to convert the full used range.",
        },
        tableName: {
          type: "string",
          description:
            "Name for the table. Must be unique within the workbook. Defaults to 'Table1' if omitted.",
        },
        style: {
          type: "string",
          description: "Table style name.",
          default: "TableStyleMedium2",
        },
        hasHeaders: {
          type: "boolean",
          description: "Whether the first row of the range is a header row.",
          default: true,
        },
      },
      required: ["address"],
    },
  },
  {
    name: "excel_apply_format",
    description:
      "Apply number formatting, font color, or fill color to a cell range.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Range address to format (e.g. 'B2:B100').",
        },
        numberFormat: {
          type: "string",
          description:
            "Number format string (e.g. '$#,##0', '0.0%', '0.0x', 'mmm-yy'). Omit to leave unchanged.",
        },
        fontColor: {
          type: "string",
          description:
            "Hex color for font (e.g. '#0070C0' for blue inputs, '#00B050' for green links). Omit to leave unchanged.",
        },
        fillColor: {
          type: "string",
          description:
            "Hex color for cell background (e.g. '#F5EDE3'). Omit to leave unchanged.",
        },
        bold: {
          type: "boolean",
          description: "Set font bold. Omit to leave unchanged.",
        },
        autofitColumns: {
          type: "boolean",
          description: "Auto-fit column widths after formatting.",
          default: false,
        },
      },
      required: ["address"],
    },
  },
  {
    name: "excel_add_data_validation",
    description:
      "Add data validation to a cell range — dropdown list, number range, date range, or custom formula.",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Range address to apply validation to (e.g. 'B2:B100').",
        },
        type: {
          type: "string",
          description: "Validation type.",
          enum: ["list", "wholeNumber", "decimal", "date", "textLength", "custom"],
        },
        listSource: {
          type: "string",
          description:
            "For type 'list': comma-separated values (e.g. 'Active,Inactive,Pending') or a range reference (e.g. '=Sheet2!$A$1:$A$5').",
        },
        formula1: {
          type: "string",
          description: "First formula/value for number, date, or text-length validation.",
        },
        formula2: {
          type: "string",
          description: "Second formula/value for 'between' operator validations.",
        },
        operator: {
          type: "string",
          description: "Comparison operator for non-list types.",
          enum: [
            "between",
            "notBetween",
            "equalTo",
            "notEqualTo",
            "greaterThan",
            "lessThan",
            "greaterThanOrEqualTo",
            "lessThanOrEqualTo",
          ],
        },
        errorTitle: {
          type: "string",
          description: "Title for the error alert dialog.",
          default: "Invalid Entry",
        },
        errorMessage: {
          type: "string",
          description: "Body text for the error alert dialog.",
        },
        alertStyle: {
          type: "string",
          description: "Error alert style.",
          enum: ["stop", "warning", "information"],
          default: "stop",
        },
      },
      required: ["address", "type"],
    },
  },
  {
    name: "excel_run_formula",
    description:
      "Evaluate a formula expression by writing it to a temporary cell, reading the result, and cleaning up. Returns the computed value.",
    inputSchema: {
      type: "object",
      properties: {
        formula: {
          type: "string",
          description:
            "Formula string starting with '=' (e.g. '=SUM(A1:A10)', '=XLOOKUP(\"Apple\",A:A,B:B)').",
        },
        tempAddress: {
          type: "string",
          description:
            "Temporary cell to use for evaluation (defaults to a cell far from data, e.g. 'Z1').",
          default: "Z1",
        },
      },
      required: ["formula"],
    },
  },
  {
    name: "excel_add_worksheet",
    description: "Add a new worksheet to the workbook with a given name and optional tab color.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name for the new worksheet (max 31 characters, no special characters).",
        },
        position: {
          type: "number",
          description:
            "0-based position for the new sheet tab. Omit to append at end.",
        },
        tabColor: {
          type: "string",
          description: "Hex color for the sheet tab (e.g. '#B08D6E').",
        },
        activate: {
          type: "boolean",
          description: "If true, navigate to the new sheet after creating it.",
          default: true,
        },
      },
      required: ["name"],
    },
  },
  {
    name: "excel_delete_rows",
    description:
      "Delete rows from the active sheet matching a condition: blank rows, rows where a column equals a value, or rows containing duplicates.",
    inputSchema: {
      type: "object",
      properties: {
        condition: {
          type: "string",
          description: "Deletion condition type.",
          enum: ["blank", "duplicate", "valueMatch"],
        },
        columnIndex: {
          type: "number",
          description:
            "0-based column index to check for 'valueMatch' or 'duplicate' conditions. Omit for 'blank' (checks entire row).",
        },
        matchValue: {
          type: "string",
          description: "Value to match for 'valueMatch' condition (exact string match).",
        },
        startRow: {
          type: "number",
          description:
            "0-based row index to start scanning from. Use 1 to skip the header row.",
          default: 1,
        },
      },
      required: ["condition"],
    },
  },
];

export default excelTools;
