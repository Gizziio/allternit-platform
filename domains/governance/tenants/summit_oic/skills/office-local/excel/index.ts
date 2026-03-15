/**
 * Office Local - Excel Tools
 * 
 * File-based Excel operations (no live Excel required).
 * Uses xlsx library for reading Excel files.
 * 
 * @module summit.office-local.excel
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as XLSX from 'xlsx';

// ============================================================================
// Types
// ============================================================================

export interface WorkbookData {
  path: string;
  name: string;
  sheets: string[];
  data: Record<string, CellData[][]>;
}

export interface CellData {
  value: any;
  type: 'string' | 'number' | 'boolean' | 'date' | 'formula' | 'empty';
  formula?: string;
}

export interface ReadWorkbookInput {
  workbook_path: string;
  include_data?: boolean;
}

export interface ListSheetsInput {
  workbook_path: string;
}

export interface ReadRangeInput {
  workbook_path: string;
  sheet_name: string;
  range?: string;  // e.g., "A1:B10"
}

export interface SummarizeSheetInput {
  workbook_path: string;
  sheet_name: string;
  range?: string;
}

export interface SheetSummary {
  title: string;
  subtitle: string;
  row_count: number;
  column_count: number;
  headers: string[];
  data_types: Record<string, string>;
  summary_bullets: string[];
  numeric_summary?: Record<string, NumericColumnSummary>;
}

export interface NumericColumnSummary {
  min: number;
  max: number;
  avg: number;
  sum: number;
  count: number;
}

// ============================================================================
// Excel Tools
// ============================================================================

/**
 * Read Excel workbook
 * 
 * @param input - Workbook path and options
 * @returns Workbook data
 */
export async function readWorkbook(input: ReadWorkbookInput): Promise<WorkbookData> {
  const { workbook_path, include_data = false } = input;
  
  try {
    // Check file exists
    await fs.access(workbook_path);
    
    // Read workbook using xlsx library
    const workbook = XLSX.readFile(workbook_path);
    const sheets = workbook.SheetNames;
    
    const data: Record<string, CellData[][]> = {};
    if (include_data) {
      for (const sheetName of sheets) {
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        data[sheetName] = json.map((row: any[]) => 
          row.map(cell => ({
            value: cell,
            type: typeof cell === 'string' ? 'string' : 
                  typeof cell === 'number' ? 'number' : 
                  typeof cell === 'boolean' ? 'boolean' : 'empty',
          }))
        );
      }
    }
    
    return {
      path: workbook_path,
      name: path.basename(workbook_path),
      sheets,
      data,
    };
  } catch (error: any) {
    throw new Error(`Failed to read workbook: ${error.message}`);
  }
}

/**
 * List sheets in workbook
 * 
 * @param input - Workbook path
 * @returns Array of sheet names
 */
export async function listSheets(input: ListSheetsInput): Promise<string[]> {
  const { workbook_path } = input;
  
  try {
    // Check file exists
    await fs.access(workbook_path);
    
    // Read workbook using xlsx library
    const workbook = XLSX.readFile(workbook_path);
    return workbook.SheetNames;
  } catch (error: any) {
    throw new Error(`Failed to list sheets: ${error.message}`);
  }
}

/**
 * Read cell range from sheet
 * 
 * @param input - Workbook path, sheet name, and optional range
 * @returns 2D array of cell data
 */
export async function readRange(input: ReadRangeInput): Promise<CellData[][]> {
  const { workbook_path, sheet_name, range } = input;
  
  try {
    // Check file exists
    await fs.access(workbook_path);
    
    // Read workbook using xlsx library
    const workbook = XLSX.readFile(workbook_path);
    const sheet = workbook.Sheets[sheet_name];
    
    if (!sheet) {
      throw new Error(`Sheet "${sheet_name}" not found`);
    }
    
    // Convert to JSON
    const json = XLSX.utils.sheet_to_json(sheet, { header: 1, range });
    
    // Convert to CellData format
    return json.map((row: any[]) => 
      row.map(cell => ({
        value: cell,
        type: typeof cell === 'string' ? 'string' : 
              typeof cell === 'number' ? 'number' : 
              typeof cell === 'boolean' ? 'boolean' : 'empty',
      }))
    );
  } catch (error: any) {
    throw new Error(`Failed to read range: ${error.message}`);
  }
}

/**
 * Summarize sheet data
 * 
 * @param input - Workbook path, sheet name, and optional range
 * @returns Sheet summary with bullets for presentation
 */
export async function summarizeSheet(input: SummarizeSheetInput): Promise<SheetSummary> {
  const { workbook_path, sheet_name, range } = input;
  
  try {
    // Read the data
    const data = await readRange({ workbook_path, sheet_name, range });
    
    if (data.length === 0) {
      return {
        title: path.basename(workbook_path, '.xlsx'),
        subtitle: sheet_name,
        row_count: 0,
        column_count: 0,
        headers: [],
        data_types: {},
        summary_bullets: ['No data found in sheet'],
      };
    }
    
    // Extract headers (first row)
    const headers = data[0].map(cell => String(cell.value || ''));
    
    // Calculate statistics
    const rowCount = data.length - 1; // Exclude header
    const columnCount = headers.length;
    
    // Analyze data types
    const data_types: Record<string, string> = {};
    const numeric_summary: Record<string, NumericColumnSummary> = {};
    
    for (let col = 0; col < columnCount; col++) {
      const values = data.slice(1).map(row => row[col]?.value);
      const nonEmpty = values.filter(v => v !== null && v !== undefined && v !== '');
      
      // Determine type
      const types = new Set(nonEmpty.map(v => typeof v));
      data_types[headers[col]] = types.size === 1 ? Array.from(types)[0] : 'mixed';
      
      // Calculate numeric summary if applicable
      if (nonEmpty.every(v => typeof v === 'number')) {
        const nums = nonEmpty as number[];
        numeric_summary[headers[col]] = {
          min: Math.min(...nums),
          max: Math.max(...nums),
          avg: nums.reduce((a, b) => a + b, 0) / nums.length,
          sum: nums.reduce((a, b) => a + b, 0),
          count: nums.length,
        };
      }
    }
    
    // Generate summary bullets
    const summary_bullets: string[] = [
      `Contains ${rowCount} rows and ${columnCount} columns`,
      `Headers: ${headers.slice(0, 5).join(', ')}${headers.length > 5 ? '...' : ''}`,
    ];
    
    // Add numeric summaries
    for (const [col, summary] of Object.entries(numeric_summary)) {
      summary_bullets.push(`${col}: ${summary.min} - ${summary.max} (avg: ${summary.avg.toFixed(1)})`);
    }
    
    return {
      title: path.basename(workbook_path, '.xlsx'),
      subtitle: sheet_name,
      row_count: rowCount,
      column_count: columnCount,
      headers,
      data_types,
      summary_bullets,
      numeric_summary: Object.keys(numeric_summary).length > 0 ? numeric_summary : undefined,
    };
  } catch (error: any) {
    throw new Error(`Failed to summarize sheet: ${error.message}`);
  }
}

/**
 * Extract chart data from sheet
 * 
 * @param input - Workbook path and sheet name
 * @returns Chart data arrays
 */
export async function extractChartData(input: { workbook_path: string; sheet_name: string }): Promise<any[]> {
  // TODO: Implement chart extraction
  // This requires identifying chart objects in the workbook
  // and extracting their data sources
  
  console.warn('[extractChartData] Not yet implemented');
  return [];
}

// ============================================================================
// Tool Exports (for skill system)
// ============================================================================

export const excelTools = {
  readWorkbook,
  listSheets,
  readRange,
  summarizeSheet,
  extractChartData,
};

export default excelTools;
