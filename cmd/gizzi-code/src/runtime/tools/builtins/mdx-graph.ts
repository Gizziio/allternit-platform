import z from "zod/v4"
import { Tool } from "@/runtime/tools/builtins/tool"

const DESCRIPTION = `Generate an mdx-graphs JSX snippet for an .mdx file.

Use this tool whenever you want to include a text/ASCII chart (bars, rank, meter, table, timeline, sparkline, etc.) in a Markdown file. The tool validates the data shape and returns a correctly-formatted JSX component that the Allternit platform can render.

After receiving the snippet, embed it in the .mdx file with the surrounding Markdown you need. Do NOT use mdx-graphs components in plain .md files — only .mdx.`

const paletteSchema = z.enum(["mono", "duo", "multi"]).optional().describe("Color palette for the graph. Defaults to mono.")
const cornerSchema = z.string().optional().describe("Optional corner label shown on the graph frame.")

const baseSchema = z.object({
  title: z.string().describe("Title shown at the top of the graph."),
  palette: paletteSchema,
  corner: cornerSchema,
})

const barSeriesSchema = z.object({
  label: z.string(),
  values: z.array(z.number()),
  size: z.enum(["sm", "lg"]).optional(),
})

const barsSchema = baseSchema.merge(z.object({
  graphType: z.literal("bars"),
  from: barSeriesSchema.describe("The first bar series (left side)."),
  to: barSeriesSchema.describe("The second bar series (right side)."),
  processor: z.string().optional().describe("Optional label between the two series (e.g. '+120%')."),
}))

const rankItemSchema = z.object({
  label: z.string(),
  value: z.number(),
  display: z.string().optional().describe("Optional formatted value to show (e.g. '$1.2M')."),
})

const rankSchema = baseSchema.merge(z.object({
  graphType: z.literal("rank"),
  items: z.array(rankItemSchema).describe("Items to rank from largest to smallest."),
  max: z.number().optional().describe("Optional scale maximum; defaults to the largest item value."),
  ticks: z.number().int().min(1).optional().describe("Number of bar characters; defaults to 20."),
}))

const meterSchema = baseSchema.merge(z.object({
  graphType: z.literal("meter"),
  value: z.number().min(0).max(1).describe("Progress as a fraction between 0 and 1."),
  ticks: z.number().int().min(1).optional().describe("Number of meter characters; defaults to 14."),
  caption: z.string().optional().describe("Optional caption shown below the meter."),
}))

const tableSchema = z.object({
  graphType: z.literal("table"),
  title: z.string().describe("Title shown at the top of the table."),
  headers: z.array(z.string()).describe("Column headers."),
  rows: z.array(z.array(z.union([z.string(), z.number()]))).describe("Table body rows."),
  footer: z.array(z.union([z.string(), z.number()])).optional().describe("Optional footer row."),
  align: z.array(z.enum(["left", "right"])).optional().describe("Per-column alignment; defaults to left for first column, right for others."),
  corner: cornerSchema,
})

const timelineEventSchema = z.object({
  date: z.string(),
  label: z.string(),
  state: z.enum(["done", "now", "next"]).optional().describe("State of the event; defaults to done."),
})

const timelineSchema = baseSchema.merge(z.object({
  graphType: z.literal("timeline"),
  events: z.array(timelineEventSchema).describe("Events in chronological order."),
}))

const sparkSchema = baseSchema.merge(z.object({
  graphType: z.literal("spark"),
  data: z.array(z.number()).describe("Numeric values for the sparkline."),
  caption: z.string().optional().describe("Optional caption shown below the sparkline."),
}))

const parameters = z.discriminatedUnion("graphType", [
  barsSchema,
  rankSchema,
  meterSchema,
  tableSchema,
  timelineSchema,
  sparkSchema,
])

function jsxString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n")}"`
}

function prop(name: string, value: unknown): string {
  if (value === undefined || value === null) return ""
  if (typeof value === "string") return `${name}=${jsxString(value)}`
  return `${name}={${JSON.stringify(value)}}`
}

function props(entries: Record<string, unknown>): string {
  return Object.entries(entries)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => prop(k, v))
    .join("\n  ")
}

export const MdxGraphTool = Tool.define("mdx_graph", {
  description: DESCRIPTION,
  parameters,
  async execute(params) {
    let component: string

    switch (params.graphType) {
      case "bars": {
        component = `<GraphBars
  ${props({
    title: params.title,
    from: params.from,
    to: params.to,
    processor: params.processor,
    palette: params.palette,
    corner: params.corner,
  })}
/>`
        break
      }
      case "rank": {
        component = `<GraphRank
  ${props({
    title: params.title,
    items: params.items,
    max: params.max,
    ticks: params.ticks,
    palette: params.palette,
    corner: params.corner,
  })}
/>`
        break
      }
      case "meter": {
        component = `<GraphMeter
  ${props({
    title: params.title,
    value: params.value,
    ticks: params.ticks,
    caption: params.caption,
    palette: params.palette,
    corner: params.corner,
  })}
/>`
        break
      }
      case "table": {
        component = `<GraphTable
  ${props({
    title: params.title,
    headers: params.headers,
    rows: params.rows,
    footer: params.footer,
    align: params.align,
    corner: params.corner,
  })}
/>`
        break
      }
      case "timeline": {
        component = `<GraphTimeline
  ${props({
    title: params.title,
    events: params.events,
    palette: params.palette,
    corner: params.corner,
  })}
/>`
        break
      }
      case "spark": {
        component = `<GraphSpark
  ${props({
    title: params.title,
    data: params.data,
    caption: params.caption,
    palette: params.palette,
    corner: params.corner,
  })}
/>`
        break
      }
      default: {
        const _exhaustive: never = params
        throw new Error(`Unsupported graphType: ${(_exhaustive as any)?.graphType}`)
      }
    }

    return {
      title: `mdx-graph: ${params.graphType}`,
      output: [
        "Embed this snippet in an `.mdx` file (imports are automatic):",
        "",
        component,
      ].join("\n"),
      metadata: {
        graphType: params.graphType,
        title: params.title,
      },
    }
  },
})
