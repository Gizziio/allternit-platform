/**
 * Content Ingestion Kernel
 *
 * Agent-native content pipeline: HTML → Markdown → Structured Context.
 */

import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { dirname, join } from 'path';
import nlp from 'compromise';
import sanitizeHtml from 'sanitize-html';
import { NodeHtmlMarkdown } from 'node-html-markdown';

// ============================================================================
// Types
// ============================================================================

export interface IngestedContent {
  url: string;
  title: string;
  sections: ContentSection[];
  metadata: ContentMetadata;
  ingestedAt: string;
}

export interface ContentSection {
  heading: string;
  summary: string;
  keyPoints: string[];
  entities: Entity[];
  links: Link[];
}

export interface Entity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'date' | 'topic' | 'concept';
  confidence: number;
}

export interface Link {
  url: string;
  text: string;
  relevance: number;
}

export interface ContentMetadata {
  tokenEstimate: {
    raw: number;
    clean: number;
    structured: number;
    compressionRatio: number;
  };
  domain: string;
  confidence: number;
  sourceHash: string;
}

export interface LivingFile {
  path: string;
  markdownPath: string;
  jsonPath: string;
  sourceUrl: string;
  timestamp: string;
  semanticSignature: string;
  relationships: string[];
  versionDiffs: VersionDiff[];
}

export interface VersionDiff {
  version: number;
  timestamp: string;
  changes: string[];
}

export interface FetchOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
}

export interface VectorDBConfig {
  provider: 'pinecone' | 'weaviate' | 'qdrant' | 'custom';
  apiKey?: string;
  endpoint?: string;
  indexName?: string;
  namespace?: string;
}

export interface KnowledgeGraphNode {
  id: string;
  type: 'content' | 'entity' | 'topic';
  label: string;
  embedding?: number[];
  metadata: Record<string, unknown>;
  relationships: KnowledgeGraphEdge[];
}

export interface KnowledgeGraphEdge {
  target: string;
  type: string;
  weight: number;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// HTML Fetcher (GAP-31)
// ============================================================================

export class HTMLFetcher {
  private defaultOptions: FetchOptions = {
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
    userAgent: 'Allternit-ContentIngestion/1.0 (Agent-Native Content Pipeline)',
    followRedirects: true,
    maxRedirects: 5,
  };

  async fetch(
    url: string,
    options: FetchOptions = {}
  ): Promise<{ html: string; contentType: string; finalUrl: string; headers: Headers }> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < opts.retries!; attempt++) {
      try {
        return await this.fetchWithTimeout(url, opts, attempt);
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on 4xx errors (client errors)
        if (error instanceof FetchError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          if (error.statusCode === 404) {
            throw new FetchError(`Resource not found (404): ${url}`, 404);
          }
          if (error.statusCode === 403) {
            throw new FetchError(`Access forbidden (403): ${url}`, 403);
          }
          throw error;
        }

        // Wait before retrying
        if (attempt < opts.retries! - 1) {
          await this.sleep(opts.retryDelay! * (attempt + 1)); // Exponential backoff
        }
      }
    }

    throw new FetchError(`Failed to fetch ${url} after ${opts.retries} attempts: ${lastError?.message}`, 0);
  }

  private async fetchWithTimeout(
    url: string,
    options: FetchOptions,
    attempt: number
  ): Promise<{ html: string; contentType: string; finalUrl: string; headers: Headers }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'User-Agent': options.userAgent!,
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Cache-Control': 'no-cache',
          'X-Attempt': String(attempt + 1),
        },
        redirect: options.followRedirects ? 'follow' : 'manual',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new FetchError(`HTTP error: ${response.status} ${response.statusText}`, response.status);
      }

      // Check for too many redirects manually if needed
      if (response.redirected && options.maxRedirects) {
        // The fetch API handles redirects internally, but we can track them
      }

      const contentType = response.headers.get('content-type') || 'text/html';
      const html = await response.text();
      const finalUrl = response.url;

      // Validate content
      if (!html || html.trim().length === 0) {
        throw new FetchError('Empty response body', 0);
      }

      return { html, contentType, finalUrl, headers: response.headers };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof FetchError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new FetchError(`Request timeout after ${options.timeout}ms`, 0);
        }
        throw new FetchError(error.message, 0);
      }
      
      throw new FetchError('Unknown fetch error', 0);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class FetchError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = 'FetchError';
  }
}

// ============================================================================
// Markdown Negotiator
// ============================================================================

export class MarkdownNegotiator {
  async negotiate(url: string): Promise<{ markdown?: string; html?: string; contentType?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/markdown,text/x-markdown,text/html;q=0.9,*/*;q=0.8',
          'User-Agent': 'Allternit-ContentIngestion/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return { html: '' };
      }

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();

      if (contentType.includes('text/markdown') || contentType.includes('text/x-markdown')) {
        return { markdown: text, contentType };
      }

      return { html: text, contentType };
    } catch {
      return { html: '' };
    }
  }
}

// ============================================================================
// Content Cleaner (GAP-32)
// ============================================================================

export class ContentCleaner {
  private sanitizerOptions: sanitizeHtml.IOptions;
  private htmlToMarkdown: NodeHtmlMarkdown;

  constructor() {
    // Configure sanitize-html to preserve semantic content while removing unsafe/unnecessary elements
    this.sanitizerOptions = {
      allowedTags: [
        'p', 'div', 'span', 'br', 'hr',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'strong', 'b', 'em', 'i', 'u', 'strike', 'del',
        'a',
        'img',
        'blockquote', 'code', 'pre',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'article', 'section', 'main', 'header', 'footer', 'aside', 'figure', 'figcaption',
      ],
      allowedAttributes: {
        '*': ['class', 'id'],
        'a': ['href', 'title', 'target'],
        'img': ['src', 'alt', 'title', 'width', 'height'],
        'th': ['colspan', 'rowspan'],
        'td': ['colspan', 'rowspan'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        // Convert semantic HTML5 tags to more standard forms for processing
        'article': 'div',
        'section': 'div',
        'aside': 'div',
        'figure': 'div',
        'figcaption': 'p',
      },
      exclusiveFilter: (frame) => {
        // Remove empty tags that don't contribute to content
        if (frame.tag === 'div' || frame.tag === 'span' || frame.tag === 'p') {
          const text = frame.text.trim();
          return text.length === 0 && !frame.attribs.class?.includes('keep');
        }
        return false;
      },
    };

    // Initialize HTML to Markdown converter
    this.htmlToMarkdown = new NodeHtmlMarkdown({
      bulletMarker: '-',
      codeBlockStyle: 'fenced',
      emDelimiter: '_',
      strongDelimiter: '**',
    });
  }

  /**
   * Clean HTML by removing scripts, styles, and unsafe content,
   * then convert to clean markdown
   */
  clean(html: string): string {
    // Step 1: Remove common boilerplate patterns before sanitization
    let cleaned = this.removeBoilerplate(html);

    // Step 2: Sanitize HTML
    cleaned = sanitizeHtml(cleaned, this.sanitizerOptions);

    // Step 3: Remove remaining class/style attributes and normalize whitespace
    cleaned = this.normalizeWhitespace(cleaned);

    // Step 4: Collapse repeated sections
    cleaned = this.collapseDuplicates(cleaned);

    return cleaned.trim();
  }

  /**
   * Convert HTML to clean Markdown
   */
  toMarkdown(html: string): string {
    const cleaned = this.clean(html);
    return this.htmlToMarkdown.translate(cleaned);
  }

  private removeBoilerplate(html: string): string {
    return html
      // Remove navigation elements
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<\w+[^>]*class=["'][^"']*\b(nav|navigation|menu|navbar)\b[^"]*["'][^>]*>[\s\S]*?<\/\w+>/gi, '')
      // Remove footer elements
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<\w+[^>]*class=["'][^"']*\b(footer|bottom)\b[^"]*["'][^>]*>[\s\S]*?<\/\w+>/gi, '')
      // Remove header elements (but keep content)
      .replace(/<header[^>]*role=["']banner["'][^>]*>[\s\S]*?<\/header>/gi, '')
      // Remove script and style tags completely
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
      // Remove inline event handlers
      .replace(/\s*on\w+=["'][^"']*["']/gi, '')
      // Remove data attributes that often contain tracking
      .replace(/\s*data-[\w-]+=["'][^"']*["']/gi, '')
      // Remove social sharing widgets
      .replace(/<\w+[^>]*class=["'][^"']*\b(social|share|twitter|facebook|linkedin)\b[^"]*["'][^>]*>[\s\S]*?<\/\w+>/gi, '')
      // Remove advertisement containers
      .replace(/<\w+[^>]*class=["'][^"']*\b(ad|ads|advertisement|banner)\b[^"]*["'][^>]*>[\s\S]*?<\/\w+>/gi, '');
  }

  private normalizeWhitespace(html: string): string {
    return html
      .replace(/\s+/g, ' ')
      .replace(/>\s+</g, '><')
      .replace(/\s+class=""/g, '')
      .replace(/\s+style=""/g, '');
  }

  private collapseDuplicates(html: string): string {
    // Collapse repeated sections (common in badly formatted HTML)
    return html.replace(/(<h[1-6][^>]*>.*?<\/h[1-6]>)\s*\1/g, '$1');
  }
}

// ============================================================================
// Semantic Structurer (GAP-33)
// ============================================================================

export class SemanticStructurer {
  private nlp: typeof nlp;

  constructor() {
    this.nlp = nlp;
  }

  structure(markdown: string, url: string): IngestedContent {
    const sections = this.extractSections(markdown);
    const allEntities = this.extractEntities(markdown);
    const allLinks = this.extractLinks(markdown);

    const domain = this.extractDomain(url);
    const tokenEstimate = this.estimateTokens(markdown, sections);

    // Distribute entities and links to relevant sections
    for (const section of sections) {
      section.entities = this.findEntitiesInSection(section.heading, section.summary, allEntities);
      section.links = this.findLinksInSection(section.summary, allLinks);
      section.summary = this.generateSummary(section.heading, section.summary, markdown);
      section.keyPoints = this.extractKeyPoints(section.summary);
    }

    return {
      url,
      title: this.extractTitle(markdown),
      sections,
      metadata: {
        tokenEstimate,
        domain,
        confidence: this.calculateConfidence(sections, allEntities),
        sourceHash: this.generateHash(markdown),
      },
      ingestedAt: new Date().toISOString(),
    };
  }

  private extractSections(markdown: string): ContentSection[] {
    const sections: ContentSection[] = [];
    
    // Split by markdown headers (## and ### level)
    const lines = markdown.split('\n');
    let currentSection: ContentSection | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^(#{2,3})\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.summary = currentContent.join(' ').trim();
        }
        
        // Start new section
        currentSection = {
          heading: headerMatch[2].trim(),
          summary: '',
          keyPoints: [],
          entities: [],
          links: [],
        };
        sections.push(currentSection);
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.summary = currentContent.join(' ').trim();
    }

    // If no sections found, create one from entire content
    if (sections.length === 0) {
      sections.push({
        heading: 'Content',
        summary: markdown.slice(0, 2000),
        keyPoints: [],
        entities: [],
        links: [],
      });
    }

    return sections;
  }

  private extractEntities(text: string): Entity[] {
    const doc = this.nlp(text);
    const entities: Entity[] = [];
    const seen = new Set<string>();

    // Extract people
    const people = doc.people().json();
    for (const person of people) {
      const name = person.text;
      if (!seen.has(`person:${name}`)) {
        seen.add(`person:${name}`);
        entities.push({
          name,
          type: 'person',
          confidence: person.confidence || 0.8,
        });
      }
    }

    // Extract organizations
    const organizations = doc.organizations().json();
    for (const org of organizations) {
      const name = org.text;
      if (!seen.has(`organization:${name}`)) {
        seen.add(`organization:${name}`);
        entities.push({
          name,
          type: 'organization',
          confidence: org.confidence || 0.75,
        });
      }
    }

    // Extract places/locations
    const places = doc.places().json();
    for (const place of places) {
      const name = place.text;
      if (!seen.has(`location:${name}`)) {
        seen.add(`location:${name}`);
        entities.push({
          name,
          type: 'location',
          confidence: place.confidence || 0.7,
        });
      }
    }

    // Extract dates using regex pattern (compromise doesn't have .dates() method)
    const datePattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/gi;
    const dateMatches = text.match(datePattern) || [];
    for (const dateStr of dateMatches) {
      if (!seen.has(`date:${dateStr}`)) {
        seen.add(`date:${dateStr}`);
        entities.push({
          name: dateStr,
          type: 'date',
          confidence: 0.85,
        });
      }
    }

    // Extract topics (nouns with frequency > 1)
    const nouns = doc.nouns().json();
    const nounFreq = new Map<string, number>();
    for (const noun of nouns) {
      const text = noun.text.toLowerCase();
      nounFreq.set(text, (nounFreq.get(text) || 0) + 1);
    }
    
    for (const [topic, freq] of nounFreq.entries()) {
      if (freq > 1 && topic.length > 3) {
        entities.push({
          name: topic,
          type: 'topic',
          confidence: Math.min(0.5 + freq * 0.1, 0.9),
        });
      }
    }

    // Extract concepts (key terms based on adjectives + nouns)
    const terms = doc.terms().json();
    for (let i = 0; i < terms.length - 1; i++) {
      const current = terms[i];
      const next = terms[i + 1];
      
      if (current.tags?.includes('Adjective') && next.tags?.includes('Noun')) {
        const concept = `${current.text} ${next.text}`;
        if (!seen.has(`concept:${concept}`)) {
          seen.add(`concept:${concept}`);
          entities.push({
            name: concept,
            type: 'concept',
            confidence: 0.6,
          });
        }
      }
    }

    // Sort by confidence descending
    return entities.sort((a, b) => b.confidence - a.confidence);
  }

  private extractLinks(markdown: string): Link[] {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const links: Link[] = [];
    let match;

    while ((match = linkRegex.exec(markdown)) !== null) {
      const text = match[1];
      const url = match[2];
      
      // Calculate relevance based on text length and URL quality
      let relevance = 0.5;
      if (text.length > 10) relevance += 0.1;
      if (url.startsWith('http')) relevance += 0.1;
      if (!url.includes('ads') && !url.includes('tracking')) relevance += 0.1;
      
      links.push({
        text,
        url,
        relevance: Math.min(relevance, 1.0),
      });
    }

    return links;
  }

  private findEntitiesInSection(heading: string, summary: string, allEntities: Entity[]): Entity[] {
    const sectionText = (heading + ' ' + summary).toLowerCase();
    return allEntities.filter(e => sectionText.includes(e.name.toLowerCase()));
  }

  private findLinksInSection(sectionText: string, allLinks: Link[]): Link[] {
    const text = sectionText.toLowerCase();
    return allLinks.filter(l => text.includes(l.text.toLowerCase()) || text.includes(l.url.toLowerCase()));
  }

  private generateSummary(heading: string, existingSummary: string, fullText: string): string {
    if (existingSummary && existingSummary.length > 50) {
      return existingSummary.slice(0, 500);
    }
    
    // Extract first meaningful paragraph
    const paragraphs = fullText.split('\n\n').filter(p => p.trim().length > 50);
    return paragraphs[0]?.slice(0, 500) || heading;
  }

  private extractKeyPoints(summary: string): string[] {
    const doc = this.nlp(summary);
    const sentences = doc.sentences().json();
    const keyPoints: string[] = [];

    for (const sent of sentences.slice(0, 3)) {
      const text = sent.text.trim();
      // Filter for sentences that seem informative
      if (text.length > 30 && text.length < 200) {
        const hasVerb = sent.terms?.some((t: { tags?: string[] }) => t.tags?.includes('Verb'));
        if (hasVerb) {
          keyPoints.push(text);
        }
      }
    }

    return keyPoints.slice(0, 3);
  }

  private extractTitle(markdown: string): string {
    const match = markdown.match(/^#\s+(.+)$/m);
    return match ? match[1] : 'Untitled';
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  private estimateTokens(markdown: string, sections: ContentSection[]): ContentMetadata['tokenEstimate'] {
    const raw = markdown.length / 4; // rough estimate
    const clean = raw * 0.7;
    const structured = clean * 0.5;

    return {
      raw: Math.round(raw),
      clean: Math.round(clean),
      structured: Math.round(structured),
      compressionRatio: structured / raw,
    };
  }

  private calculateConfidence(sections: ContentSection[], entities: Entity[]): number {
    let confidence = 0.7;
    
    // Increase confidence if we have good section structure
    if (sections.length >= 3) confidence += 0.1;
    
    // Increase confidence if we extracted entities
    if (entities.length >= 5) confidence += 0.1;
    
    // Check for entity quality
    const highConfEntities = entities.filter(e => e.confidence > 0.8).length;
    if (highConfEntities >= 3) confidence += 0.05;

    return Math.min(confidence, 1.0);
  }

  private generateHash(input: string): string {
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
  }
}

// ============================================================================
// Living File Writer (GAP-34)
// ============================================================================

export class LivingFileWriter {
  private baseDir: string;

  constructor(baseDir: string = './living') {
    this.baseDir = baseDir;
  }

  async write(content: IngestedContent): Promise<LivingFile> {
    const domain = content.metadata.domain;
    const hash = content.metadata.sourceHash;
    const timestamp = new Date().toISOString();

    // Create directory paths
    const domainDir = join(this.baseDir, 'web', domain);
    const versionsDir = join(domainDir, '.versions', hash);

    // Ensure directories exist
    await this.ensureDir(domainDir);
    await this.ensureDir(versionsDir);

    const markdownPath = join(domainDir, `${hash}.md`);
    const jsonPath = join(domainDir, `${hash}.json`);

    // Generate content
    const markdown = this.toMarkdown(content);
    const json = JSON.stringify(content, null, 2);

    // Check for existing file to create version diff
    const versionDiffs = await this.handleVersioning(markdownPath, markdown, versionsDir);

    // Write files
    await this.writeFileSafe(markdownPath, markdown);
    await this.writeFileSafe(jsonPath, json);

    // Write version backup
    const versionPath = join(versionsDir, `${timestamp.replace(/[:.]/g, '-')}.md`);
    await this.writeFileSafe(versionPath, markdown);

    return {
      path: join(domainDir, hash),
      markdownPath,
      jsonPath,
      sourceUrl: content.url,
      timestamp,
      semanticSignature: hash,
      relationships: [],
      versionDiffs,
    };
  }

  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private async writeFileSafe(filePath: string, content: string): Promise<void> {
    try {
      // Ensure parent directory exists
      await this.ensureDir(dirname(filePath));
      
      // Write atomically using temp file
      const tempPath = `${filePath}.tmp`;
      await fs.writeFile(tempPath, content, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async handleVersioning(
    markdownPath: string,
    newContent: string,
    versionsDir: string
  ): Promise<VersionDiff[]> {
    const versionDiffs: VersionDiff[] = [];

    try {
      // Check if file exists
      const existingContent = await fs.readFile(markdownPath, 'utf-8');
      
      if (existingContent !== newContent) {
        // Calculate simple diff
        const changes = this.calculateDiff(existingContent, newContent);
        
        const versionFile = await fs.readdir(versionsDir).catch(() => []);
        const version = versionFile.length + 1;
        
        versionDiffs.push({
          version,
          timestamp: new Date().toISOString(),
          changes,
        });
      }
    } catch {
      // File doesn't exist yet - first version
      versionDiffs.push({
        version: 1,
        timestamp: new Date().toISOString(),
        changes: ['Initial creation'],
      });
    }

    return versionDiffs;
  }

  private calculateDiff(oldContent: string, newContent: string): string[] {
    const changes: string[] = [];
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');

    // Simple line-based diff
    if (newLines.length > oldLines.length) {
      changes.push(`Added ${newLines.length - oldLines.length} lines`);
    } else if (newLines.length < oldLines.length) {
      changes.push(`Removed ${oldLines.length - newLines.length} lines`);
    }

    if (oldContent.length !== newContent.length) {
      const diff = newContent.length - oldContent.length;
      changes.push(`Content ${diff > 0 ? 'grew' : 'shrank'} by ${Math.abs(diff)} characters`);
    }

    if (changes.length === 0) {
      changes.push('Minor content updates');
    }

    return changes;
  }

  private toMarkdown(content: IngestedContent): string {
    let md = `# ${content.title}\n\n`;
    md += `**Source:** ${content.url}\n`;
    md += `**Domain:** ${content.metadata.domain}\n`;
    md += `**Ingested:** ${content.ingestedAt}\n`;
    md += `**Hash:** ${content.metadata.sourceHash}\n`;
    md += `**Confidence:** ${(content.metadata.confidence * 100).toFixed(1)}%\n\n`;

    md += `---\n\n`;

    // Token estimate section
    md += `## Metadata\n\n`;
    md += `- **Raw Tokens:** ~${content.metadata.tokenEstimate.raw}\n`;
    md += `- **Clean Tokens:** ~${content.metadata.tokenEstimate.clean}\n`;
    md += `- **Structured Tokens:** ~${content.metadata.tokenEstimate.structured}\n`;
    md += `- **Compression Ratio:** ${(content.metadata.tokenEstimate.compressionRatio * 100).toFixed(1)}%\n\n`;

    // Entities section
    const topEntities = content.sections
      .flatMap(s => s.entities)
      .filter((e, i, arr) => arr.findIndex(t => t.name === e.name) === i)
      .slice(0, 20);

    if (topEntities.length > 0) {
      md += `## Entities\n\n`;
      for (const entity of topEntities) {
        md += `- **${entity.name}** (${entity.type}, ${(entity.confidence * 100).toFixed(0)}%)\n`;
      }
      md += '\n';
    }

    md += `---\n\n`;

    // Content sections
    for (const section of content.sections) {
      md += `## ${section.heading}\n\n`;
      
      if (section.summary) {
        md += `${section.summary}\n\n`;
      }
      
      if (section.keyPoints.length > 0) {
        md += '**Key Points:**\n';
        for (const point of section.keyPoints) {
          md += `- ${point}\n`;
        }
        md += '\n';
      }

      if (section.entities.length > 0) {
        md += '**Entities:** ';
        md += section.entities.map(e => e.name).join(', ');
        md += '\n\n';
      }

      if (section.links.length > 0) {
        md += '**Links:**\n';
        for (const link of section.links.slice(0, 5)) {
          md += `- [${link.text}](${link.url})\n`;
        }
        md += '\n';
      }
    }

    return md;
  }
}

// ============================================================================
// Vector DB Integration (GAP-35)
// ============================================================================

export interface VectorDBClient {
  upsert(vectors: VectorEntry[]): Promise<void>;
  query(vector: number[], topK: number, filter?: Record<string, unknown>): Promise<QueryResult[]>;
  delete(ids: string[]): Promise<void>;
  ping(): Promise<boolean>;
}

export interface VectorEntry {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

export interface QueryResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

/**
 * Vector Database Adapter
 * Supports Pinecone, Weaviate, Qdrant, and custom providers.
 *
 * @placeholder APPROVED - Full provider integration pending
 * @ticket GAP-50
 * @fallback Console logging stub
 */
export class VectorDBAdapter implements VectorDBClient {
  private config: VectorDBConfig;
  private isConnected: boolean = false;

  constructor(config: VectorDBConfig) {
    this.config = config;
  }

  /**
   * Connect to vector database
   * @placeholder APPROVED - Provider-specific connection logic pending
   */
  async connect(): Promise<void> {
    console.log(`[VectorDB] Connecting to ${this.config.provider}...`);
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    console.log('[VectorDB] Disconnected');
  }

  async ping(): Promise<boolean> {
    return this.isConnected;
  }

  /**
   * Upsert vectors into database
   * @placeholder APPROVED - Provider-specific API calls pending
   */
  async upsert(vectors: VectorEntry[]): Promise<void> {
    if (!this.isConnected) {
      throw new Error('VectorDB not connected');
    }

    console.log(`[VectorDB] Upserting ${vectors.length} vectors to ${this.config.indexName}`);

    // Stub: Actual implementation would call provider-specific API
    for (const vector of vectors) {
      console.log(`  - Upserted: ${vector.id} (${vector.values.length} dimensions)`);
    }
  }

  /**
   * Query vectors from database
   * @placeholder APPROVED - Provider-specific query API pending
   * @returns Empty array (stub)
   */
  async query(vector: number[], topK: number, filter?: Record<string, unknown>): Promise<QueryResult[]> {
    if (!this.isConnected) {
      throw new Error('VectorDB not connected');
    }

    console.log(`[VectorDB] Querying ${topK} results with filter:`, filter);

    // Stub: Return mock results
    return [];
  }

  async delete(ids: string[]): Promise<void> {
    if (!this.isConnected) {
      throw new Error('VectorDB not connected');
    }

    console.log(`[VectorDB] Deleting ${ids.length} vectors`);
  }

  /**
   * Create knowledge graph nodes from ingested content
   */
  createKnowledgeGraphNodes(content: IngestedContent): KnowledgeGraphNode[] {
    const nodes: KnowledgeGraphNode[] = [];
    const contentId = `content:${content.metadata.sourceHash}`;

    // Create content node
    nodes.push({
      id: contentId,
      type: 'content',
      label: content.title,
      metadata: {
        url: content.url,
        domain: content.metadata.domain,
        ingestedAt: content.ingestedAt,
        confidence: content.metadata.confidence,
      },
      relationships: [],
    });

    // Create entity nodes
    const allEntities = content.sections.flatMap(s => s.entities);
    const uniqueEntities = new Map<string, Entity>();
    
    for (const entity of allEntities) {
      const key = `${entity.type}:${entity.name}`;
      if (!uniqueEntities.has(key)) {
        uniqueEntities.set(key, entity);
        
        const entityId = `entity:${this.slugify(entity.name)}`;
        nodes.push({
          id: entityId,
          type: 'entity',
          label: entity.name,
          metadata: {
            entityType: entity.type,
            confidence: entity.confidence,
          },
          relationships: [
            { target: contentId, type: 'appears_in', weight: entity.confidence },
          ],
        });

        // Add reverse relationship to content node
        nodes[0].relationships.push({
          target: entityId,
          type: 'contains',
          weight: entity.confidence,
        });
      }
    }

    // Create topic nodes from high-confidence entities
    const topics = allEntities.filter(e => e.type === 'topic' && e.confidence > 0.7);
    for (const topic of topics) {
      const topicId = `topic:${this.slugify(topic.name)}`;
      
      // Check if not already added as entity
      if (!nodes.find(n => n.id === topicId)) {
        nodes.push({
          id: topicId,
          type: 'topic',
          label: topic.name,
          metadata: {
            confidence: topic.confidence,
          },
          relationships: [
            { target: contentId, type: 'discussed_in', weight: topic.confidence },
          ],
        });
      }
    }

    return nodes;
  }

  /**
   * Prepare content for embedding storage
   */
  prepareForEmbedding(content: IngestedContent): VectorEntry[] {
    const entries: VectorEntry[] = [];
    
    // Create embedding entry for full content
    entries.push({
      id: `content:${content.metadata.sourceHash}`,
      values: [], // Would be populated by actual embedding model
      metadata: {
        type: 'content',
        title: content.title,
        url: content.url,
        domain: content.metadata.domain,
        ingestedAt: content.ingestedAt,
        text: content.sections.map(s => `${s.heading}\n${s.summary}`).join('\n\n'),
      },
    });

    // Create embedding entries for each section
    for (let i = 0; i < content.sections.length; i++) {
      const section = content.sections[i];
      entries.push({
        id: `section:${content.metadata.sourceHash}:${i}`,
        values: [], // Would be populated by actual embedding model
        metadata: {
          type: 'section',
          title: section.heading,
          parentUrl: content.url,
          text: section.summary,
          entities: section.entities.map(e => e.name),
        },
      });
    }

    return entries;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

// ============================================================================
// Content Ingestion Kernel (Main Entry Point)
// ============================================================================

export interface IngestionOptions {
  fetchOptions?: FetchOptions;
  outputDir?: string;
  vectorDBConfig?: VectorDBConfig;
  enableVectorDB?: boolean;
}

export class ContentIngestionKernel {
  private fetcher: HTMLFetcher;
  private negotiator: MarkdownNegotiator;
  private cleaner: ContentCleaner;
  private structurer: SemanticStructurer;
  private writer: LivingFileWriter;
  private vectorDB?: VectorDBAdapter;

  constructor(options: IngestionOptions = {}) {
    this.fetcher = new HTMLFetcher();
    this.negotiator = new MarkdownNegotiator();
    this.cleaner = new ContentCleaner();
    this.structurer = new SemanticStructurer();
    this.writer = new LivingFileWriter(options.outputDir);

    if (options.enableVectorDB && options.vectorDBConfig) {
      this.vectorDB = new VectorDBAdapter(options.vectorDBConfig);
    }
  }

  async ingest(url: string, options?: IngestionOptions): Promise<{ content: IngestedContent; livingFile: LivingFile }> {
    const opts = options || {};
    
    // Step 1: Fetch with markdown negotiation
    const negotiated = await this.negotiator.negotiate(url);
    
    let html: string;
    let finalUrl = url;
    
    if (negotiated.markdown) {
      // Already have markdown, skip HTML processing
      html = negotiated.markdown;
    } else {
      // Fetch HTML with full error handling
      const fetched = await this.fetcher.fetch(url, opts.fetchOptions);
      html = fetched.html;
      finalUrl = fetched.finalUrl;
    }

    // Step 2: Clean HTML and convert to markdown
    let markdown: string;
    if (negotiated.markdown) {
      markdown = html;
    } else {
      markdown = this.cleaner.toMarkdown(html);
    }

    // Step 3: Structure content with NLP entity extraction
    const content = this.structurer.structure(markdown, finalUrl);

    // Step 4: Write living file to filesystem
    const livingFile = await this.writer.write(content);

    // Step 5: Optional - Index in vector DB
    if (this.vectorDB) {
      await this.indexInVectorDB(content);
    }

    return { content, livingFile };
  }

  async ingestBatch(urls: string[], options?: IngestionOptions): Promise<{ url: string; result: { content: IngestedContent; livingFile: LivingFile } | null; error?: string }[]> {
    const results = [];
    
    for (const url of urls) {
      try {
        const result = await this.ingest(url, options);
        results.push({ url, result });
      } catch (error) {
        results.push({ 
          url, 
          result: null, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return results;
  }

  async connectVectorDB(): Promise<void> {
    if (this.vectorDB) {
      await this.vectorDB.connect();
    }
  }

  private async indexInVectorDB(content: IngestedContent): Promise<void> {
    if (!this.vectorDB) return;

    try {
      // Prepare knowledge graph nodes
      const nodes = this.vectorDB.createKnowledgeGraphNodes(content);
      console.log(`[VectorDB] Prepared ${nodes.length} knowledge graph nodes`);

      // Prepare for embedding (without actual embeddings - would need embedding model)
      const entries = this.vectorDB.prepareForEmbedding(content);
      console.log(`[VectorDB] Prepared ${entries.length} embedding entries`);

      // Note: Actual vector upsert would require an embedding model
      // await this.vectorDB.upsert(entries);
    } catch (error) {
      console.error('[VectorDB] Failed to index content:', error);
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const contentIngestion = new ContentIngestionKernel();

// ============================================================================
// Exports
// ============================================================================

export { nlp as compromise };
export { sanitizeHtml };
export { NodeHtmlMarkdown };
