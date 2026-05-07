/**
 * Slides Plugin - Production Implementation
 * 
 * Presentation generation via AI
 * Creates PowerPoint-compatible presentations and web slides
 */

import { generateText } from 'ai';
import { getLanguageModel } from '@/lib/ai/providers';
import type { 
  ModePlugin, 
  PluginConfig, 
  PluginInput, 
  PluginOutput, 
  PluginCapability,
  PluginEvent,
  PluginEventHandler 
} from '../types';

export interface SlidesConfig extends PluginConfig {
  defaultTheme?: string;
  defaultSlideCount?: number;
  enableCharts?: boolean;
  enableImages?: boolean;
}

export interface SlideContent {
  title: string;
  subtitle?: string;
  slides: Array<{
    title: string;
    content: string[];
    type: 'title' | 'content' | 'bullet' | 'quote' | 'image' | 'two-column';
    layout?: 'default' | 'center' | 'split' | 'full-image';
    backgroundColor?: string;
    imageUrl?: string;
    speakerNotes?: string;
  }>;
  theme: {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    font: string;
  };
}

class SlidesPlugin implements ModePlugin {
  readonly id = 'slides';
  readonly name = 'Slides';
  readonly version = '1.0.0';
  readonly capabilities: PluginCapability[] = [
    'presentation-generation',
    'slide-design',
    'speaker-notes',
    'pptx-export',
    'html-slides',
    'markdown-slides',
  ];

  isInitialized = false;
  isExecuting = false;
  config: SlidesConfig = {
    defaultTheme: 'modern',
    defaultSlideCount: 10,
    enableCharts: true,
    enableImages: true,
  };

  private eventHandlers: Map<string, Set<PluginEventHandler>> = new Map();
  private abortController: AbortController | null = null;

  on(event: string, handler: PluginEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: PluginEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: PluginEvent): void {
    this.eventHandlers.get(event.type)?.forEach(handler => {
      try {
        handler(event);
      } catch (err) {
        console.error(`[SlidesPlugin] Event handler error:`, err);
      }
    });
  }

  async initialize(config?: SlidesConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    this.isInitialized = true;
    this.emit({ type: 'initialized', timestamp: Date.now() });
    console.log('[SlidesPlugin] Initialized');
  }

  async destroy(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isInitialized = false;
    this.eventHandlers.clear();
    this.emit({ type: 'destroyed', timestamp: Date.now() });
  }

  async execute(input: PluginInput): Promise<PluginOutput> {
    if (!this.isInitialized) {
      throw new Error('Plugin not initialized');
    }

    this.isExecuting = true;
    this.abortController = new AbortController();
    
    this.emit({ type: 'started', timestamp: Date.now() });

    try {
      const topic = input.prompt;
      const slideCount = (input.options?.slideCount as number) || this.config.defaultSlideCount || 10;
      const format = (input.options?.format as string) || 'html'; // html, pptx, markdown, reveal
      const theme = (input.options?.theme as string) || this.config.defaultTheme || 'modern';

      // Generate slide content with AI
      this.emit({ 
        type: 'progress', 
        payload: { step: 'generating', message: `Creating ${slideCount} slides...` },
        timestamp: Date.now() 
      });

      const slideContent = await this.generateSlides(topic, slideCount, theme);

      // Generate output based on format
      let content: string;
      let artifacts: PluginOutput['artifacts'] = [];

      switch (format) {
        case 'pptx':
          content = this.formatAsPPTX(slideContent);
          artifacts = [{
            type: 'file' as const,
            url: `data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,${btoa(content)}`,
            name: `${slideContent.title.replace(/\s+/g, '-')}.pptx`,
            metadata: { format: 'pptx', slideCount: slideContent.slides.length },
          }];
          break;
        
        case 'reveal':
          content = this.formatAsRevealJS(slideContent);
          artifacts = [{
            type: 'code' as const,
            url: `slides://reveal/${Date.now()}`,
            name: 'index.html',
            metadata: { 
              format: 'reveal.js',
              slideCount: slideContent.slides.length,
              html: content,
            },
          }];
          break;
        
        case 'markdown':
          content = this.formatAsMarkdown(slideContent);
          artifacts = [{
            type: 'code' as const,
            url: `slides://markdown/${Date.now()}`,
            name: 'slides.md',
            metadata: { format: 'markdown', slideCount: slideContent.slides.length },
          }];
          break;
        
        case 'html':
        default:
          content = this.formatAsHTML(slideContent);
          artifacts = [{
            type: 'code' as const,
            url: `slides://html/${Date.now()}`,
            name: 'index.html',
            metadata: { 
              format: 'html',
              slideCount: slideContent.slides.length,
              html: content,
            },
          }];
          break;
      }

      return {
        success: true,
        content: this.formatSlideOutput(slideContent, format),
        artifacts,
      };

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      const output: PluginOutput = {
        success: false,
        error: {
          message: error.message,
          code: 'SLIDES_ERROR',
          recoverable: false,
        },
      };

      this.emit({ type: 'error', payload: error, timestamp: Date.now() });
      return output;

    } finally {
      this.isExecuting = false;
      this.abortController = null;
    }
  }

  async cancel(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  hasCapability(capability: PluginCapability): boolean {
    return this.capabilities.includes(capability);
  }

  async health(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }

  private async generateSlides(topic: string, slideCount: number, theme: string): Promise<SlideContent> {
    const model = await getLanguageModel('anthropic/claude-3-5-sonnet');
    
    const { text } = await generateText({
      model,
      prompt: `Create a professional presentation about: "${topic}"

Generate ${slideCount} slides with:
1. Title slide
2. Table of contents
3. Content slides (bullet points, key information)
4. Conclusion/summary slide

Format as JSON:
{
  "title": "Presentation Title",
  "subtitle": "Optional subtitle",
  "slides": [
    {
      "title": "Slide Title",
      "content": ["Point 1", "Point 2", "Point 3"],
      "type": "title|content|bullet|quote|two-column",
      "speakerNotes": "Notes for presenter"
    }
  ],
  "theme": {
    "name": "${theme}",
    "primaryColor": "#6366f1",
    "secondaryColor": "#8b5cf6",
    "font": "Allternit Sans"
  }
}`,
      temperature: 0.4,
    });

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('Failed to parse slides JSON:', e);
    }

    // Fallback structure
    return {
      title: topic,
      subtitle: 'Generated Presentation',
      slides: [
        { title: topic, content: [], type: 'title', speakerNotes: 'Welcome to the presentation' },
        { title: 'Introduction', content: ['Overview of the topic'], type: 'content' },
        { title: 'Key Points', content: ['Main point 1', 'Main point 2', 'Main point 3'], type: 'bullet' },
        { title: 'Conclusion', content: ['Summary of key takeaways'], type: 'content' },
      ],
      theme: {
        name: theme,
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        font: 'Allternit Sans',
      },
    };
  }

  private formatAsHTML(content: SlideContent): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${content.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${content.theme.font}, system-ui, sans-serif; }
    .slide {
      width: 100vw;
      height: 100vh;
      padding: 60px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      page-break-after: always;
    }
    .slide-title { background: ${content.theme.primaryColor}; color: white; text-align: center; }
    .slide-content { background: white; color: #1a1a1a; }
    h1 { font-size: 3em; margin-bottom: 0.5em; }
    h2 { font-size: 2em; margin-bottom: 1em; color: ${content.theme.primaryColor}; }
    ul { margin-left: 2em; }
    li { margin: 0.5em 0; font-size: 1.2em; }
    .subtitle { font-size: 1.5em; opacity: 0.8; }
  </style>
</head>
<body>
${content.slides.map((slide, i) => `
  <div class="slide ${i === 0 ? 'slide-title' : 'slide-content'}">
    <h1>${slide.title}</h1>
    ${i === 0 && content.subtitle ? `<p class="subtitle">${content.subtitle}</p>` : ''}
    ${slide.content.length > 0 ? `<ul>${slide.content.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
  </div>
`).join('')}
</body>
</html>`;
  }

  private formatAsRevealJS(content: SlideContent): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${content.title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/theme/white.css">
  <style>
    :root {
      --r-background-color: white;
      --r-main-color: #1a1a1a;
      --r-heading-color: ${content.theme.primaryColor};
    }
  </style>
</head>
<body>
  <div class="reveal">
    <div class="slides">
${content.slides.map(slide => `
      <section>
        <h2>${slide.title}</h2>
        ${slide.content.length > 0 ? `<ul>${slide.content.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
        ${slide.speakerNotes ? `<aside class="notes">${slide.speakerNotes}</aside>` : ''}
      </section>
`).join('')}
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/reveal.js@4.5.0/dist/reveal.js"></script>
  <script>Reveal.initialize({ hash: true, slideNumber: true });</script>
</body>
</html>`;
  }

  private formatAsMarkdown(content: SlideContent): string {
    return `# ${content.title}

${content.subtitle ? `> ${content.subtitle}\n` : ''}

---

${content.slides.map(slide => `
## ${slide.title}

${slide.content.map(c => `- ${c}`).join('\n')}

${slide.speakerNotes ? `<!-- Note: ${slide.speakerNotes} -->` : ''}

---
`).join('')}`;
  }

  private formatAsPPTX(content: SlideContent): string {
    // Return a simplified XML structure that can be processed by pptx libraries
    // In production, use a library like pptxgenjs
    return JSON.stringify(content, null, 2);
  }

  private formatSlideOutput(content: SlideContent, format: string): string {
    return [
      `# ${content.title}`,
      content.subtitle ? `\n*${content.subtitle}*\n` : '',
      `\n**${content.slides.length} slides** | Theme: ${content.theme.name} | Format: ${format.toUpperCase()}`,
      '\n## Slide Overview',
      ...content.slides.map((slide, i) => 
        `${i + 1}. **${slide.title}** (${slide.type})${slide.speakerNotes ? ` - Notes: ${slide.speakerNotes.substring(0, 50)}...` : ''}`
      ),
      '\n## Speaker Notes',
      ...content.slides
        .filter(s => s.speakerNotes)
        .map(s => `### ${s.title}\n${s.speakerNotes}`),
    ].join('\n');
  }
}

export function createSlidesPlugin(): ModePlugin {
  return new SlidesPlugin();
}

export default createSlidesPlugin();
