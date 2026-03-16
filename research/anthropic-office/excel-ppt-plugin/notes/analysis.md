# Plugin Analysis: Excel to PowerPoint

**Date:** March 13, 2026
**Analyst:** A2R Team

---

## TARGET DEFINITION

**Target plugin:** Anthropic Office Plugin (Excel → PowerPoint)
**Plugin type:** Cross-application Office automation
**What user can do:** Analyze Excel workbooks and automatically create PowerPoint presentations from the data
**What tools seem exposed:** Excel reader, data summarizer, chart extractor, PowerPoint creator, slide writer
**What inputs it asks for:** Workbook file, sheet/range selection, audience type, slide count, tone
**What outputs it creates:** Summary text, slide deck (PPTX), chart images, receipt/confirmation
**What A2R backend should implement this:** office-local (file-based) + office-win-bridge (live app control)

---

## PASS 1 — INSPECTION

### User Promise

> "Analyze your Excel data and create a professional PowerPoint deck automatically"

### Observed Files

*To be filled as we inspect*

### Observed Prompts

*To be filled*

### Observed Tools

*To be filled*

### Observed UX Flow

1. User selects/opens Excel workbook
2. User invokes plugin (sidebar or menu)
3. Plugin shows preview/summary of data
4. User confirms or adjusts settings
5. Plugin creates PowerPoint
6. User reviews and saves

---

## PASS 2 — EXTRACTION

### Inferred Tool Actions

```
Excel Operations:
- read_workbook(path)
- list_sheets(workbook)
- read_range(sheet, range)
- summarize_data(data)
- extract_chart_data(sheet)
- get_active_workbook()
- get_selected_range()

PowerPoint Operations:
- create_deck(title)
- add_title_slide(title, subtitle)
- add_bullets_slide(title, bullets)
- add_chart_slide(title, chart_data)
- save_deck(path)
- attach_powerpoint()
- create_slide(layout)
- write_slide_text(slide_id, text)
- insert_chart(slide_id, chart_data)
```

### Input Fields

| Field | Type | Required | Default |
|-------|------|----------|---------|
| workbook_path | string | Yes | - |
| sheet_name | string | No | First sheet |
| range | string | No | Used range |
| audience | string | No | General |
| max_slides | number | No | 5 |
| tone | string | No | Professional |
| include_charts | boolean | No | true |

### Output Fields

| Field | Type | Description |
|-------|------|-------------|
| summary | string | Data summary text |
| slide_outline | array | Slide structure |
| pptx_path | string | Path to created deck |
| slide_count | number | Number of slides |
| receipt | object | Creation receipt |

### Approvals/Checkpoints

1. ✅ Preview data summary
2. ✅ Confirm slide outline
3. ✅ Review before save

---

## PASS 3 — A2R MAPPING

| Observed Capability | A2R Tool | Backend |
|---------------------|----------|---------|
| Read workbook | office-local.excel.read-workbook | office-local |
| List sheets | office-local.excel.list-sheets | office-local |
| Read range | office-local.excel.read-range | office-local |
| Summarize data | office-local.excel.summarize-sheet | office-local |
| Extract chart | office-local.excel.extract-chart-data | office-local |
| Create deck | office-local.powerpoint.create-deck | office-local |
| Add title slide | office-local.powerpoint.add-title-slide | office-local |
| Add bullets slide | office-local.powerpoint.add-bullets-slide | office-local |
| Add chart slide | office-local.powerpoint.add-chart-slide | office-local |
| Save deck | office-local.powerpoint.save-deck | office-local |
| Attach Excel | office-win-bridge.excel.attach-excel | office-win-bridge |
| Get active workbook | office-win-bridge.excel.get-active-workbook | office-win-bridge |
| Get selected range | office-win-bridge.excel.get-selected-range | office-win-bridge |
| Attach PowerPoint | office-win-bridge.powerpoint.attach-powerpoint | office-win-bridge |
| Create slide | office-win-bridge.powerpoint.create-slide | office-win-bridge |
| Write slide text | office-win-bridge.powerpoint.write-slide-text | office-win-bridge |
| Insert chart | office-win-bridge.powerpoint.insert-chart | office-win-bridge |

---

## PASS 4 — IMPLEMENTATION PRIORITY

### NOW (MVP)

- [ ] office-local.excel.read-workbook
- [ ] office-local.excel.list-sheets
- [ ] office-local.excel.read-range
- [ ] office-local.excel.summarize-sheet
- [ ] office-local.powerpoint.create-deck
- [ ] office-local.powerpoint.add-title-slide
- [ ] office-local.powerpoint.add-bullets-slide
- [ ] office-local.powerpoint.save-deck

### LATER (V2)

- [ ] office-win-bridge.excel.attach-excel
- [ ] office-win-bridge.excel.get-active-workbook
- [ ] office-win-bridge.excel.get-selected-range
- [ ] office-win-bridge.powerpoint.attach-powerpoint
- [ ] office-win-bridge.powerpoint.create-slide
- [ ] office-win-bridge.powerpoint.write-slide-text
- [ ] office-win-bridge.powerpoint.insert-chart

### UNKNOWN

- [ ] Exact retry strategy
- [ ] Internal normalizers
- [ ] Admin deployment requirements

---

## GOLDEN WORKFLOW SPEC

### Skill: excel_to_ppt_report

**Input:**
- workbook_file (string, required)
- sheet_name (string, optional)
- range (string, optional)
- audience (string, optional)
- max_slides (number, optional)
- tone (string, optional)

**Steps:**
1. Read workbook
2. Resolve sheet/range (use defaults if not specified)
3. Summarize data
4. Create deck with title
5. Add title slide
6. Add summary slides (data overview)
7. Add chart slide if charts exist
8. Save deck to user's Documents folder
9. Create receipt

**Success:**
- PPTX file created
- Receipt generated with file path

---

## GAPS / UNKNOWNS

1. Exact chart extraction method
2. How they handle large datasets
3. Error recovery strategy
4. Auth/session management for cloud files

---

## NEXT ACTIONS

1. Implement office-local MVP (file-based)
2. Test with sample Excel files
3. Build office-win-bridge for live app control
4. Test with active Excel/PowerPoint instances

---

*Last Updated: March 13, 2026*
