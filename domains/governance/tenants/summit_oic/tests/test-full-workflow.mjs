/**
 * Full Workflow Test - Excel to PowerPoint
 * 
 * Tests the complete excel_to_ppt_report workflow.
 */

import excelToPptReportModule from '../dist/excel_to_ppt_report.js';
import * as fs from 'fs';
import * as path from 'path';

const excelToPptReport = excelToPptReportModule.excelToPptReport || excelToPptReportModule.default;

const TEST_DATA_DIR = '/Users/macbook/Desktop/allternit-workspace/allternit/tenants/summit_oic/tests/test-data';
const OUTPUT_DIR = '/Users/macbook/Desktop/allternit-workspace/allternit/tenants/summit_oic/tests/test-output';

async function runTest() {
  console.log('=== Excel to PowerPoint - Full Workflow Test ===\n');
  
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  const workbookPath = path.join(TEST_DATA_DIR, 'sample_sales_data.xlsx');
  const outputPath = path.join(OUTPUT_DIR, 'sales_presentation.pptx');
  
  console.log(`Input:  ${workbookPath}`);
  console.log(`Output: ${outputPath}\n`);
  
  try {
    // Run the workflow
    const result = await excelToPptReport({
      workbook_file: workbookPath,
      sheet_name: 'Sales Data',
      max_slides: 5,
      tone: 'Professional',
      output_path: outputPath,
    });
    
    console.log('\n=== TEST RESULTS ===\n');
    console.log('✅ Workflow completed successfully!\n');
    console.log(`PPTX Path: ${result.pptx_path}`);
    console.log(`Slide Count: ${result.slide_count}`);
    console.log(`Receipt ID: ${result.receipt.id}`);
    console.log(`Receipt Type: ${result.receipt.type}`);
    
    // Verify file exists
    if (fs.existsSync(result.pptx_path)) {
      const stats = fs.statSync(result.pptx_path);
      console.log(`\n✅ PPTX file created (${(stats.size / 1024).toFixed(2)} KB)`);
    } else {
      console.log('\n❌ PPTX file not found!');
    }
    
    console.log('\n=== TEST COMPLETE ===\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED\n');
    console.error('Error:', error.message);
    console.error('\nStack:', error.stack);
  }
}

runTest();
