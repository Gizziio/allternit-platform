# Implementation Priority: Excel to PowerPoint

**Date:** March 13, 2026  
**Target:** Summit Demo  
**Timeline:** 1 week for MVP

---

## PHASE 1: office-local MVP (NOW)

**Goal:** File-based Excel → PowerPoint conversion (no live Office required)

### Tools to Implement

#### Excel Tools (office-local/excel/)

| Priority | Tool | Input | Output | Status |
|----------|------|-------|--------|--------|
| P0 | read-workbook | workbook_path | workbook_data | TODO |
| P0 | list-sheets | workbook | sheet_names[] | TODO |
| P0 | read-range | sheet + range | cell_data[][] | TODO |
| P1 | summarize-sheet | cell_data | summary_text | TODO |
| P2 | extract-chart-data | sheet | chart_data[] | LATER |

**File:** `tenants/summit_oic/skills/office-local/excel/index.ts`

#### PowerPoint Tools (office-local/powerpoint/)

| Priority | Tool | Input | Output | Status |
|----------|------|-------|--------|--------|
| P0 | create-deck | title | deck_handle | TODO |
| P0 | add-title-slide | title + subtitle | slide_id | TODO |
| P0 | add-bullets-slide | title + bullets[] | slide_id | TODO |
| P1 | add-chart-slide | title + chart_data | slide_id | LATER |
| P0 | save-deck | deck_handle + path | file_path | TODO |

**File:** `tenants/summit_oic/skills/office-local/powerpoint/index.ts`

### Skill to Create

**Skill:** `excel_to_ppt_report`

**File:** `tenants/summit_oic/skills/office-local/excel_to_ppt_report.ts`

**Spec:**
```typescript
interface ExcelToPptReportInput {
  workbook_file: string;      // Path to .xlsx file
  sheet_name?: string;        // Optional, default: first sheet
  range?: string;             // Optional, default: used range
  audience?: string;          // Optional, default: "General"
  max_slides?: number;        // Optional, default: 5
  tone?: string;              // Optional, default: "Professional"
}

interface ExcelToPptReportOutput {
  pptx_path: string;
  slide_count: number;
  receipt: Receipt;
}
```

### Dependencies to Install

```bash
cd tenants/summit_oic
npm install xlsx officegen
```

### Test Plan

**Test File:** `tenants/summit_oic/tests/excel_to_ppt.test.ts`

```typescript
test('excel_to_ppt_report creates presentation from workbook', async () => {
  const result = await excelToPptReport({
    workbook_file: '/test-data/sample.xlsx',
    max_slides: 3,
  });
  
  expect(result.pptx_path).toBeDefined();
  expect(fs.existsSync(result.pptx_path)).toBe(true);
  expect(result.receipt).toBeDefined();
});
```

### Acceptance Criteria

- [ ] Can read .xlsx file
- [ ] Can list sheets
- [ ] Can read cell range
- [ ] Can summarize data
- [ ] Can create .pptx with 3+ slides
- [ ] Receipt generated with file path
- [ ] Test passes

---

## PHASE 2: office-win-bridge MVP (LATER)

**Goal:** Live Excel/PowerPoint automation (Windows only)

### Tools to Implement

#### Excel Bridge (office-win-bridge/excel/)

| Priority | Tool | Input | Output | Status |
|----------|------|-------|--------|--------|
| P1 | attach-excel | - | excel_app_handle | LATER |
| P1 | get-active-workbook | excel_handle | workbook_handle | LATER |
| P1 | get-selected-range | workbook | range_address | LATER |

#### PowerPoint Bridge (office-win-bridge/powerpoint/)

| Priority | Tool | Input | Output | Status |
|----------|------|-------|--------|--------|
| P1 | attach-powerpoint | - | ppt_app_handle | LATER |
| P1 | create-slide | layout | slide_id | LATER |
| P1 | write-slide-text | slide_id + text | success | LATER |
| P1 | insert-chart | slide_id + chart | success | LATER |
| P1 | save-presentation | path | file_path | LATER |

### Skill to Create

**Skill:** `active_workbook_to_slide_deck`

**File:** `tenants/summit_oic/skills/office-win-bridge/active_workbook_to_slide_deck.ts`

### Dependencies

- Windows only
- Office desktop installed
- COM automation library

### Acceptance Criteria

- [ ] Can attach to running Excel
- [ ] Can get active workbook
- [ ] Can get selected range
- [ ] Can attach to running PowerPoint
- [ ] Can create slide
- [ ] Can write text to slide
- [ ] Receipt generated

---

## PHASE 3: Chart Support (UNKNOWN)

**Goal:** Extract and recreate charts from Excel in PowerPoint

### Research Needed

1. Can we extract chart data without live Excel?
2. What chart types to support initially?
3. How to recreate charts in PowerPoint?

### Tools (TBD)

- office-local.excel.extract-chart-data
- office-local.powerpoint.add-chart-slide
- office-win-bridge.powerpoint.insert-chart

---

## BUILD ORDER

### Day 1-2: Excel Reading

1. Install `xlsx` library
2. Implement `read-workbook`
3. Implement `list-sheets`
4. Implement `read-range`
5. Write tests

### Day 3-4: PowerPoint Creation

1. Install `officegen` or `pptxgenjs`
2. Implement `create-deck`
3. Implement `add-title-slide`
4. Implement `add-bullets-slide`
5. Implement `save-deck`
6. Write tests

### Day 5: Skill Integration

1. Create `excel_to_ppt_report` skill
2. Wire tools together
3. Add receipt generation
4. Write integration test

### Day 6: Testing & Polish

1. Test with real Excel files
2. Fix bugs
3. Add error handling
4. Document usage

### Day 7: Demo Prep

1. Create sample Excel file
2. Record demo
3. Prepare presentation

---

## FILES TO CREATE

### Phase 1 Structure

```
tenants/summit_oic/skills/office-local/
├── excel/
│   ├── index.ts              # Excel tools
│   ├── read-workbook.ts
│   ├── list-sheets.ts
│   ├── read-range.ts
│   └── summarize-sheet.ts
│
├── powerpoint/
│   ├── index.ts              # PowerPoint tools
│   ├── create-deck.ts
│   ├── add-title-slide.ts
│   ├── add-bullets-slide.ts
│   └── save-deck.ts
│
├── excel_to_ppt_report.ts    # Main skill
└── index.ts                  # Exports
```

---

## RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Library compatibility | High | Test libraries before committing |
| Chart extraction hard | Medium | Defer to Phase 3 |
| PowerPoint formatting | Low | Use simple templates initially |
| Large files slow | Medium | Add pagination, warn users |
| Mac incompatibility | Low | Document Windows-only for now |

---

## SUCCESS METRICS

### MVP (Phase 1)

- ✅ Reads .xlsx file
- ✅ Creates .pptx with 3+ slides
- ✅ Receipt generated
- ✅ Test passes
- ✅ Demo ready

### V2 (Phase 2)

- ✅ Live Excel automation
- ✅ Live PowerPoint automation
- ✅ Selected range support
- ✅ Windows demo

### V3 (Phase 3)

- ✅ Chart extraction
- ✅ Chart recreation in PPT
- ✅ Multiple chart types

---

*Created: March 13, 2026*  
*Next: Start Phase 1 implementation*
