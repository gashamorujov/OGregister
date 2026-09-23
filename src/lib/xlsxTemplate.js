// Shared low-level helpers for template-based (not hand-drawn) workbook
// generation. journalGenerator.js loads the real jurnal_template.xlsx and
// only ever *fills cells in* on the sheets that are already in that file —
// nothing here redraws a layout. The one piece of real work is cloning an
// existing sheet (needed when a course runs long enough to need a second
// or third attendance page): ExcelJS has no built-in "duplicate worksheet",
// so cloneSheet copies the loaded model — values, per-cell styles, column
// widths, row heights, merges and images — onto a newly added sheet.

/**
 * Deep-clones `sourceName` into a new sheet called `newName` in the same
 * workbook. Copies far enough to be visually identical for this workbook's
 * purposes: cell values + full per-cell style objects, column widths/
 * hidden state, row heights/hidden state, merged ranges, page setup/
 * margins/header-footer/view (freeze panes), and any embedded images.
 */
export function cloneSheet(workbook, sourceName, newName) {
  const src = workbook.getWorksheet(sourceName);
  if (!src) throw new Error(`cloneSheet: source sheet "${sourceName}" not found`);

  const dst = workbook.addWorksheet(newName, {
    properties: { ...src.properties },
    pageSetup: { ...src.pageSetup },
    views: (src.views || []).map((v) => ({ ...v })),
    headerFooter: src.headerFooter ? { ...src.headerFooter } : undefined,
  });

  // `dimensions` under-counts trailing rows that carry style/height but no
  // cell value (this template has empty pre-built slot rows like that), so
  // floor it generously rather than trust it exactly — a few dozen extra
  // rows of cheap cell copying is nothing next to silently dropping a
  // row's formatting.
  const dim = src.dimensions;
  const maxCol = Math.max(dim ? dim.right : 0, 30);
  const maxRow = Math.max(dim ? dim.bottom : 0, 40);

  for (let c = 1; c <= maxCol; c += 1) {
    const sc = src.getColumn(c);
    const dc = dst.getColumn(c);
    if (sc.width != null) dc.width = sc.width;
    dc.hidden = !!sc.hidden;
  }

  for (let r = 1; r <= maxRow; r += 1) {
    const srow = src.getRow(r);
    const drow = dst.getRow(r);
    if (srow.height != null) drow.height = srow.height;
    drow.hidden = !!srow.hidden;
    for (let c = 1; c <= maxCol; c += 1) {
      const scell = srow.getCell(c);
      const dcell = drow.getCell(c);
      if (scell.value != null) dcell.value = scell.value;
      dcell.style = JSON.parse(JSON.stringify(scell.style));
    }
  }

  (src.model.merges || []).forEach((m) => {
    try { dst.mergeCells(m); } catch { /* already covered by an equal/overlapping range */ }
  });

  try {
    const images = src.getImages();
    images.forEach((img) => {
      const media = workbook.model.media.find((m) => m.index === img.imageId);
      if (!media || !media.buffer) return;
      const newImageId = workbook.addImage({ buffer: media.buffer, extension: media.extension || 'png' });
      dst.addImage(newImageId, img.range);
    });
  } catch (err) {
    console.error('cloneSheet: image copy failed', err);
  }

  return dst;
}

/** Excel sheet names: <=31 chars, no  \\/?*[] . */
export function safeSheetName(name) {
  return String(name || '').replace(/[\\/?*[\]:]/g, '-').slice(0, 31);
}

/**
 * Copies one row's per-column styles onto another row, column by column —
 * used to extend a template's pre-built row block (e.g. student rows 11-20)
 * a few rows further for a group with more participants than the template
 * shipped with, without hand-describing borders/fills/fonts again.
 */
export function copyRowStyle(sheet, fromRow, toRow, cols) {
  const src = sheet.getRow(fromRow);
  const dst = sheet.getRow(toRow);
  dst.height = src.height;
  cols.forEach((c) => {
    dst.getCell(c).style = JSON.parse(JSON.stringify(src.getCell(c).style));
  });
}

/** Blanks out a row's values across the given columns without touching style. */
export function clearRowValues(sheet, row, cols) {
  const r = sheet.getRow(row);
  cols.forEach((c) => { r.getCell(c).value = null; });
}
