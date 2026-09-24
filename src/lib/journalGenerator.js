import ExcelJS from 'exceljs';
import { getCourseHours, getCourseName } from '../data/courses';
import { addDays } from './courseGroups';
import { fetchJurnalTemplateBuffer } from './templates';
import { cloneSheet, safeSheetName, copyRowStyle } from './xlsxTemplate';

/* ============================================================================
 * Jurnal (journal) export.
 * ----------------------------------------------------------------------------
 * This loads the real reference workbook (src/assets/jurnal_template.xlsx,
 * the exact file supplied as the master template) and only ever fills
 * cells that already exist in it — nothing is redrawn. "GDC-1" is the
 * attendance-sheet page, "HSE" the induction sign-in sheet and "qeyd" the
 * instructor's notes sheet; all three ship with the template and are
 * always produced together, exactly as in the reference file. A fourth
 * sheet in the template, "GDC-2", is old, unrelated leftover content from
 * a past course and is removed from every generated journal.
 *
 * A course longer than MAX_DAY_COLS_PER_PAGE days gets a second (third...)
 * attendance page, produced by cloning the loaded "GDC-1" sheet — see
 * xlsxTemplate.js — rather than hand-drawing another copy.
 * ========================================================================== */

const MAX_DAY_COLS_PER_PAGE = 6;

// GDC-1 (attendance page) layout, as measured directly in the template file.
const GDC_FIXED_COLS = [1, 2, 3, 4, 5, 6]; // A..F: S/s, SAP, Full Name, Organization, Position, Contact Number
const GDC_DATE_ROW = 9;
const GDC_STUDENT_START_ROW = 11;
const GDC_STUDENT_BUILTIN_END_ROW = 20; // 10 pre-built slots ship with the template
const GDC_STUDENT_HARD_END_ROW = 27; // last row before the footer (row 28) — blank in the template
const GDC_DAY_SLOT_COUNT = 9; // physical day-column pairs the template has (G..X); only the first 6 are ever used
const GDC_DAY_FIRST_COL = 7; // G

// HSE (induction sign-in) layout.
const HSE_FIXED_COLS = [1, 2, 3, 4, 5, 6]; // A..F: S/s, SAP, Full Name, Organization, Position, İmza (left blank)
const HSE_STUDENT_START_ROW = 15;
const HSE_STUDENT_BUILTIN_END_ROW = 24;

// Known sample values baked into the reference file, used to derive each
// label's exact prefix ("Course Name: / Təlimin adı: ", …) without
// retyping it — see stripSample() below. Falls back to a hardcoded prefix
// if the template ever changes and the sample can no longer be found.
const SAMPLE = {
  courseName: 'Maşın şöbəsinin resurslarının idarə olunması',
  groupNum: '009/26',
  dateRange: '19.09.2026-23.09.2026',
  teacher: 'Rahab Tahirov',
};
const FALLBACK_PREFIX = {
  courseName: 'Course Name: / Təlimin adı: ',
  groupNum: 'Group № / Qrup №: ',
  dateRange: 'Course Dates / Təlimin başlama və bitmə tarixi: ',
  teacher: "Instructor's Name: / Təlimatçının S.A.A. : ",
  qeydCourseName: 'Course Name: / Təlimin adı: ',
};

/** current cell text with the known sample suffix stripped off, so only the label prefix remains. */
function labelPrefix(currentText, sampleValue, fallback) {
  const text = String(currentText || '');
  const idx = text.indexOf(sampleValue);
  if (idx === -1) return fallback;
  return text.slice(0, idx);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseAzDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('.');
  if (parts.length !== 3) return null;
  const d = Number(parts[0]);
  const m = Number(parts[1]);
  const y = Number(parts[2]);
  if (!d || !m || !y) return null;
  return new Date(Date.UTC(y, m - 1, d));
}

function slugGroupNum(groupNum) {
  return String(groupNum || '').replace(/[\\/]/g, '-').replace(/\s+/g, '');
}

/* ── GDC-1 (one attendance page) ─────────────────────────────────────────── */

function fillAttendancePage(sheet, group, pageDates, courseDateRange, pageInfo) {
  // Header fields — same on every page of the same group. The exact
  // strings are returned so the caller can mirror them into HSE/qeyd's
  // formula cells (see syncCrossSheetMirrors) — those sheets reference
  // these same cells by formula, but ExcelJS never recalculates formulas,
  // so the cached result has to be refreshed by hand or some viewers will
  // keep showing the template's original sample value.
  const courseCell = sheet.getCell('B4');
  courseCell.value = labelPrefix(courseCell.value, SAMPLE.courseName, FALLBACK_PREFIX.courseName)
    + (group.courseName || getCourseName(group.courseCode));

  const groupCell = sheet.getCell('F4');
  groupCell.value = labelPrefix(groupCell.value, SAMPLE.groupNum, FALLBACK_PREFIX.groupNum) + (group.groupNum || '');

  const datesCell = sheet.getCell('B7');
  datesCell.value = labelPrefix(datesCell.value, SAMPLE.dateRange, FALLBACK_PREFIX.dateRange) + courseDateRange;

  const instrCell = sheet.getCell('F7');
  instrCell.value = labelPrefix(instrCell.value, SAMPLE.teacher, FALLBACK_PREFIX.teacher) + (group.teacher || '');

  const venueCell = sheet.getCell('B6');
  const headerValues = {
    courseName: courseCell.value, groupNum: groupCell.value, dates: datesCell.value, instructor: instrCell.value, venue: venueCell.value,
  };

  // Title gets a page suffix when the course spans more than one page —
  // matching how the template already phrases a page-numbered title.
  const title = sheet.getCell('C1');
  const base = String(title.value || '').replace(/\s*\(\d+\/\d+ səhifə\)\s*$/, '');
  title.value = pageInfo.totalPages > 1 ? (base + '  (' + pageInfo.pageIndex + '/' + pageInfo.totalPages + ' səhifə)') : base;

  // Day columns: only the first MAX_DAY_COLS_PER_PAGE pairs are ever used;
  // show+date the ones this page needs, hide the rest (including the
  // template's extra native slots beyond the 6-per-page cap) and clear any
  // leftover sample date sitting in a hidden slot.
  //
  // The template's own sample had several of these slots hidden (that
  // particular real course didn't use them), and Google Sheets had left
  // their column widths very narrow as a result — too narrow for a
  // "dd.mm.yyyy" date at this sheet's font size, so a slot that was hidden
  // in the sample shows "###" once simply unhidden. Column 0 (G/H) is
  // always in use and always had a normal width, so its width is reused
  // for every slot that needs showing, rather than trusting whatever width
  // a given slot happened to be left at.
  const goodSigWidth = sheet.getColumn(GDC_DAY_FIRST_COL).width;
  const goodTimeWidth = sheet.getColumn(GDC_DAY_FIRST_COL + 1).width;
  for (let i = 0; i < GDC_DAY_SLOT_COUNT; i += 1) {
    const sigCol = GDC_DAY_FIRST_COL + i * 2;
    const timeCol = sigCol + 1;
    const inUse = i < MAX_DAY_COLS_PER_PAGE && i < pageDates.length;
    sheet.getColumn(sigCol).hidden = !inUse;
    sheet.getColumn(timeCol).hidden = !inUse;
    if (inUse) {
      sheet.getColumn(sigCol).width = goodSigWidth;
      sheet.getColumn(timeCol).width = goodTimeWidth;
    }
    const dateCell = sheet.getCell(GDC_DATE_ROW, sigCol);
    dateCell.value = inUse ? parseAzDate(pageDates[i]) : null;
  }

  // Student rows. When extending past the template's 10 pre-built slots,
  // the day-column signature/time boxes need their bordered-cell style
  // copied down too, not just the six fixed columns — otherwise an
  // extended row would show a name/position but no signing box.
  const allRowCols = [];
  for (let c = 1; c < GDC_DAY_FIRST_COL + GDC_DAY_SLOT_COUNT * 2; c += 1) allRowCols.push(c);
  const students = group.students || [];
  fillStudentBlock(sheet, students, {
    fixedCols: GDC_FIXED_COLS,
    styleCols: allRowCols,
    startRow: GDC_STUDENT_START_ROW,
    builtinEndRow: GDC_STUDENT_BUILTIN_END_ROW,
    hardEndRow: GDC_STUDENT_HARD_END_ROW,
    // Contact Number must never be copied from the registry into a journal.
    valuesFor: (s, idx) => [idx + 1, 'N/A', s.fullName || '', 'Fiziki şəxs', s.rank || '', ''],
  });

  return headerValues;
}

/** Refreshes the cached result of HSE/qeyd's formula cells that mirror
 * GDC-1's header fields, so they display correctly without depending on
 * the viewer to recalculate formulas on open. The formula itself (and so
 * the live link back to GDC-1) is left exactly as the template has it. */
function syncCrossSheetMirrors(hseSheet, qeydSheet, headerValues) {
  const apply = (sheet, address, text) => {
    const cell = sheet.getCell(address);
    if (!cell.formula) return;
    cell.value = { formula: cell.formula, result: text };
  };
  apply(hseSheet, 'E1', headerValues.instructor);
  apply(hseSheet, 'C4', headerValues.dates);
  apply(hseSheet, 'E4', headerValues.courseName);
  apply(qeydSheet, 'E3', headerValues.groupNum);
  apply(qeydSheet, 'C5', headerValues.venue);
  apply(qeydSheet, 'C7', headerValues.dates);
  apply(qeydSheet, 'E7', headerValues.instructor);
}

/* ── HSE (induction sign-in sheet) ───────────────────────────────────────── */

function fillHseSheet(sheet, group) {
  const students = group.students || [];
  fillStudentBlock(sheet, students, {
    fixedCols: HSE_FIXED_COLS,
    startRow: HSE_STUDENT_START_ROW,
    builtinEndRow: HSE_STUDENT_BUILTIN_END_ROW,
    hardEndRow: HSE_STUDENT_BUILTIN_END_ROW, // nothing below row 24 in the template — extending just appends rows
    valuesFor: (s, idx) => [idx + 1, 'N/A', s.fullName || '', 'Fiziki şəxs', s.rank || '', null], // İmza column stays blank
  });
}

/* ── qeyd (instructor's notes sheet) — only its own course-name text; every
 * other field is a formula already pointing at GDC-1, left untouched ── */

function fillQeydSheet(sheet, group) {
  const cell = sheet.getCell('C3');
  cell.value = labelPrefix(cell.value, SAMPLE.courseName, FALLBACK_PREFIX.qeydCourseName)
    + (group.courseName || getCourseName(group.courseCode));
}

/* ── Shared student-row filler, used by both GDC-1 and HSE ──────────────── */

function fillStudentBlock(sheet, students, opts) {
  const { fixedCols, startRow, builtinEndRow, valuesFor } = opts;
  const styleCols = opts.styleCols || fixedCols;
  const count = students.length;

  students.forEach((student, idx) => {
    const row = startRow + idx;
    // Repaint every participant row from the first known-good template row.
    // This also repairs inconsistent pre-built rows (not only appended rows).
    // New rows therefore use exactly the same font, fill, borders, alignment
    // and row height as the canonical participant row.
    copyRowStyle(sheet, startRow, row, styleCols);
    sheet.getRow(row).hidden = false;
    const values = valuesFor(student, idx);
    fixedCols.forEach((col, ci) => {
      const v = values[ci];
      const cell = sheet.getRow(row).getCell(col);
      cell.value = (v === undefined ? null : v);
      // Keep every value inside its existing template box. Excel/Sheets then
      // scales long names and positions down instead of painting over the
      // neighbouring cell or increasing the journal row height.
      cell.alignment = {
        ...(cell.alignment || {}),
        vertical: 'middle',
        shrinkToFit: true,
        wrapText: false,
      };
    });

    // "Fiziki şəxs" is the organization value, but it must look exactly like
    // the position value beside it. Copy only the font/alignment so the
    // organization's own border and column geometry remain untouched.
    const organizationCell = sheet.getRow(row).getCell(4);
    const positionCell = sheet.getRow(row).getCell(5);
    organizationCell.font = JSON.parse(JSON.stringify(positionCell.font));
    organizationCell.alignment = {
      ...(organizationCell.alignment || {}),
      ...(positionCell.alignment || {}),
      vertical: 'middle',
      shrinkToFit: true,
      wrapText: false,
    };
  });

  // Blank + hide any remaining pre-built slot the group doesn't need.
  for (let row = startRow + count; row <= builtinEndRow; row += 1) {
    copyRowStyle(sheet, startRow, row, styleCols);
    fixedCols.forEach((col) => { sheet.getRow(row).getCell(col).value = null; });
    sheet.getRow(row).hidden = true;
  }
  // (Rows below builtinEndRow that were never touched — because this group
  // didn't need them — stay exactly as the template shipped: blank,
  // unbordered spacer rows.)
}

/* ── Multi-sheet-set helpers (page 2+, and — rarely — group 2+) ─────────── */

function retargetFormulas(sheet, oldSheetName, newSheetName) {
  const quoted = "'" + oldSheetName + "'!";
  const replacement = "'" + newSheetName + "'!";
  for (let r = 1; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= sheet.columnCount; c += 1) {
      const cell = row.getCell(c);
      if (cell.formula && cell.formula.includes(quoted)) {
        cell.value = { formula: cell.formula.split(quoted).join(replacement), result: cell.result };
      }
    }
  }
}

/* ── Main generator ──────────────────────────────────────────────────────
 * @param {Array} groups - pre-assembled groups (see courseGroups.js), each
 *   with .courseCode, .courseName, .courseHours, .startDate, .students,
 *   .teacher, .groupNum attached.
 * @param {{ getDays?: (code:string)=>number }} opts - getDays supplies the
 *   Admin-Panel-configured course duration; falls back to hours/8.
 * ========================================================================== */
export async function generateJournal(groups, opts) {
  const options = opts || {};
  const getDays = options.getDays;
  const templateBuffer = await fetchJurnalTemplateBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer);

  // The master workbook contains an unrelated legacy sample sheet (GDC-2).
  // Keeping it would expose stale course text in every generated journal.
  const legacySheet = workbook.getWorksheet('GDC-2');
  if (legacySheet) workbook.removeWorksheet(legacySheet.id);

  const withStudents = groups.filter((g) => g.students && g.students.length > 0);

  withStudents.forEach((group, groupIdx) => {
    const totalDays = Math.max(
      1,
      getDays ? getDays(group.courseCode) : Math.ceil((group.courseHours || getCourseHours(group.courseCode) || 8) / 8),
    );
    const finishDate = addDays(group.startDate, totalDays - 1);
    const courseDateRange = (group.startDate && finishDate) ? (group.startDate + '-' + finishDate) : (group.startDate || '');

    const allDates = [];
    for (let i = 0; i < totalDays; i += 1) allDates.push(addDays(group.startDate, i));
    const pages = chunk(allDates, MAX_DAY_COLS_PER_PAGE);

    const isFirstGroup = groupIdx === 0;
    const gdc1Name = isFirstGroup ? 'GDC-1' : safeSheetName('GDC-1_g' + (groupIdx + 1));
    const hseName = isFirstGroup ? 'HSE' : safeSheetName('HSE_g' + (groupIdx + 1));
    const qeydName = isFirstGroup ? 'qeyd' : safeSheetName('qeyd_g' + (groupIdx + 1));

    if (!isFirstGroup) {
      cloneSheet(workbook, 'GDC-1', gdc1Name);
      const hseClone = cloneSheet(workbook, 'HSE', hseName);
      const qeydClone = cloneSheet(workbook, 'qeyd', qeydName);
      retargetFormulas(hseClone, 'GDC-1', gdc1Name);
      retargetFormulas(qeydClone, 'GDC-1', gdc1Name);
    }

    // Extra attendance pages (course longer than one page's worth of days).
    // ExcelJS always appends a newly-added sheet after every existing one
    // (ordered by orderNo), which would otherwise land these clones after
    // HSE/qeyd instead of right after the first attendance page — nudge
    // each clone's orderNo to sit immediately after gdc1Name's.
    const basePage = workbook.getWorksheet(gdc1Name);
    const pageSheetNames = pages.map((_, pageIdx) => {
      if (pageIdx === 0) return gdc1Name;
      const name = safeSheetName(gdc1Name + '-' + (pageIdx + 1));
      const clone = cloneSheet(workbook, gdc1Name, name);
      clone.orderNo = basePage.orderNo + pageIdx / 1000;
      return name;
    });

    let headerValues = null;
    pages.forEach((pageDates, pageIdx) => {
      const sheet = workbook.getWorksheet(pageSheetNames[pageIdx]);
      const values = fillAttendancePage(sheet, group, pageDates, courseDateRange, {
        pageIndex: pageIdx + 1, totalPages: pages.length,
      });
      if (pageIdx === 0) headerValues = values;
    });

    fillHseSheet(workbook.getWorksheet(hseName), group);
    fillQeydSheet(workbook.getWorksheet(qeydName), group);
    syncCrossSheetMirrors(workbook.getWorksheet(hseName), workbook.getWorksheet(qeydName), headerValues);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  let fileName = 'Jurnal.xlsx';
  if (withStudents.length === 1) {
    const g = withStudents[0];
    fileName = 'Jurnal_' + g.courseCode + '_' + slugGroupNum(g.groupNum) + '.xlsx';
  } else if (withStudents.length > 1) {
    fileName = 'Jurnal_' + withStudents.length + '_kurs.xlsx';
  }

  return { buffer, fileName };
}

// Exposed for the Admin Panel / preview use-cases that just need the day list.
export function computeCourseDays(startDate, days) {
  const out = [];
  for (let i = 0; i < Math.max(1, days); i += 1) out.push(addDays(startDate, i));
  return out;
}
