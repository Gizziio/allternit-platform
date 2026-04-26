# Reverse-Engineering Exercise Complete

**Date:** March 13, 2026  
**Target:** Anthropic Office Plugin (Excel → PowerPoint)  
**Status:** ✅ ANALYSIS COMPLETE → READY TO BUILD

---

## Deliverables Created

### 1. analysis.md ✅

**Location:** `research/anthropic-office/excel-ppt-plugin/notes/analysis.md`

**Contents:**
- Target definition (plugin type, user capabilities, inputs/outputs)
- User promise extraction
- Inferred tool actions
- Input/output field specifications
- Approval/checkpoint identification
- Instruction layer vs execution layer separation

**Key Insight:**
> The plugin separates "what to do" (instruction layer: summarize first, one slide per idea) from "how to do it" (execution layer: workbook reader, slide writer, chart extractor)

---

### 2. allternit-mapping.md ✅

**Location:** `research/anthropic-office/excel-ppt-plugin/extracted/allternit-mapping.md`

**Contents:**
- 17 capability mappings (Observed → Inferred → Allternit Tool → Backend)
- Golden workflow spec (excel_to_ppt_report)
- Future workflow spec (active_workbook_to_slide_deck)
- Existing Allternit code we can reuse
- Dependencies to research (xlsx, officegen, etc.)
- Implementation phases
- Success metrics

**Key Mapping:**
```
Read workbook summary
→ workbook + optional sheet/range
→ office-local.excel.read-workbook
→ office-local
```

---

### 3. implementation-priority.md ✅

**Location:** `research/anthropic-office/excel-ppt-plugin/extracted/implementation-priority.md`

**Contents:**
- Phase 1 (NOW): office-local MVP - 8 tools
- Phase 2 (LATER): office-win-bridge MVP - 8 tools
- Phase 3 (UNKNOWN): Chart support
- Build order (7-day plan)
- File structure to create
- Risks & mitigations
- Success metrics

**Key Priority:**
```
NOW:
  - office-local.excel.read-workbook
  - office-local.excel.list-sheets
  - office-local.excel.read-range
  - office-local.excel.summarize-sheet
  - office-local.powerpoint.create-deck
  - office-local.powerpoint.add-title-slide
  - office-local.powerpoint.add-bullets-slide
  - office-local.powerpoint.save-deck
```

---

## What We Extracted

### Tool Inventory (17 tools identified)

**office-local (8 tools):**
1. excel.read-workbook
2. excel.list-sheets
3. excel.read-range
4. excel.summarize-sheet
5. excel.extract-chart-data (LATER)
6. powerpoint.create-deck
7. powerpoint.add-title-slide
8. powerpoint.add-bullets-slide
9. powerpoint.add-chart-slide (LATER)
10. powerpoint.save-deck

**office-win-bridge (7 tools):**
1. excel.attach-excel
2. excel.get-active-workbook
3. excel.get-selected-range
4. powerpoint.attach-powerpoint
5. powerpoint.create-slide
6. powerpoint.write-slide-text
7. powerpoint.insert-chart

### Workflow Patterns (2 extracted)

**Pattern 1: excel_to_ppt_report (File-based MVP)**
```
Input: workbook_file, sheet_name?, range?, audience?, max_slides?, tone?
Steps: read → list → read → summarize → create → add slides → save → receipt
Output: pptx_path, slide_count, receipt
```

**Pattern 2: active_workbook_to_slide_deck (Live App V2)**
```
Input: goal, use_selected_range, presentation_name, max_slides
Steps: attach Excel → get workbook → get range → read → summarize → attach PPT → create slides → save → receipt
Output: pptx_path, slide_count, receipt
```

### Contract Shapes

**Input Contract:**
```typescript
{
  workbook_file: string;      // Required
  sheet_name?: string;        // Optional
  range?: string;             // Optional
  audience?: string;          // Optional
  max_slides?: number;        // Optional
  tone?: string;              // Optional
}
```

**Output Contract:**
```typescript
{
  pptx_path: string;          // Created file path
  slide_count: number;        // Number of slides
  receipt: Receipt;           // Audit trail
}
```

---

## What We're NOT Doing

### Avoiding Scope Creep

| Category | Decision | Reason |
|----------|----------|--------|
| Minified bundle decoding | ❌ Skip | Poor ROI, we have enough from visible files |
| Exact retry strategy | ❌ Unknown | Can design our own later |
| Internal normalizers | ❌ Unknown | Can infer from behavior |
| Proprietary orchestration | ❌ Unknown | Build our own simpler version |

### Focusing On

| Category | Priority | Action |
|----------|----------|--------|
| Visible tool names | ✅ High | Extracted 17 tools |
| Schemas | ✅ High | Defined input/output contracts |
| Prompts | ✅ Medium | Identified instruction layer |
| Flows | ✅ High | Mapped 2 workflows |
| UX checkpoints | ✅ High | Identified 3 approval points |

---

## Next Steps

### Immediate (Today)

1. ✅ Analysis complete
2. ✅ Allternit mapping complete
3. ✅ Implementation priority complete
4. ⏳ **Start Phase 1 implementation**

### This Week

1. Install dependencies (`xlsx`, `officegen`)
2. Implement 8 office-local tools
3. Create `excel_to_ppt_report` skill
4. Write tests
5. Test with sample files

### Next Week

1. Demo ready
2. Record video
3. Present to Summit

---

## Folder Structure Created

```
research/anthropic-office/excel-ppt-plugin/
├── raw/                      # (Empty - for raw artifacts if needed)
├── notes/
│   └── analysis.md           # ✅ Complete
└── extracted/
    ├── allternit-mapping.md        # ✅ Complete
    └── implementation-priority.md  # ✅ Complete
```

---

## Key Learnings

### What Worked Well

1. **Goal-first approach** - Writing the target definition at the top kept us focused
2. **Instruction vs Execution separation** - This was the most valuable distinction
3. **NOW/LATER/UNKNOWN tagging** - Prevented scope creep
4. **Single workflow focus** - One golden workflow, not ten

### What We Avoided

1. ❌ Copying their wording (we extracted patterns, not text)
2. ❌ Decoding minified bundles (poor ROI)
3. ❌ Analyzing all 5 plugins (focused on one)
4. ❌ Building 10 flows (building ONE first)

### What We Built Instead

1. ✅ Clear tool inventory (17 tools)
2. ✅ Defined contracts (input/output shapes)
3. ✅ Implementation map (what to build first)
4. ✅ Testable workflow spec

---

## Ready to Build

**We have everything we need to start implementation:**

- ✅ Tool list (17 tools)
- ✅ Workflow spec (excel_to_ppt_report)
- ✅ Input/output contracts
- ✅ Implementation priority (NOW/LATER/UNKNOWN)
- ✅ File structure to create
- ✅ 7-day build plan

**Next agent should:**
1. Open `implementation-priority.md`
2. Start with Phase 1, Day 1
3. Build `office-local.excel.read-workbook`
4. Test it
5. Move to next tool

---

*Reverse-Engineering Exercise Complete*  
*Created: March 13, 2026*  
*Status: READY FOR IMPLEMENTATION* 🚀
