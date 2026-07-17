/**
 * report — post-simulation synthesis.
 *
 * The lite version of upstream MiroFish's ReportAgent / amadad's
 * verdict.json: one model call over the personas and round summaries that
 * turns raw round logs into an executive summary, risk signals, narrative
 * paths, and a confidence grade. Failure is never fatal — the run's raw data
 * still renders without a report.
 */

import { generateText } from "ai";

import { getDefaultPluginModel } from "@/lib/ai/providers";
import { createModuleLogger } from '@/lib/logger';

import { modelCallSignal } from "./model-call";
import type { SimulationReport, WorldState } from "./types";

const logger = createModuleLogger('MiroFish');

const MAX_SEED_CHARS = 1500;
const MAX_BIO_CHARS = 120;
const REPORT_MAX_OUTPUT_TOKENS = 900;

const CONFIDENCE_LEVELS = new Set(["low", "medium", "high"]);

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function buildReportPrompt(world: WorldState): string {
  const personaLines = world.personas
    .map((p) => `- ${p.name}: ${truncate(p.bio, MAX_BIO_CHARS)}`)
    .join("\n");
  const roundLines = world.roundSummaries
    .map((r) => `Round ${r.round} (${r.agentsActed}/${r.agentsTotal} agents acted): ${r.summary}`)
    .join("\n");

  return `You are analyzing a completed multi-agent population simulation.

Seed material (${world.seed.kind}):
"""
${truncate(world.seed.text, MAX_SEED_CHARS)}
"""

Simulated population:
${personaLines}

What happened, round by round:
${roundLines}

Synthesize the simulation into a prediction report. Respond with JSON only, no prose, no markdown fences:
{
  "executiveSummary": "3-5 sentences: the likely outcome and the dominant crowd reaction",
  "riskSignals": ["up to 5 short warning signs worth watching"],
  "narrativePaths": ["up to 4 short descriptions of the distinct reaction paths the crowd took"],
  "confidence": "low|medium|high — how much signal this small simulation actually provides"
}`;
}

function parseReport(text: string): SimulationReport | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    if (typeof raw.executiveSummary !== "string" || !raw.executiveSummary.trim()) return null;

    const toStringList = (value: unknown, max: number): string[] =>
      (Array.isArray(value) ? value : [])
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, max)
        .map((item) => item.trim());

    return {
      executiveSummary: raw.executiveSummary.trim(),
      riskSignals: toStringList(raw.riskSignals, 5),
      narrativePaths: toStringList(raw.narrativePaths, 4),
      confidence: CONFIDENCE_LEVELS.has(String(raw.confidence))
        ? (raw.confidence as SimulationReport["confidence"])
        : "low",
    };
  } catch {
    return null;
  }
}

export interface GenerateReportOptions {
  signal?: AbortSignal;
}

/**
 * One synthesis call over the finished world. Returns `null` on failure —
 * the caller keeps the raw round data either way. A caller-initiated abort
 * still propagates (cancellation is not a failure).
 */
export async function generateSimulationReport(
  world: WorldState,
  options: GenerateReportOptions = {}
): Promise<SimulationReport | null> {
  try {
    const model = await getDefaultPluginModel();
    const { text } = await generateText({
      model,
      prompt: buildReportPrompt(world),
      temperature: 0.4,
      maxOutputTokens: REPORT_MAX_OUTPUT_TOKENS,
      abortSignal: modelCallSignal(options.signal),
    });

    const parsed = parseReport(text);
    if (parsed) return parsed;

    // Unparseable but non-empty output still beats no report: use it as the
    // summary with an explicit low confidence.
    const cleaned = text.replace(/[{}"[\]]/g, " ").replace(/\s+/g, " ").trim();
    if (cleaned) {
      logger.warn({ sample: text.slice(0, 120) }, "Report response unparseable — using raw text as summary");
      return {
        executiveSummary: truncate(cleaned, 800),
        riskSignals: [],
        narrativePaths: [],
        confidence: "low",
      };
    }
    return null;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    logger.warn({ error }, "Report generation failed — run keeps its raw round data");
    return null;
  }
}
