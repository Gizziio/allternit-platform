/**
 * Create Sample Excel Test File
 * 
 * Creates a sample Excel workbook with sales data for testing.
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = '/Users/macbook/Desktop/allternit-workspace/allternit/tenants/summit_oic/tests/test-data';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'sample_sales_data.xlsx');

// Sample sales data
const salesData = [
  ['Month', 'Product', 'Region', 'Units Sold', 'Revenue', 'Cost', 'Profit'],
  ['January', 'Widget A', 'North', 150, 15000, 9000, 6000],
  ['January', 'Widget B', 'North', 200, 24000, 14000, 10000],
  ['January', 'Widget A', 'South', 175, 17500, 10500, 7000],
  ['January', 'Widget B', 'South', 225, 27000, 16000, 11000],
  ['February', 'Widget A', 'North', 160, 16000, 9600, 6400],
  ['February', 'Widget B', 'North', 210, 25200, 14700, 10500],
  ['February', 'Widget A', 'South', 180, 18000, 10800, 7200],
  ['February', 'Widget B', 'South', 240, 28800, 17000, 11800],
  ['March', 'Widget A', 'North', 170, 17000, 10200, 6800],
  ['March', 'Widget B', 'North', 220, 26400, 15400, 11000],
  ['March', 'Widget A', 'South', 190, 19000, 11400, 7600],
  ['March', 'Widget B', 'South', 250, 30000, 18000, 12000],
];

// Summary data
const summaryData = [
  ['Metric', 'Q1 Total', 'Q1 Average', 'Growth'],
  ['Total Units', 2370, 197.5, '+15%'],
  ['Total Revenue', 284900, 23741.67, '+12%'],
  ['Total Cost', 166600, 13883.33, '+8%'],
  ['Total Profit', 118300, 9858.33, '+18%'],
];

// Create workbook
const workbook = XLSX.utils.book_new();

// Add sales data sheet
const salesWorksheet = XLSX.utils.aoa_to_sheet(salesData);
XLSX.utils.book_append_sheet(workbook, salesWorksheet, 'Sales Data');

// Add summary sheet
const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Write file
XLSX.writeFile(workbook, OUTPUT_FILE);

console.log('✅ Sample Excel file created!');
console.log(`   Path: ${OUTPUT_FILE}`);
console.log(`   Sheets: Sales Data, Summary`);
console.log(`   Rows: ${salesData.length} (Sales), ${summaryData.length} (Summary)`);
