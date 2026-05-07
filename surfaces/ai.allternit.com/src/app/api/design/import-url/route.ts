/**
 * /api/design/import-url
 *
 * Fetches a public URL server-side (bypasses CORS), extracts CSS design tokens
 * — custom properties, font-family, border-radius, color palette — and returns
 * a partial DesignSystem record the client can review before saving.
 */

import { NextRequest, NextResponse } from "next/server";

interface ImportedDesign {
  name: string;
  description: string;
  vibe: string;
  author: string;
  tags: string[];
  previewColors: string[];
  designMd: string;
  sourceUrl: string;
}

interface ImportResult {
  ok: boolean;
  design?: ImportedDesign;
  error?: string;
}

// Hex or rgb(a) color regex
const COLOR_RE = /#[0-9a-fA-F]{3,8}|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+[^)]*\)/g;

// CSS custom property declarations: --name: value;
const CSS_VAR_RE = /--([\w-]+)\s*:\s*([^;}\n]+)/g;

// font-family declarations
const FONT_RE = /font-family\s*:\s*([^;}\n]+)/gi;

// border-radius declarations
const RADIUS_RE = /border-radius\s*:\s*([^;}\n]+)/gi;

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function uniqueColors(colors: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of colors) {
    const key = c.toLowerCase().replace(/\s/g, "");
    if (!seen.has(key) && result.length < 4) { seen.add(key); result.push(c); }
  }
  return result;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
}

function inferVibe(vars: Record<string, string>, colors: string[]): string {
  const vals = Object.values(vars).join(" ").toLowerCase();
  const dark = colors.some(c => {
    const hex = c.replace("#", "");
    if (hex.length === 3) { const r = parseInt(hex[0]+hex[0],16); return r < 80; }
    if (hex.length >= 6) { const r = parseInt(hex.slice(0,2),16); return r < 80; }
    return false;
  });
  if (vals.includes("purple") || vals.includes("indigo")) return "Purple Precision";
  if (vals.includes("green") || vals.includes("emerald")) return "Growth & Nature";
  if (vals.includes("orange") || vals.includes("amber")) return "Warm Energy";
  if (dark) return "Dark Professional";
  return "Clean & Modern";
}

function inferTags(vars: Record<string, string>, fonts: string[], colors: string[]): string[] {
  const tags: string[] = [];
  const allText = [...Object.keys(vars), ...Object.values(vars), ...fonts].join(" ").toLowerCase();

  const dark = colors.some(c => {
    const hex = c.replace("#", "");
    if (hex.length >= 6) return parseInt(hex.slice(0,2),16) < 80;
    return false;
  });
  if (dark) tags.push("dark"); else tags.push("clean");

  if (allText.includes("blur") || allText.includes("glass")) tags.push("glassmorphism");
  if (allText.includes("mono") || allText.includes("jetbrains") || allText.includes("geist mono")) tags.push("developer");
  if (allText.includes("gradient")) tags.push("gradient");
  if (allText.includes("serif") || allText.includes("display")) tags.push("editorial");
  if (allText.includes("sans") && !tags.includes("developer")) tags.push("minimalist");

  return tags.slice(0, 5);
}

function buildDesignMd(
  domain: string,
  vars: Record<string, string>,
  fonts: string[],
  radii: string[],
  colors: string[],
  sourceUrl: string,
): string {
  const primary = vars["color-primary"] ?? vars["primary"] ?? vars["accent"] ?? vars["brand"] ?? colors[1] ?? "#000";
  const bg = vars["background"] ?? vars["bg"] ?? vars["color-bg"] ?? vars["bg-primary"] ?? colors[0] ?? "#fff";
  const surface = vars["surface"] ?? vars["color-surface"] ?? vars["bg-secondary"] ?? colors[2] ?? bg;
  const text = vars["text"] ?? vars["color-text"] ?? vars["text-primary"] ?? vars["foreground"] ?? "#000";
  const font = fonts[0] ?? "Inter, system-ui";
  const radius = radii[0] ?? "8px";

  const varBlock = Object.entries(vars)
    .slice(0, 12)
    .map(([k, v]) => `- --${k}: ${v.trim()}`)
    .join("\n");

  return `# Brand: ${domain}
## Intent
Imported from ${sourceUrl}
## Colors
- primary: ${primary}
- background: ${bg}
- surface: ${surface}
- text: ${text}
## Typography
- fontFamily: "${font}"
## Radii
- base: ${radius}
## Raw CSS Variables
${varBlock}
  `.trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  let url: string;
  try {
    const body = await req.json() as { url?: string };
    url = (body.url ?? "").trim();
  } catch {
    return NextResponse.json<ImportResult>({ ok: false, error: "Invalid request body" }, { status: 400 });
  }

  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json<ImportResult>({ ok: false, error: "A valid http/https URL is required" }, { status: 400 });
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AllternitBot/1.0; +https://allternit.com)" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return NextResponse.json<ImportResult>({ ok: false, error: `Remote returned ${res.status}` }, { status: 422 });
    }
    html = await res.text();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json<ImportResult>({ ok: false, error: msg }, { status: 422 });
  }

  // Extract all <style> blocks + inline style attributes
  const styleBlocks: string[] = [];
  const styleTagRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m: RegExpExecArray | null;
  while ((m = styleTagRe.exec(html)) !== null) styleBlocks.push(m[1]);

  // Also grab linked stylesheet hrefs for potential follow-up (skip external for now)
  const allCss = styleBlocks.join("\n");

  // Parse CSS custom properties
  const vars: Record<string, string> = {};
  CSS_VAR_RE.lastIndex = 0;
  while ((m = CSS_VAR_RE.exec(allCss)) !== null) {
    const name = m[1].toLowerCase();
    const val = m[2].trim();
    // Only keep likely design tokens (not layout/animation vars)
    if (val && !val.includes("calc(") && !val.includes("var(") && val.length < 40) {
      vars[name] = val;
    }
  }

  // Colors
  const rawColors = allCss.match(COLOR_RE) ?? [];
  const htmlColors = html.match(COLOR_RE) ?? [];
  const colors = uniqueColors([...rawColors, ...htmlColors]);

  // Fonts
  const fonts: string[] = [];
  FONT_RE.lastIndex = 0;
  while ((m = FONT_RE.exec(allCss)) !== null) {
    const f = m[1].trim().replace(/['"]/g, "");
    if (!fonts.includes(f)) fonts.push(f);
  }

  // Radii
  const radii: string[] = [];
  RADIUS_RE.lastIndex = 0;
  while ((m = RADIUS_RE.exec(allCss)) !== null) {
    const r = m[1].trim();
    if (!radii.includes(r) && /^\d/.test(r)) radii.push(r);
  }

  // Meta: og:title, og:site_name, theme-color
  const ogTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  const siteName = /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  const themeColor = /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i.exec(html)?.[1];
  const pageTitle = /<title>([^<]+)<\/title>/i.exec(html)?.[1]?.replace(/\s*[|\-–].*/,"").trim();

  const domain = extractDomain(url);
  const name = siteName ?? ogTitle ?? pageTitle ?? domain;

  if (themeColor && !colors.includes(themeColor)) colors.unshift(themeColor);

  const preview = colors.slice(0, 3).length >= 1 ? colors.slice(0, 3) : ["#ffffff", "#000000", "#f4f4f4"];
  const vibe = inferVibe(vars, colors);
  const tags = inferTags(vars, fonts, colors);
  const designMd = buildDesignMd(domain, vars, fonts, radii, colors, url);

  const design: ImportedDesign = {
    name,
    description: `Imported from ${domain}`,
    vibe,
    author: domain,
    tags,
    previewColors: preview,
    designMd,
    sourceUrl: url,
  };

  return NextResponse.json<ImportResult>({ ok: true, design });
}
