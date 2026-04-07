/**
 * Excel to PowerPoint Report Skill
 * 
 * Reads an Excel workbook and creates a PowerPoint presentation
 * with a summary of the data.
 * 
 * @module summit.office-local.excel_to_ppt_report
 */

import * as path from 'path';
import * as excel from './excel';
import * as powerpoint from './powerpoint';

// ============================================================================
// Types
// ============================================================================

export interface ExcelToPptReportInput {
  /** Path to Excel workbook file */
  workbook_file: string;
  /** Sheet name (optional, default: first sheet) */
  sheet_name?: string;
  /** Cell range (optional, default: used range) */
  range?: string;
  /** Target audience (optional, default: "General") */
  audience?: string;
  /** Maximum slides (optional, default: 5) */
  max_slides?: number;
  /** Tone (optional, default: "Professional") */
  tone?: string;
  /** Output path (optional, default: same as workbook with .pptx) */
  output_path?: string;
}

export interface ExcelToPptReportOutput {
  /** Path to created PPTX file */
  pptx_path: string;
  /** Number of slides created */
  slide_count: number;
  /** Receipt object */
  receipt: any;
}

// ============================================================================
// Main Skill
// ============================================================================

/**
 * Create PowerPoint report from Excel data
 * 
 * @param input - Workbook path and options
 * @returns PPTX path, slide count, and receipt
 */
export async function excelToPptReport(input: ExcelToPptReportInput): Promise<ExcelToPptReportOutput> {
  const {
    workbook_file,
    sheet_name,
    range,
    audience = 'General',
    max_slides = 5,
    tone = 'Professional',
  } = input;
  
  console.log('[excelToPptReport] Starting Excel to PowerPoint conversion...');
  console.log(`  Workbook: ${workbook_file}`);
  console.log(`  Sheet: ${sheet_name || '(first sheet)'}`);
  console.log(`  Max slides: ${max_slides}`);
  
  // Step 1: Read workbook
  console.log('[excelToPptReport] Step 1: Reading workbook...');
  const workbook = await excel.readWorkbook({
    workbook_path: workbook_file,
    include_data: false,
  });
  console.log(`  Found ${workbook.sheets.length} sheets`);
  
  // Step 2: List sheets and resolve sheet name
  console.log('[excelToPptReport] Step 2: Listing sheets...');
  const sheets = await excel.listSheets({ workbook_path: workbook_file });
  const targetSheet = sheet_name || sheets[0];
  console.log(`  Using sheet: ${targetSheet}`);
  
  // Step 3: Summarize sheet data
  console.log('[excelToPptReport] Step 3: Summarizing sheet...');
  const summary = await excel.summarizeSheet({
    workbook_path: workbook_file,
    sheet_name: targetSheet,
    range,
  });
  console.log(`  Rows: ${summary.row_count}, Columns: ${summary.column_count}`);
  console.log(`  Summary bullets: ${summary.summary_bullets.length}`);
  
  // Step 4: Create PowerPoint deck
  console.log('[excelToPptReport] Step 4: Creating deck...');
  const deck = await powerpoint.createDeck({
    title: summary.title,
    subtitle: summary.subtitle,
  });
  
  // Step 5: Add summary slides
  console.log('[excelToPptReport] Step 5: Adding slides...');
  
  // Slide 1: Overview
  await powerpoint.addBulletsSlide({
    deck_handle: deck,
    title: 'Data Overview',
    bullets: [
      `Source: ${summary.title}`,
      `Sheet: ${summary.subtitle}`,
      `Rows: ${summary.row_count}`,
      `Columns: ${summary.column_count}`,
    ],
  });
  
  // Slide 2: Key Findings
  await powerpoint.addBulletsSlide({
    deck_handle: deck,
    title: 'Key Findings',
    bullets: summary.summary_bullets.slice(0, 5),
  });
  
  // Slide 3: Numeric Summary (if available)
  if (summary.numeric_summary) {
    const numericBullets: string[] = [];
    for (const [col, stats] of Object.entries(summary.numeric_summary)) {
      numericBullets.push(`${col}: ${stats.min} - ${stats.max} (avg: ${stats.avg.toFixed(1)})`);
    }
    
    await powerpoint.addBulletsSlide({
      deck_handle: deck,
      title: 'Numeric Summary',
      bullets: numericBullets.slice(0, 5),
    });
  }
  
  // Step 6: Determine output path
  const output_path = input.output_path || 
    path.join(path.dirname(workbook_file), `${path.basename(workbook_file, '.xlsx')}.pptx`);
  
  // Step 7: Save deck
  console.log('[excelToPptReport] Step 6: Saving deck...');
  const saveResult = await powerpoint.saveDeck({
    deck_handle: deck,
    path: output_path,
  });
  console.log(`  Saved to: ${saveResult.file_path}`);
  console.log(`  File size: ${saveResult.file_size} bytes`);
  console.log(`  Slide count: ${saveResult.slide_count}`);
  
  // Step 8: Create receipt
  console.log('[excelToPptReport] Step 7: Creating receipt...');
  const receipt = await powerpoint.createReceipt(saveResult, {
    source_workbook: workbook_file,
  });
  console.log(`  Receipt ID: ${receipt.id}`);
  
  console.log('[excelToPptReport] Complete!');
  
  return {
    pptx_path: saveResult.file_path,
    slide_count: saveResult.slide_count,
    receipt,
  };
}

// ============================================================================
// Skill Export
// ============================================================================

export default excelToPptReport;
