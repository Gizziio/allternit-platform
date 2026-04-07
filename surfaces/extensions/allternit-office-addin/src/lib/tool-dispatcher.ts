/**
 * Tool Dispatcher — converts a structured tool call into executable Office.js code.
 *
 * Each tool name maps to a code template that uses the args injected into
 * the template. The generated code is run via executeCode() in code-executor.ts.
 *
 * Pattern rules:
 * - All strings from tool args are escaped via escStr() before interpolation.
 * - Read tools return JSON.stringify(result) so the output is captured as a string.
 * - Write/mutation tools return a human-readable confirmation string.
 */

import type { ParsedToolCall } from './tool-schemas'

// ── Safety helper ────────────────────────────────────────────────────────────

/** Escape a string for safe interpolation into a double-quoted JS string literal */
function escStr(val: unknown): string {
  if (val === undefined || val === null) return ''
  return String(val)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
}

function strArg(args: Record<string, unknown>, key: string, fallback = ''): string {
  return typeof args[key] === 'string' ? escStr(args[key]) : escStr(fallback)
}

function boolArg(args: Record<string, unknown>, key: string, fallback = false): boolean {
  return typeof args[key] === 'boolean' ? (args[key] as boolean) : fallback
}

function numArg(args: Record<string, unknown>, key: string, fallback = 0): number {
  return typeof args[key] === 'number' ? (args[key] as number) : fallback
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Returns Office.js code (as a string) that implements the given tool call.
 * Throws if the tool name is not recognized.
 */
export function buildToolCallCode(call: ParsedToolCall): string {
  const { name, arguments: args } = call

  switch (name) {
    // ── Excel ──────────────────────────────────────────────────────────────

    case 'excel_read_range': {
      const address = strArg(args, 'address', 'used')
      const includeFormulas = boolArg(args, 'includeFormulas')
      const includeNumberFormat = boolArg(args, 'includeNumberFormat')
      const rangeExpr = address === 'used'
        ? 'sheet.getUsedRange()'
        : `sheet.getRange("${address}")`
      const loadProps = ['values']
      if (includeFormulas) loadProps.push('formulas')
      if (includeNumberFormat) loadProps.push('numberFormat')
      return `
return await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = ${rangeExpr};
  range.load([${loadProps.map((p) => `"${p}"`).join(', ')}]);
  await context.sync();
  const result = { values: range.values };
  ${includeFormulas ? 'result.formulas = range.formulas;' : ''}
  ${includeNumberFormat ? 'result.numberFormat = range.numberFormat;' : ''}
  return JSON.stringify(result);
});`
    }

    case 'excel_write_range': {
      const address = strArg(args, 'address')
      const values = args['values']
      const numberFormat = typeof args['numberFormat'] === 'string' ? args['numberFormat'] : null
      return `
return await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("${address}");
  range.values = ${JSON.stringify(values)};
  ${numberFormat ? `range.numberFormat = "${escStr(numberFormat)}";` : ''}
  await context.sync();
  return "Written to ${address}";
});`
    }

    case 'excel_get_sheet_names': {
      const includeHidden = boolArg(args, 'includeHidden')
      return `
return await Excel.run(async (context) => {
  const sheets = context.workbook.worksheets;
  sheets.load("items/name,items/visibility");
  await context.sync();
  const names = sheets.items
    ${includeHidden ? '' : '.filter(s => s.visibility === Excel.SheetVisibility.visible)'}
    .map(s => s.name);
  return JSON.stringify(names);
});`
    }

    case 'excel_create_chart': {
      const dataAddress = strArg(args, 'dataAddress')
      const chartType = strArg(args, 'chartType', 'columnClustered')
      const title = strArg(args, 'title')
      const seriesBy = strArg(args, 'seriesBy', 'columns')
      const seriesByEnum = seriesBy === 'rows' ? 'Excel.ChartSeriesBy.rows' : 'Excel.ChartSeriesBy.columns'
      return `
return await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const dataRange = sheet.getRange("${dataAddress}");
  const chart = sheet.charts.add(Excel.ChartType.${chartType}, dataRange, ${seriesByEnum});
  chart.title.text = "${title}";
  chart.setPosition("A1");
  await context.sync();
  return "Chart created: ${title}";
});`
    }

    case 'excel_create_table': {
      const address = strArg(args, 'address', 'used')
      const tableName = strArg(args, 'tableName', 'Table1')
      const style = strArg(args, 'style', 'TableStyleMedium2')
      const hasHeaders = boolArg(args, 'hasHeaders', true)
      const rangeExpr = address === 'used'
        ? 'sheet.getUsedRange()'
        : `sheet.getRange("${address}")`
      return `
return await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = ${rangeExpr};
  const table = sheet.tables.add(range, ${hasHeaders});
  table.name = "${tableName}";
  table.style = "${style}";
  await context.sync();
  return "Table created: ${tableName}";
});`
    }

    case 'excel_apply_format': {
      const address = strArg(args, 'address')
      const numberFormat = typeof args['numberFormat'] === 'string' ? args['numberFormat'] : null
      const fontColor = typeof args['fontColor'] === 'string' ? args['fontColor'] : null
      const fillColor = typeof args['fillColor'] === 'string' ? args['fillColor'] : null
      const bold = typeof args['bold'] === 'boolean' ? args['bold'] : null
      const autofitColumns = boolArg(args, 'autofitColumns')
      return `
return await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("${address}");
  ${numberFormat ? `range.numberFormat = "${escStr(numberFormat)}";` : ''}
  ${fontColor ? `range.format.font.color = "${escStr(fontColor)}";` : ''}
  ${fillColor ? `range.format.fill.color = "${escStr(fillColor)}";` : ''}
  ${bold !== null ? `range.format.font.bold = ${bold};` : ''}
  ${autofitColumns ? 'range.format.autofitColumns();' : ''}
  await context.sync();
  return "Format applied to ${address}";
});`
    }

    case 'excel_add_data_validation': {
      const address = strArg(args, 'address')
      const type = strArg(args, 'type', 'list')
      const listSource = typeof args['listSource'] === 'string' ? args['listSource'] : null
      const formula1 = typeof args['formula1'] === 'string' ? args['formula1'] : null
      const formula2 = typeof args['formula2'] === 'string' ? args['formula2'] : null
      const operator = typeof args['operator'] === 'string' ? args['operator'] : 'between'
      const errorTitle = strArg(args, 'errorTitle', 'Invalid Entry')
      const errorMessage = strArg(args, 'errorMessage', '')
      const alertStyle = strArg(args, 'alertStyle', 'stop')

      let ruleSnippet = ''
      if (type === 'list' && listSource) {
        const isRange = listSource.startsWith('=')
        ruleSnippet = isRange
          ? `dv.rule = { list: { inCellDropDown: true, source: "${escStr(listSource)}" } };`
          : `dv.rule = { list: { inCellDropDown: true, source: "${escStr(listSource)}" } };`
      } else if (type === 'wholeNumber' || type === 'decimal') {
        ruleSnippet = `dv.rule = { ${type}: { operator: Excel.DataValidationOperator.${operator}, formula1: "${escStr(formula1 ?? '0')}"${formula2 ? `, formula2: "${escStr(formula2)}"` : ''} } };`
      } else if (type === 'date') {
        ruleSnippet = `dv.rule = { date: { operator: Excel.DataValidationOperator.${operator}, formula1: "${escStr(formula1 ?? '')}"${formula2 ? `, formula2: "${escStr(formula2)}"` : ''} } };`
      } else if (type === 'textLength') {
        ruleSnippet = `dv.rule = { textLength: { operator: Excel.DataValidationOperator.${operator}, formula1: "${escStr(formula1 ?? '0')}"${formula2 ? `, formula2: "${escStr(formula2)}"` : ''} } };`
      } else if (type === 'custom') {
        ruleSnippet = `dv.rule = { custom: { formula: "${escStr(formula1 ?? '')}" } };`
      }

      return `
return await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const range = sheet.getRange("${address}");
  const dv = range.dataValidation;
  ${ruleSnippet}
  dv.errorAlert = {
    showAlert: true,
    style: Excel.DataValidationAlertStyle.${alertStyle},
    title: "${errorTitle}",
    message: "${errorMessage}",
  };
  await context.sync();
  return "Data validation applied to ${address}";
});`
    }

    case 'excel_run_formula': {
      const formula = strArg(args, 'formula')
      const tempAddress = strArg(args, 'tempAddress', 'Z1')
      return `
return await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const cell = sheet.getRange("${tempAddress}");
  cell.formulas = [["${formula}"]];
  await context.sync();
  cell.load("values");
  await context.sync();
  const result = cell.values[0][0];
  cell.clear(Excel.ClearApplyTo.contents);
  await context.sync();
  return JSON.stringify({ result, formula: "${formula}" });
});`
    }

    case 'excel_add_worksheet': {
      const sheetName = strArg(args, 'name')
      const position = typeof args['position'] === 'number' ? args['position'] : null
      const tabColor = typeof args['tabColor'] === 'string' ? args['tabColor'] : null
      const activate = boolArg(args, 'activate', true)
      return `
return await Excel.run(async (context) => {
  const newSheet = context.workbook.worksheets.add("${sheetName}");
  ${position !== null ? `newSheet.position = ${position};` : ''}
  ${tabColor ? `newSheet.tabColor = "${escStr(tabColor)}";` : ''}
  ${activate ? 'newSheet.activate();' : ''}
  await context.sync();
  return "Worksheet added: ${sheetName}";
});`
    }

    case 'excel_delete_rows': {
      const condition = strArg(args, 'condition', 'blank')
      const columnIndex = numArg(args, 'columnIndex', 0)
      const matchValue = strArg(args, 'matchValue', '')
      const startRow = numArg(args, 'startRow', 1)
      return `
return await Excel.run(async (context) => {
  const sheet = context.workbook.worksheets.getActiveWorksheet();
  const usedRange = sheet.getUsedRange();
  usedRange.load(["values", "rowCount", "rowIndex"]);
  await context.sync();

  const rowsToDelete = [];
  for (let i = ${startRow}; i < usedRange.rowCount; i++) {
    const row = usedRange.values[i];
    const shouldDelete =
      "${condition}" === "blank" ? row.every(cell => cell === "" || cell === null || cell === undefined) :
      "${condition}" === "valueMatch" ? String(row[${columnIndex}]) === "${matchValue}" :
      "${condition}" === "duplicate" ? (() => {
        // duplicate check — compare against all previous rows
        const cellVal = row[${columnIndex}];
        for (let j = ${startRow}; j < i; j++) {
          if (usedRange.values[j][${columnIndex}] === cellVal) return true;
        }
        return false;
      })() : false;
    if (shouldDelete) rowsToDelete.push(usedRange.rowIndex + i);
  }

  // Delete from bottom to top to preserve row indices
  rowsToDelete.reverse();
  for (const rowIdx of rowsToDelete) {
    sheet.getRangeByIndexes(rowIdx, 0, 1, usedRange.columnCount).delete(Excel.DeleteShiftDirection.up);
  }
  await context.sync();
  return "Deleted " + rowsToDelete.length + " rows";
});`
    }

    // ── PowerPoint ─────────────────────────────────────────────────────────

    case 'ppt_get_slide_count': {
      return `
return await PowerPoint.run(async (context) => {
  context.presentation.slides.load("items");
  await context.sync();
  return JSON.stringify({ count: context.presentation.slides.items.length });
});`
    }

    case 'ppt_read_slide_text': {
      const slideIndex = numArg(args, 'slideIndex', 0)
      return `
return await PowerPoint.run(async (context) => {
  context.presentation.slides.load("items");
  await context.sync();
  const slide = context.presentation.slides.items[${slideIndex}];
  if (!slide) throw new Error("Slide index ${slideIndex} out of range");
  slide.shapes.load("items");
  await context.sync();
  slide.shapes.items.forEach(shape => shape.textFrame.load("text"));
  await context.sync();
  const shapes = slide.shapes.items.map(s => ({
    name: s.name,
    text: s.textFrame.text,
  }));
  return JSON.stringify(shapes);
});`
    }

    case 'ppt_write_slide_text': {
      const slideIndex = numArg(args, 'slideIndex', 0)
      const title = typeof args['title'] === 'string' ? args['title'] : null
      const body = typeof args['body'] === 'string' ? args['body'] : null
      return `
return await PowerPoint.run(async (context) => {
  context.presentation.slides.load("items");
  await context.sync();
  const slide = context.presentation.slides.items[${slideIndex}];
  if (!slide) throw new Error("Slide index ${slideIndex} out of range");
  slide.shapes.load("items/name,items/placeholderFormat");
  await context.sync();
  slide.shapes.items.forEach(s => s.textFrame.load("text"));
  await context.sync();
  for (const shape of slide.shapes.items) {
    const phType = shape.placeholderFormat?.type;
    if (${title !== null ? 'true' : 'false'} && (phType === PowerPoint.PlaceholderType.title || phType === PowerPoint.PlaceholderType.centeredTitle || shape.name.toLowerCase().includes("title"))) {
      shape.textFrame.text = "${title !== null ? escStr(title) : ''}";
    }
    if (${body !== null ? 'true' : 'false'} && (phType === PowerPoint.PlaceholderType.body || phType === PowerPoint.PlaceholderType.object || shape.name.toLowerCase().includes("content"))) {
      shape.textFrame.text = "${body !== null ? escStr(body) : ''}";
    }
  }
  await context.sync();
  return "Slide ${slideIndex} updated";
});`
    }

    case 'ppt_add_slide': {
      const title = typeof args['title'] === 'string' ? args['title'] : null
      const body = typeof args['body'] === 'string' ? args['body'] : null
      return `
return await PowerPoint.run(async (context) => {
  context.presentation.slides.load("items");
  await context.sync();
  context.presentation.slides.add();
  await context.sync();
  context.presentation.slides.load("items");
  await context.sync();
  const newSlide = context.presentation.slides.items[context.presentation.slides.items.length - 1];
  newSlide.shapes.load("items/name,items/placeholderFormat");
  await context.sync();
  newSlide.shapes.items.forEach(s => s.textFrame.load("text"));
  await context.sync();
  ${title !== null ? `
  for (const shape of newSlide.shapes.items) {
    const phType = shape.placeholderFormat?.type;
    if (phType === PowerPoint.PlaceholderType.title || phType === PowerPoint.PlaceholderType.centeredTitle || shape.name.toLowerCase().includes("title")) {
      shape.textFrame.text = "${escStr(title)}";
      break;
    }
  }` : ''}
  ${body !== null ? `
  for (const shape of newSlide.shapes.items) {
    const phType = shape.placeholderFormat?.type;
    if (phType === PowerPoint.PlaceholderType.body || phType === PowerPoint.PlaceholderType.object || shape.name.toLowerCase().includes("content")) {
      shape.textFrame.text = "${escStr(body)}";
      break;
    }
  }` : ''}
  await context.sync();
  return "Slide added at index " + (context.presentation.slides.items.length - 1);
});`
    }

    case 'ppt_delete_slide': {
      const slideIndex = numArg(args, 'slideIndex', 0)
      return `
return await PowerPoint.run(async (context) => {
  context.presentation.slides.load("items");
  await context.sync();
  if (context.presentation.slides.items.length <= 1) {
    throw new Error("Cannot delete the only slide in the presentation");
  }
  const slide = context.presentation.slides.items[${slideIndex}];
  if (!slide) throw new Error("Slide index ${slideIndex} out of range");
  slide.delete();
  await context.sync();
  return "Slide ${slideIndex} deleted";
});`
    }

    case 'ppt_read_all_titles': {
      return `
return await PowerPoint.run(async (context) => {
  context.presentation.slides.load("items");
  await context.sync();
  context.presentation.slides.items.forEach(slide => slide.shapes.load("items/name,items/placeholderFormat"));
  await context.sync();
  context.presentation.slides.items.forEach(slide =>
    slide.shapes.items.forEach(s => s.textFrame.load("text"))
  );
  await context.sync();
  const titles = context.presentation.slides.items.map((slide, idx) => {
    const titleShape = slide.shapes.items.find(s => {
      const phType = s.placeholderFormat?.type;
      return phType === PowerPoint.PlaceholderType.title || phType === PowerPoint.PlaceholderType.centeredTitle || s.name.toLowerCase().includes("title");
    });
    return { index: idx, title: titleShape?.textFrame.text ?? "" };
  });
  return JSON.stringify(titles);
});`
    }

    case 'ppt_set_notes': {
      // PowerPoint.Slide.notes does not exist at PowerPointApi 1.3.
      // The Notes slide body is only accessible via NotesSlide shapes (API 1.8+).
      // Return a clear not-supported message so the AI can inform the user.
      const slideIndex = numArg(args, 'slideIndex', 0)
      const notes = strArg(args, 'notes', '')
      return `
return await PowerPoint.run(async (context) => {
  // Verify the slide index is valid before reporting unsupported
  context.presentation.slides.load("items");
  await context.sync();
  if (${slideIndex} >= context.presentation.slides.items.length) {
    throw new Error("Slide index ${slideIndex} out of range");
  }
  // Speaker notes are not accessible via the Office.js PowerPoint API at the
  // required API version (PowerPointApi 1.3). Notes access requires API 1.8+.
  // As a workaround, add the notes text to the slide as a hidden text box
  // positioned off-screen, or advise the user to add notes manually.
  void "${notes}"; // notes content acknowledged but not applied
  return JSON.stringify({
    success: false,
    reason: "Speaker notes are not supported by the PowerPoint Office.js API at the required API level (1.3). Notes require PowerPointApi 1.8+. Please add notes manually via the Notes pane.",
  });
});`
    }

    case 'ppt_read_notes': {
      // Same limitation — slide.notes is not a property at PowerPointApi 1.3.
      const slideIndex = typeof args['slideIndex'] === 'number' ? args['slideIndex'] : null
      const target = slideIndex !== null ? `slide ${slideIndex}` : 'all slides'
      return `
return await PowerPoint.run(async (context) => {
  context.presentation.slides.load("items");
  await context.sync();
  ${slideIndex !== null && slideIndex >= 0 ? `
  if (${slideIndex} >= context.presentation.slides.items.length) {
    throw new Error("Slide index ${slideIndex} out of range");
  }` : ''}
  // slide.notes is not available at PowerPointApi 1.3 (requires 1.8+).
  void "${target}"; // target acknowledged
  return JSON.stringify({
    success: false,
    reason: "Reading speaker notes is not supported by the PowerPoint Office.js API at the required API level (1.3). Notes require PowerPointApi 1.8+.",
  });
});`
    }

    case 'ppt_add_textbox': {
      const slideIndex = numArg(args, 'slideIndex', 0)
      const text = strArg(args, 'text', '')
      const left = numArg(args, 'left', 60)
      const top = numArg(args, 'top', 140)
      const width = numArg(args, 'width', 840)
      const height = numArg(args, 'height', 300)
      return `
return await PowerPoint.run(async (context) => {
  context.presentation.slides.load("items");
  await context.sync();
  const slide = context.presentation.slides.items[${slideIndex}];
  if (!slide) throw new Error("Slide index ${slideIndex} out of range");
  slide.shapes.addTextBox("${text}", {
    left: ${left},
    top: ${top},
    width: ${width},
    height: ${height},
  });
  await context.sync();
  return "Text box added to slide ${slideIndex}";
});`
    }

    // ── Word ───────────────────────────────────────────────────────────────

    case 'word_read_body': {
      const fullText = boolArg(args, 'fullText')
      return `
return await Word.run(async (context) => {
  const body = context.document.body;
  body.load("text");
  await context.sync();
  const text = body.text;
  ${fullText ? '' : `
  if (text.length > 2000) {
    // Return first 2000 chars + heading outline for large docs
    const paragraphs = body.paragraphs;
    paragraphs.load("items/text,items/style");
    await context.sync();
    const headings = paragraphs.items
      .filter(p => p.style.startsWith("Heading"))
      .map(p => p.text.trim())
      .slice(0, 30);
    return JSON.stringify({
      preview: text.slice(0, 2000),
      truncated: true,
      totalChars: text.length,
      headings,
    });
  }`}
  return JSON.stringify({ text, truncated: false });
});`
    }

    case 'word_read_selection': {
      return `
return await Word.run(async (context) => {
  const selection = context.document.getSelection();
  selection.load("text");
  await context.sync();
  return JSON.stringify({ text: selection.text });
});`
    }

    case 'word_insert_text': {
      const text = strArg(args, 'text', '')
      const location = strArg(args, 'location', 'end')
      const style = typeof args['style'] === 'string' ? args['style'] : null
      const locationMap: Record<string, string> = {
        replace: 'Word.InsertLocation.replace',
        before: 'Word.InsertLocation.before',
        after: 'Word.InsertLocation.after',
        start: 'Word.InsertLocation.start',
        end: 'Word.InsertLocation.end',
      }
      const insertLoc = locationMap[location] ?? 'Word.InsertLocation.end'
      return `
return await Word.run(async (context) => {
  const selection = context.document.getSelection();
  const range = selection.insertText("${text}", ${insertLoc});
  ${style ? `range.style = "${escStr(style)}";` : ''}
  await context.sync();
  return "Text inserted";
});`
    }

    case 'word_replace_text': {
      const searchText = strArg(args, 'searchText', '')
      const replacementText = strArg(args, 'replacementText', '')
      const matchCase = boolArg(args, 'matchCase')
      const replaceAll = boolArg(args, 'replaceAll')
      const useTrackedChanges = boolArg(args, 'useTrackedChanges', true)
      return `
return await Word.run(async (context) => {
  ${useTrackedChanges ? 'context.document.changeTrackingMode = Word.ChangeTrackingMode.trackAll;' : ''}
  const results = context.document.body.search("${searchText}", { matchCase: ${matchCase} });
  results.load("items/text");
  await context.sync();
  if (results.items.length === 0) return JSON.stringify({ replaced: 0, message: "Text not found" });
  const targets = ${replaceAll} ? results.items : [results.items[0]];
  for (const range of targets) {
    range.insertText("${replacementText}", Word.InsertLocation.replace);
  }
  await context.sync();
  return JSON.stringify({ replaced: targets.length });
});`
    }

    case 'word_get_document_outline': {
      const maxLevel = numArg(args, 'maxLevel', 3)
      return `
return await Word.run(async (context) => {
  const paragraphs = context.document.body.paragraphs;
  paragraphs.load("items/text,items/style,items/outlineLevel");
  await context.sync();
  const outline = paragraphs.items
    .filter(p => {
      const match = p.style.match(/Heading (\\d)/);
      return match && parseInt(match[1]) <= ${maxLevel};
    })
    .map(p => ({
      level: parseInt((p.style.match(/Heading (\\d)/) || ['', '0'])[1]),
      text: p.text.trim(),
    }));
  return JSON.stringify(outline);
});`
    }

    case 'word_get_document_properties': {
      return `
return await Word.run(async (context) => {
  const props = context.document.properties;
  props.load("title,author,wordCount,characterCount,lastSaveTime");
  await context.sync();
  return JSON.stringify({
    title: props.title,
    author: props.author,
    wordCount: props.wordCount,
    characterCount: props.characterCount,
    lastSaveTime: props.lastSaveTime,
  });
});`
    }

    case 'word_insert_table': {
      const data = args['data'] as string[][]
      const style = strArg(args, 'style', 'Light List Accent 1')
      const location = strArg(args, 'location', 'end')
      const locationMap: Record<string, string> = {
        end: 'Word.InsertLocation.end',
        start: 'Word.InsertLocation.start',
        after_selection: 'Word.InsertLocation.after',
      }
      const insertLoc = locationMap[location] ?? 'Word.InsertLocation.end'
      return `
return await Word.run(async (context) => {
  const data = ${JSON.stringify(data)};
  const rowCount = data.length;
  const colCount = data[0]?.length ?? 0;
  const insertTarget = context.document.body;
  const table = insertTarget.insertTable(rowCount, colCount, ${insertLoc}, data);
  table.style = "${style}";
  await context.sync();
  return "Table inserted with " + rowCount + " rows";
});`
    }

    case 'word_set_track_changes': {
      const enabled = boolArg(args, 'enabled')
      return `
return await Word.run(async (context) => {
  context.document.changeTrackingMode = ${enabled ? 'Word.ChangeTrackingMode.trackAll' : 'Word.ChangeTrackingMode.off'};
  await context.sync();
  return "Track changes ${enabled ? 'enabled' : 'disabled'}";
});`
    }

    case 'word_get_content_controls': {
      return `
return await Word.run(async (context) => {
  const controls = context.document.contentControls;
  controls.load("items/tag,items/title,items/text");
  await context.sync();
  const list = controls.items.map(cc => ({
    tag: cc.tag,
    title: cc.title,
    text: cc.text,
  }));
  return JSON.stringify(list);
});`
    }

    case 'word_fill_content_control': {
      const tag = typeof args['tag'] === 'string' ? args['tag'] : null
      const title = typeof args['title'] === 'string' ? args['title'] : null
      const value = strArg(args, 'value', '')
      return `
return await Word.run(async (context) => {
  ${tag ? `
  const byTag = context.document.contentControls.getByTag("${escStr(tag)}");
  byTag.load("items");
  await context.sync();
  if (byTag.items.length > 0) {
    byTag.items[0].insertText("${value}", Word.InsertLocation.replace);
    await context.sync();
    return "Content control filled by tag: ${escStr(tag)}";
  }` : ''}
  ${title ? `
  const byTitle = context.document.contentControls.getByTitle("${escStr(title)}");
  byTitle.load("items");
  await context.sync();
  if (byTitle.items.length > 0) {
    byTitle.items[0].insertText("${value}", Word.InsertLocation.replace);
    await context.sync();
    return "Content control filled by title: ${escStr(title)}";
  }` : ''}
  return "Content control not found";
});`
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
