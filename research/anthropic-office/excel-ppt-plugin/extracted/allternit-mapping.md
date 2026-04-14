# A2R Mapping: Excel to PowerPoint Plugin

**Source:** Anthropic Office Plugin Analysis  
**Date:** March 13, 2026  
**Target:** Summit Demo (Excel → PowerPoint automation)

---

## Capability Mapping Table

| # | Observed Plugin Capability | Inferred Contract | A2R Tool Name | Backend | Priority |
|---|---------------------------|-------------------|---------------|---------|----------|
| 1 | Open/read Excel workbook | workbook_path → workbook_data | office-local.excel.read-workbook | office-local | NOW |
| 2 | List sheets in workbook | workbook → sheet_names[] | office-local.excel.list-sheets | office-local | NOW |
| 3 | Read cell range | sheet + range → cell_data[][] | office-local.excel.read-range | office-local | NOW |
| 4 | Summarize sheet data | cell_data → summary_text | office-local.excel.summarize-sheet | office-local | NOW |
| 5 | Extract chart data | sheet → chart_data[] | office-local.excel.extract-chart-data | office-local | LATER |
| 6 | Create PowerPoint deck | title → deck_handle | office-local.powerpoint.create-deck | office-local | NOW |
| 7 | Add title slide | title + subtitle → slide_id | office-local.powerpoint.add-title-slide | office-local | NOW |
| 8 | Add bullet slide | title + bullets[] → slide_id | office-local.powerpoint.add-bullets-slide | office-local | NOW |
| 9 | Add chart slide | title + chart_data → slide_id | office-local.powerpoint.add-chart-slide | office-local | LATER |
| 10 | Save deck | deck_handle + path → file_path | office-local.powerpoint.save-deck | office-local | NOW |
| 11 | Attach to running Excel | - → excel_app_handle | office-win-bridge.excel.attach-excel | office-win-bridge | LATER |
| 12 | Get active workbook | excel_handle → workbook_handle | office-win-bridge.excel.get-active-workbook | office-win-bridge | LATER |
| 13 | Get selected range | workbook → range_address | office-win-bridge.excel.get-selected-range | office-win-bridge | LATER |
| 14 | Attach to running PowerPoint | - → ppt_app_handle | office-win-bridge.powerpoint.attach-powerpoint | office-win-bridge | LATER |
| 15 | Create slide in active deck | layout → slide_id | office-win-bridge.powerpoint.create-slide | office-win-bridge | LATER |
| 16 | Write text to slide | slide_id + text → success | office-win-bridge.powerpoint.write-slide-text | office-win-bridge | LATER |
| 17 | Insert chart in slide | slide_id + chart → success | office-win-bridge.powerpoint.insert-chart | office-win-bridge | LATER |

---

## Workflow Extraction

### Golden Workflow: excel_to_ppt_report

```
INPUT:
  - workbook_file: string (required)
  - sheet_name: string (optional, default: first sheet)
  - range: string (optional, default: used range)
  - audience: string (optional, default: "General")
  - max_slides: number (optional, default: 5)
  - tone: string (optional, default: "Professional")

STEPS:
  1. office-local.excel.read-workbook(workbook_file)
  2. office-local.excel.list-sheets(workbook)
  3. office-local.excel.read-range(sheet, range)
  4. office-local.excel.summarize-sheet(data)
  5. office-local.powerpoint.create-deck(summary.title)
  6. office-local.powerpoint.add-title-slide(summary.title, summary.subtitle)
  7. office-local.powerpoint.add-bullets-slide("Overview", summary.bullets)
  8. office-local.powerpoint.add-bullets-slide("Key Findings", findings)
  9. office-local.powerpoint.save-deck(path)
  10. receipt.create({ type: "excel_to_ppt", output: path })

OUTPUT:
  - pptx_path: string
  - slide_count: number
  - receipt: object

SUCCESS CRITERIA:
  - PPTX file exists at path
  - Receipt created with metadata
```

### Future Workflow: active_workbook_to_slide_deck

```
INPUT:
  - goal: string (required)
  - use_selected_range: boolean (default: true)
  - presentation_name: string (optional)
  - max_slides: number (default: 5)

STEPS:
  1. office-win-bridge.excel.attach-excel()
  2. office-win-bridge.excel.get-active-workbook()
  3. office-win-bridge.excel.get-selected-range(workbook)
  4. office-local.excel.read-range(range)
  5. office-local.excel.summarize-sheet(data)
  6. office-win-bridge.powerpoint.attach-powerpoint()
  7. office-win-bridge.powerpoint.create-slide("title")
  8. office-win-bridge.powerpoint.write-slide-text(slide_id, text)
  9. office-win-bridge.powerpoint.save-presentation(path)
  10. receipt.create({ type: "active_workbook_to_slide", output: path })

OUTPUT:
  - pptx_path: string
  - slide_count: number
  - receipt: object
```

---

## Existing A2R Code We Can Use

From codebase search:

### Export Utilities (6-ui/a2r-platform/src/a2r-os/utils/ExportUtilities.ts)

```typescript
// Already exists:
- exportToExcelHTML() - Export DataGrid to Excel-compatible HTML
- downloadExcel() - Download Excel file
- exportToPDF() - Export to PDF
```

### File Type Detection (6-ui/a2r-platform/src/lib/attachments/extract-text.ts)

```typescript
// Already exists:
- .xlsx, .xls → 'excel'
- .pptx, .ppt → 'powerpoint'
- .docx, .doc → 'word'
```

### What We Need to Build

1. **office-local** backend (file-based, no live Office required)
   - Excel reader (use existing library or build simple xlsx parser)
   - PowerPoint creator (use officegen or similar library)

2. **office-win-bridge** backend (live Office app control)
   - Excel COM automation (Windows only)
   - PowerPoint COM automation (Windows only)

---

## Implementation Phases

### Phase 1: office-local MVP (THIS WEEK)

**Goal:** File-based Excel → PowerPoint conversion

**Tools to build:**
1. office-local.excel.read-workbook
2. office-local.excel.list-sheets
3. office-local.excel.read-range
4. office-local.excel.summarize-sheet
5. office-local.powerpoint.create-deck
6. office-local.powerpoint.add-title-slide
7. office-local.powerpoint.add-bullets-slide
8. office-local.powerpoint.save-deck

**Test:** Upload .xlsx → Download .pptx

### Phase 2: office-win-bridge MVP (NEXT WEEK)

**Goal:** Live Excel/PowerPoint automation

**Tools to build:**
1. office-win-bridge.excel.attach-excel
2. office-win-bridge.excel.get-active-workbook
3. office-win-bridge.excel.get-selected-range
4. office-win-bridge.powerpoint.attach-powerpoint
5. office-win-bridge.powerpoint.create-slide
6. office-win-bridge.powerpoint.write-slide-text

**Test:** Selected Excel range → New PowerPoint slide

### Phase 3: Chart Support (LATER)

**Tools to build:**
1. office-local.excel.extract-chart-data
2. office-local.powerpoint.add-chart-slide
3. office-win-bridge.powerpoint.insert-chart

---

## Dependencies to Research

### For office-local (File-based)

| Library | Purpose | License |
|---------|---------|---------|
| `xlsx` (SheetJS) | Read Excel files | Apache 2.0 |
| `officegen` | Create PowerPoint | MIT |
| `pptxgenjs` | Create PowerPoint | MIT |
| `exceljs` | Read/Write Excel | MIT |

### For office-win-bridge (Windows COM)

| Technology | Purpose | Platform |
|------------|---------|----------|
| `excel-dna` | Excel COM automation | Windows |
| `office-js` | Office add-ins | Cross-platform |
| `node-win32ole` | Windows OLE automation | Windows |
| `powershell` | Native Windows automation | Windows |

---

## Risks / Unknowns

1. **Chart extraction** - May require live Excel for full fidelity
2. **Large datasets** - Need pagination/streaming for big files
3. **Formatting preservation** - May lose complex formatting in conversion
4. **Mac compatibility** - COM automation is Windows-only
5. **Office 365 vs desktop** - Different APIs for cloud vs local

---

## Success Metrics

### Phase 1 (office-local)
- [ ] Can read .xlsx file
- [ ] Can summarize data
- [ ] Can create .pptx with 3+ slides
- [ ] Receipt generated

### Phase 2 (office-win-bridge)
- [ ] Can attach to running Excel
- [ ] Can read selected range
- [ ] Can create slide in running PowerPoint
- [ ] Receipt generated

### Phase 3 (Chart support)
- [ ] Can extract chart data from Excel
- [ ] Can create chart slide in PowerPoint
- [ ] Chart renders correctly

---

*Created: March 13, 2026*  
*Next: Build Phase 1 MVP*
