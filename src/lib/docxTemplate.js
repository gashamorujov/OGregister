import JSZip from 'jszip';

/* Shared low-level helpers for template-based (not hand-written) .docx
 * generation. protokolGenerator.js loads the real protokol_template.docx
 * and edits word/document.xml directly — the same "unzip, patch the one
 * part that changed, rezip" approach used for editing any existing Word
 * file — rather than building a document from scratch, so every style,
 * paragraph and legal-text block the template ships with survives
 * untouched except the specific values that are meant to change. */

export async function loadDocxXml(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml').async('string');
  return { zip, xml };
}

export async function saveDocxXml(zip, xml) {
  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'uint8array' });
}

export function escapeXml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replaces every occurrence of a long/distinctive text substring wherever
 * it appears verbatim in the document — safe for the handful of values
 * that are genuinely unique in the template (a full course name, a date
 * range, the group label), never for anything short or generic.
 */
export function replaceEverywhere(xml, oldText, newText) {
  if (!oldText) return xml;
  return xml.split(oldText).join(escapeXml(newText));
}

/**
 * Finds `labelText` as a complete <w:t>label</w:t> run, then replaces the
 * text of the NEXT <w:t> run after it — the adjacent table cell's value —
 * for values too short/generic to safely run through replaceEverywhere
 * (a bare participant count, a "-"). No-ops if the label isn't found.
 */
export function replaceValueAfterLabel(xml, labelText, newValue) {
  const labelRe = new RegExp(`<w:t[^>]*>${escapeRegExp(labelText)}</w:t>`);
  const m = labelRe.exec(xml);
  if (!m) return xml;
  const afterLabel = m.index + m[0].length;
  const valueRe = /<w:t([^>]*)>([^<]*)<\/w:t>/;
  const vm = valueRe.exec(xml.slice(afterLabel));
  if (!vm) return xml;
  const start = afterLabel + vm.index;
  const end = start + vm[0].length;
  const replacement = `<w:t${vm[1]}>${escapeXml(newValue)}</w:t>`;
  return xml.slice(0, start) + replacement + xml.slice(end);
}

/**
 * Replaces one exact <w:t xml:space="preserve">old</w:t> run's text inside
 * a (row) XML fragment — used to fill a cloned table-row template.
 */
export function replaceExactRun(fragmentXml, oldValue, newValue) {
  const tag = `<w:t xml:space="preserve">${oldValue}</w:t>`;
  if (!fragmentXml.includes(tag)) return fragmentXml;
  const replacement = `<w:t xml:space="preserve">${escapeXml(newValue)}</w:t>`;
  return fragmentXml.replace(tag, replacement);
}

/**
 * The participant table can have more or fewer rows than the template
 * shipped with (it shipped with 4 sample rows). This clones the row that
 * contains `firstRowMarker` once per item (via `fillRow(rowTemplateXml,
 * item, index)`), then replaces the whole original sample block — from
 * that row through the row containing `lastRowMarker` — with the
 * generated rows, so every row a real group needs gets the exact same
 * borders/fonts/cell margins as the template's own row.
 */
export function replaceTableRows(xml, firstRowMarker, lastRowMarker, items, fillRow) {
  const firstIdx = xml.indexOf(firstRowMarker);
  const lastMarkerIdx = xml.indexOf(lastRowMarker);
  if (firstIdx === -1 || lastMarkerIdx === -1) return xml;

  const trOpenRe = /<w:tr[ >]/g;
  let trStart = -1;
  let m = trOpenRe.exec(xml);
  while (m && m.index < firstIdx) {
    trStart = m.index;
    m = trOpenRe.exec(xml);
  }
  if (trStart === -1) return xml;

  const closeTag = '</w:tr>';
  const trEndAfterFirst = xml.indexOf(closeTag, firstIdx) + closeTag.length;
  const rowTemplate = xml.slice(trStart, trEndAfterFirst);

  const trEndAfterLast = xml.indexOf(closeTag, lastMarkerIdx) + closeTag.length;

  const rows = items.map((item, idx) => fillRow(rowTemplate, item, idx)).join('');

  return xml.slice(0, trStart) + rows + xml.slice(trEndAfterLast);
}
