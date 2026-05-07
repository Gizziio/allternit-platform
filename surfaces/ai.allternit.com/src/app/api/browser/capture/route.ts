import { NextRequest, NextResponse } from "next/server";

interface FigmaNode {
  type: string;
  name: string;
  children?: FigmaNode[];
  [key: string]: unknown;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((ch) => ch + ch).join("");
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

function parseHtmlToFigma(html: string, url: string): FigmaNode {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || "Untitled Page";

  // Extract meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i)
    || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["'][^>]*>/i);
  const description = descMatch?.[1]?.trim() || "";

  // Extract main colors from style tags
  const colors = new Set<string>();
  const colorMatches = html.matchAll(/#[0-9a-fA-F]{3,8}/g);
  for (const m of colorMatches) {
    if (colors.size < 20) colors.add(m[0].toLowerCase());
  }

  // Extract images
  const images: string[] = [];
  const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi);
  for (const m of imgMatches) {
    if (images.length < 10) {
      let src = m[1];
      if (src.startsWith("/")) {
        try { src = new URL(src, url).href; } catch {}
      }
      images.push(src);
    }
  }

  // Extract headings for structure
  const headings: { level: number; text: string }[] = [];
  const hMatches = html.matchAll(/<h([1-6])[^>]*>([^<]*)<\/h\1>/gi);
  for (const m of hMatches) {
    if (headings.length < 15) {
      headings.push({ level: parseInt(m[1]), text: m[2].trim() });
    }
  }

  // Extract links
  const links: { text: string; href: string }[] = [];
  const aMatches = html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi);
  for (const m of aMatches) {
    if (links.length < 20 && m[2].trim()) {
      let href = m[1];
      if (href.startsWith("/")) {
        try { href = new URL(href, url).href; } catch {}
      }
      links.push({ text: m[2].trim(), href });
    }
  }

  // Build Figma-like tree
  const root: FigmaNode = {
    type: "FRAME",
    name: title,
    url,
    description,
    width: 1440,
    height: 900,
    layoutMode: "VERTICAL",
    children: [
      {
        type: "TEXT",
        name: "Title",
        characters: title,
        fontSize: 32,
        fontWeight: 700,
      },
      ...(description ? [{
        type: "TEXT" as const,
        name: "Description",
        characters: description,
        fontSize: 14,
        color: "#666",
      }] : []),
      {
        type: "FRAME",
        name: "Colors",
        layoutMode: "HORIZONTAL",
        children: Array.from(colors).map((c) => ({
          type: "RECTANGLE" as const,
          name: c,
          fills: [{ type: "SOLID", color: hexToRgb(c) }],
          width: 40,
          height: 40,
          cornerRadius: 4,
        })),
      },
      {
        type: "FRAME",
        name: "Headings",
        layoutMode: "VERTICAL",
        children: headings.map((h) => ({
          type: "TEXT" as const,
          name: `H${h.level}`,
          characters: h.text,
          fontSize: 24 - h.level * 2,
          fontWeight: 700 - h.level * 100,
        })),
      },
      {
        type: "FRAME",
        name: "Images",
        layoutMode: "HORIZONTAL",
        children: images.map((src, i) => ({
          type: "RECTANGLE" as const,
          name: `Image ${i + 1}`,
          fills: [{ type: "IMAGE", imageUrl: src }],
          width: 120,
          height: 80,
          cornerRadius: 4,
        })),
      },
      {
        type: "FRAME",
        name: "Links",
        layoutMode: "VERTICAL",
        children: links.map((l) => ({
          type: "TEXT" as const,
          name: l.text,
          characters: l.text,
          fontSize: 12,
          color: "#2563eb",
          hyperlink: { url: l.href },
        })),
      },
    ],
  };

  return root;
}

export async function POST(req: NextRequest) {
  try {
    const { url, mode = "quick" } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL
    let targetUrl: string;
    try {
      targetUrl = new URL(url).href;
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Fetch page
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch page: ${response.status} ${response.statusText}` },
        { status: 502 }
      );
    }

    const html = await response.text();

    // For "quick" mode, return simplified structure
    // For "deep" mode, we could do more processing
    const figmaTree = parseHtmlToFigma(html, targetUrl);

    return NextResponse.json({
      success: true,
      mode,
      url: targetUrl,
      figmaTree,
      meta: {
        title: figmaTree.name,
        description: figmaTree.description,
        colorCount: figmaTree.children?.find((c) => c.name === "Colors")?.children?.length || 0,
        headingCount: figmaTree.children?.find((c) => c.name === "Headings")?.children?.length || 0,
        imageCount: figmaTree.children?.find((c) => c.name === "Images")?.children?.length || 0,
        linkCount: figmaTree.children?.find((c) => c.name === "Links")?.children?.length || 0,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
