/**
 * Office Local - PowerPoint Tools
 * 
 * File-based PowerPoint creation (no live PowerPoint required).
 * Uses pptxgenjs for creating PPTX files.
 * 
 * @module summit.office-local.powerpoint
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import pptxgen from 'pptxgenjs';

// ============================================================================
// Types
// ============================================================================

export interface DeckHandle {
  id: string;
  title: string;
  slides: SlideData[];
  created_at: string;
}

export interface SlideData {
  id: string;
  slide_number: number;
  layout: 'title' | 'bullets' | 'chart' | 'blank';
  title?: string;
  content?: any;
}

export interface CreateDeckInput {
  title: string;
  subtitle?: string;
}

export interface AddTitleSlideInput {
  deck_handle: DeckHandle;
  title: string;
  subtitle?: string;
}

export interface AddBulletsSlideInput {
  deck_handle: DeckHandle;
  title: string;
  bullets: string[];
  level?: number[];  // Indentation levels
}

export interface AddChartSlideInput {
  deck_handle: DeckHandle;
  title: string;
  chart_type: 'bar' | 'line' | 'pie' | 'scatter';
  data: any;
  labels?: string[];
}

export interface SaveDeckInput {
  deck_handle: DeckHandle;
  path: string;
}

export interface SaveDeckOutput {
  file_path: string;
  file_size: number;
  slide_count: number;
}

// ============================================================================
// PowerPoint Tools
// ============================================================================

/**
 * Create a new PowerPoint deck
 * 
 * @param input - Deck title and optional subtitle
 * @returns Deck handle for adding slides
 */
export async function createDeck(input: CreateDeckInput): Promise<DeckHandle> {
  const { title, subtitle } = input;
  
  const deck: DeckHandle = {
    id: `deck_${Date.now()}`,
    title,
    slides: [],
    created_at: new Date().toISOString(),
  };
  
  // Add title slide if subtitle provided
  if (subtitle) {
    const titleSlide = await addTitleSlide({ deck_handle: deck, title, subtitle });
    deck.slides.push(titleSlide);
  }
  
  return deck;
}

/**
 * Add title slide to deck
 * 
 * @param input - Deck handle, title, and subtitle
 * @returns Updated deck handle
 */
export async function addTitleSlide(input: AddTitleSlideInput): Promise<SlideData> {
  const { deck_handle, title, subtitle } = input;
  
  const slide: SlideData = {
    id: `slide_${deck_handle.slides.length + 1}`,
    slide_number: deck_handle.slides.length + 1,
    layout: 'title',
    title,
    content: { subtitle },
  };
  
  deck_handle.slides.push(slide);
  
  return slide;
}

/**
 * Add bullet points slide to deck
 * 
 * @param input - Deck handle, title, and bullet points
 * @returns Updated deck handle
 */
export async function addBulletsSlide(input: AddBulletsSlideInput): Promise<SlideData> {
  const { deck_handle, title, bullets, level } = input;
  
  const slide: SlideData = {
    id: `slide_${deck_handle.slides.length + 1}`,
    slide_number: deck_handle.slides.length + 1,
    layout: 'bullets',
    title,
    content: { bullets, level },
  };
  
  deck_handle.slides.push(slide);
  
  return slide;
}

/**
 * Add chart slide to deck
 * 
 * @param input - Deck handle, title, chart type, and data
 * @returns Updated deck handle
 */
export async function addChartSlide(input: AddChartSlideInput): Promise<SlideData> {
  const { deck_handle, title, chart_type, data, labels } = input;
  
  const slide: SlideData = {
    id: `slide_${deck_handle.slides.length + 1}`,
    slide_number: deck_handle.slides.length + 1,
    layout: 'chart',
    title,
    content: { chart_type, data, labels },
  };
  
  deck_handle.slides.push(slide);
  
  return slide;
}

/**
 * Save deck to PPTX file
 * 
 * @param input - Deck handle and output path
 * @returns Save result with file info
 */
export async function saveDeck(input: SaveDeckInput): Promise<SaveDeckOutput> {
  const { deck_handle, path: output_path } = input;
  
  try {
    // Ensure directory exists
    const dir = path.dirname(output_path);
    await fs.mkdir(dir, { recursive: true });
    
    // Create PowerPoint presentation using pptxgenjs
    const pres = new pptxgen();
    pres.title = deck_handle.title;
    pres.author = 'A2R Operator';
    
    // Add slides
    for (const slide of deck_handle.slides) {
      const pptxSlide = pres.addSlide();
      
      if (slide.layout === 'title') {
        // Title slide
        pptxSlide.addText(slide.title || '', { 
          x: 0.5, y: 1, w: '90%', fontSize: 32, bold: true, align: 'center' 
        });
        if (slide.content?.subtitle) {
          pptxSlide.addText(slide.content.subtitle, { 
            x: 0.5, y: 2, w: '90%', fontSize: 18, align: 'center' 
          });
        }
      } else if (slide.layout === 'bullets') {
        // Bullet points slide
        pptxSlide.addText(slide.title || '', { 
          x: 0.5, y: 0.5, fontSize: 24, bold: true 
        });
        if (slide.content?.bullets) {
          pptxSlide.addText(slide.content.bullets, { 
            x: 0.5, y: 1.5, w: '90%', fontSize: 14, bullet: true 
          });
        }
      } else if (slide.layout === 'chart') {
        // Chart slide (simplified)
        pptxSlide.addText(slide.title || '', { 
          x: 0.5, y: 0.5, fontSize: 20, bold: true 
        });
        pptxSlide.addText('Chart placeholder - full chart support coming soon', {
          x: 0.5, y: 1.5, fontSize: 12
        });
      }
    }
    
    // Save presentation
    await pres.writeFile({ fileName: output_path });
    
    const stats = await fs.stat(output_path);
    
    return {
      file_path: output_path,
      file_size: stats.size,
      slide_count: deck_handle.slides.length,
    };
  } catch (error: any) {
    throw new Error(`Failed to save deck: ${error.message}`);
  }
}

/**
 * Create receipt for deck creation
 * 
 * @param output - Save result
 * @param metadata - Additional metadata
 * @returns Receipt object
 */
export async function createReceipt(
  output: SaveDeckOutput,
  metadata: {
    source_workbook?: string;
    teacher_id?: string;
    course_id?: string;
  } = {}
): Promise<any> {
  return {
    id: `receipt_${Date.now()}`,
    type: 'powerpoint_created',
    created_at: new Date().toISOString(),
    output: output.file_path,
    slide_count: output.slide_count,
    file_size: output.file_size,
    metadata,
  };
}

// ============================================================================
// Tool Exports (for skill system)
// ============================================================================

export const powerpointTools = {
  createDeck,
  addTitleSlide,
  addBulletsSlide,
  addChartSlide,
  saveDeck,
  createReceipt,
};

export default powerpointTools;
