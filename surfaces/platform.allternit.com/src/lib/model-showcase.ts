import type { CatalogModel } from "@/lib/model-catalog";

export type ModelMarkKind = "constellation" | "cursor" | "orbit" | "wing";

export interface ModelCardInfo {
  id: string;
  name: string;
  isNew?: boolean;
  tagline: string;
  tags: string[];
  banner: string;
  ink: string;
  mark: ModelMarkKind;
  cost: {
    input: string;
    output: string;
    cacheWrite: string;
    cacheRead: string;
    fastInput: string;
    fastOutput: string;
  };
  features: {
    context: string;
    maxOutput: string;
    speed: string;
    provider: string;
  };
}

const BANNERS: Array<{ bg: string; ink: string }> = [
  { bg: "#8FB4EE", ink: "#1C2B45" },
  { bg: "#E8A583", ink: "#43231A" },
  { bg: "#F2EFE6", ink: "#33302A" },
  { bg: "#CBDCC9", ink: "#24331F" },
];

const TAGLINES: Record<string, string> = {
  Claude: "Agentic coding and reasoning through Allternit Cloud.",
  GPT: "General-purpose frontier model through Allternit Cloud.",
  Gemini: "Long-context model through Allternit Cloud.",
  Llama: "Open-weight model for flexible deployments.",
  DeepSeek: "Open-weight reasoning model.",
  Qwen: "Open-weight multilingual model.",
  Mistral: "Efficient open-weight model.",
  Mixtral: "Sparse open-weight model.",
  Kimi: "Long-context agent model.",
  GLM: "Open-weight general model.",
};

const markByFamily = (family: string): ModelMarkKind => {
  const kinds: ModelMarkKind[] = ["constellation", "cursor", "orbit", "wing"];
  let hash = 0;
  for (let i = 0; i < family.length; i += 1) hash = (hash * 31 + family.charCodeAt(i)) >>> 0;
  return kinds[hash % kinds.length];
};

function parsePricePerMillion(price: string): number | null {
  const match = /^\$([\d.]+)/.exec(price);
  return match ? Number(match[1]) : null;
}

function isFree(model: CatalogModel): boolean {
  return parsePricePerMillion(model.inputPrice) === 0 && parsePricePerMillion(model.outputPrice) === 0;
}

/**
 * Pick the models that get showcase cards: up to two per family (local engine
 * first for local families), preserving catalog order, capped at 8.
 */
export function pickFeaturedModels(models: CatalogModel[], limit = 8): CatalogModel[] {
  const perFamily = new Map<string, number>();
  const picked: CatalogModel[] = [];
  for (const model of models) {
    const used = perFamily.get(model.family) ?? 0;
    if (used >= 2) continue;
    perFamily.set(model.family, used + 1);
    picked.push(model);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function toModelCardInfo(
  model: CatalogModel,
  all: CatalogModel[],
  bannerIndex: number,
): ModelCardInfo {
  const banner = BANNERS[bannerIndex % BANNERS.length];
  const provider = model.upstreamProvider || (model.provider === "local" ? "local" : "cloud");

  const lowestInput = Math.min(
    ...all.map((m) => parsePricePerMillion(m.inputPrice) ?? Number.POSITIVE_INFINITY),
  );
  const inputPrice = parsePricePerMillion(model.inputPrice);

  const tags: string[] = [];
  if (model.provider === "local") tags.push("Local");
  if (inputPrice !== null && inputPrice === lowestInput && !isFree(model)) tags.push("Lowest cost");
  if (isFree(model)) tags.push("Included");
  if (model.context === "1M" || model.context === "1.0M") tags.push("1M context");

  return {
    id: model.id,
    name: model.name,
    tagline: TAGLINES[model.family] || "Available through Allternit Cloud.",
    tags,
    banner: banner.bg,
    ink: banner.ink,
    mark: markByFamily(model.family),
    cost: {
      input: model.inputPrice,
      output: model.outputPrice,
      cacheWrite: "—",
      cacheRead: "—",
      fastInput: "—",
      fastOutput: "—",
    },
    features: {
      context: model.context === "—" ? "—" : `${model.context} tok`,
      maxOutput: "—",
      speed: "—",
      provider,
    },
  };
}

export function buildModelCards(models: CatalogModel[]): ModelCardInfo[] {
  const featured = pickFeaturedModels(models);
  return featured.map((model, index) => toModelCardInfo(model, featured, index));
}
