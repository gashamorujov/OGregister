import ExcelJS from 'exceljs';
import { getCourseName, getCourseHours } from '../data/courses';
import { addDays, buildCourseGroups } from './courseGroups';

/* ============================================================================
 * Training Plan export
 * ----------------------------------------------------------------------------
 * Builds the workbook from scratch every time, using values measured
 * directly from the reference file (fonts, sizes, bold, fill colors, border
 * sides, column widths, row heights, logo position/size). Every visual rule
 * lives in this file. The only bundled asset is the IST logo image itself
 * (src/assets/ist-logo.png), which gets embedded directly.
 *
 * `generateTrainingPlan` takes fully-assembled course groups (roster +
 * teacher + group number already attached — see src/lib/courseGroups.js and
 * the DocGenModal / auto-grouping flow that build them) so that a group split
 * in two by the auto-grouping flow (§5) renders as two independent blocks,
 * each with its own group number, without this file needing to know
 * anything about that flow.
 * ========================================================================== */

// Kept for any caller that only needs a read-only summary (course, dates,
// headcount) without going through the full assignment flow.
export function getUniqueCourseGroups(records) {
  return buildCourseGroups(records).map((g) => {
    const days = Math.max(1, Math.ceil(g.courseHours / 8));
    const finishDate = addDays(g.startDate, days - 1);
    return {
      courseCode: g.courseCode,
      courseName: g.courseName,
      startDate: g.startDate,
      finishDate,
      studentCount: g.studentCount,
    };
  });
}

/* ============================================================================
 * Exact visual spec — every number below was measured from the reference
 * Training_Plan.xlsx (openpyxl cell-by-cell inspection + a rendered preview),
 * not eyeballed. Column letters in comments refer to that file's layout.
 * ========================================================================== */

const FONT = 'Arial';
const BLACK = { argb: 'FF000000' };
const THIN = 'thin';

const WHITE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
const LIGHT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF6F8F9' } };

// Every bordered cell gets an explicit, full 4-side box. Earlier this relied
// on adjacent cells supplying shared edges (e.g. only setting bottom+right
// and trusting the row above / column before to draw the rest) — Excel
// renders that fine on screen, but PDF export and some print pipelines can
// drop a border that only exists on the *neighboring* cell, leaving gaps.
// Explicit borders on every cell removes that failure mode entirely; when
// two adjacent cells both draw "thin black" on the same shared edge, Excel
// renders a single thin line, not a doubled one, so nothing looks different
// on screen — it's just robust everywhere now.
function borderSeq() {
  return borderBoxed();
}
// Fully boxed on all 4 sides. Used by every column of every row that has a
// border at all — the label/value rows (columns B–F), column C's stripe,
// and (via borderSeq/borderRightBottom below) column A and the B/D/E/F
// student/footer cells too.
function borderBoxed() {
  return {
    left: { style: THIN, color: BLACK },
    right: { style: THIN, color: BLACK },
    top: { style: THIN, color: BLACK },
    bottom: { style: THIN, color: BLACK },
  };
}
function borderRightBottom() {
  return borderBoxed();
}

const COLS = {
  SEQ: 1, NAME: 2, HOURS: 3, RANK: 4, DATE: 5, TEACHER: 6,
};

function applyColWidths(sheet) {
  sheet.getColumn(COLS.SEQ).width = 13.98828125;
  sheet.getColumn(COLS.NAME).width = 211.875;
  sheet.getColumn(COLS.HOURS).width = 54.48046875;
  sheet.getColumn(COLS.RANK).width = 99.0078125;
  sheet.getColumn(COLS.DATE).width = 53;
  sheet.getColumn(COLS.TEACHER).width = 102.1015625;
  sheet.getColumn(7).width = 8.7421875;
}

/* ── Row builders, one per visual role ── */

// Column-label row ("Kursun adı", "Tədrisin ümumi saatı", ...): Arial 25 bold, white fill, boxed.
function writeLabelRow(sheet, rowNum) {
  const row = sheet.getRow(rowNum);
  row.height = 33;
  const labels = {
    [COLS.NAME]: 'Kursun adı',
    [COLS.HOURS]: 'Tədrisin ümumi saatı',
    [COLS.RANK]: 'Qrup nömrəsi',
    [COLS.DATE]: 'Başlama və bitmə tarixi',
    [COLS.TEACHER]: 'Kursu tədris edən müəllimlərin adı və soyadı',
  };

  const seq = row.getCell(COLS.SEQ);
  seq.font = { name: FONT, size: 27, bold: true };
  seq.alignment = { horizontal: 'center' };
  seq.border = borderSeq();

  [COLS.NAME, COLS.HOURS, COLS.RANK, COLS.DATE, COLS.TEACHER].forEach((c) => {
    const cell = row.getCell(c);
    cell.value = labels[c];
    cell.font = { name: FONT, size: 25, bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.fill = WHITE_FILL;
    cell.border = borderBoxed();
  });
}

// Values row (course name / hours / group / dates / teacher) — same box + font as the label
// row above it, carrying the actual data for one course group.
function writeValuesRow(sheet, rowNum, {
  courseName, courseHours, groupNum, dateRange, teacher,
}) {
  const row = sheet.getRow(rowNum);
  row.height = 33;
  const values = {
    [COLS.NAME]: courseName,
    [COLS.HOURS]: courseHours,
    [COLS.RANK]: groupNum,
    [COLS.DATE]: dateRange,
    [COLS.TEACHER]: teacher,
  };

  const seq = row.getCell(COLS.SEQ);
  seq.font = { name: FONT, size: 27, bold: true };
  seq.alignment = { horizontal: 'center' };
  seq.border = borderSeq();

  [COLS.NAME, COLS.HOURS, COLS.RANK, COLS.DATE, COLS.TEACHER].forEach((c) => {
    const cell = row.getCell(c);
    cell.value = values[c];
    cell.font = { name: FONT, size: 25, bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.fill = WHITE_FILL;
    cell.border = borderBoxed();
  });
}

// One student line: seq number (27 bold) | name (30, left-aligned) | spacer (30, light+boxed)
// | rank (30) | spacer (30) | status (30).
function writeStudentRow(sheet, rowNum, seqNum, student) {
  const row = sheet.getRow(rowNum);
  row.height = 33;

  const seq = row.getCell(COLS.SEQ);
  seq.value = seqNum;
  seq.font = { name: FONT, size: 27, bold: true };
  seq.alignment = { horizontal: 'center' };
  seq.border = borderSeq();

  const name = row.getCell(COLS.NAME);
  name.value = student.fullName || '';
  name.font = { name: FONT, size: 30 };
  name.alignment = { horizontal: 'left' };
  name.border = borderRightBottom();

  const hours = row.getCell(COLS.HOURS); // decorative spacer column in student rows
  hours.font = { name: FONT, size: 30 };
  hours.alignment = { horizontal: 'center' };
  hours.fill = LIGHT_FILL;
  hours.border = borderBoxed();

  const rank = row.getCell(COLS.RANK);
  rank.value = student.rank || '';
  rank.font = { name: FONT, size: 30, bold: false };
  rank.alignment = { horizontal: 'center' };
  rank.border = borderRightBottom();

  const date = row.getCell(COLS.DATE); // decorative spacer column in student rows
  date.font = { name: FONT, size: 30 };
  date.alignment = { horizontal: 'center' };
  date.border = borderRightBottom();

  const teacher = row.getCell(COLS.TEACHER);
  teacher.value = 'İlkin';
  teacher.font = { name: FONT, size: 30, bold: false };
  teacher.alignment = { horizontal: 'center' };
  teacher.border = borderRightBottom();
}

// Blank line between groups. Every column gets a full border so the grid line
// stays unbroken between course-group blocks; column C keeps its light
// "spacer" fill running continuously down the sheet, matching the reference.
function writeSeparatorRow(sheet, rowNum) {
  const row = sheet.getRow(rowNum);
  row.height = 33;
  [COLS.SEQ, COLS.NAME, COLS.HOURS, COLS.RANK, COLS.DATE, COLS.TEACHER].forEach((c) => {
    const cell = row.getCell(c);
    cell.border = borderBoxed();
    if (c === COLS.HOURS) cell.fill = LIGHT_FILL;
  });
}

// Closing line: "Hörmətlə" under Rank, department name under Teacher — styled like the
// label/values rows since both are real (bold, boxed, white) content, not blank fields.
function writeFooterRow(sheet, rowNum) {
  const row = sheet.getRow(rowNum);
  row.height = 33;

  const seq = row.getCell(COLS.SEQ);
  seq.font = { name: FONT, size: 27, bold: true };
  seq.alignment = { horizontal: 'center' };
  seq.border = borderSeq();

  const name = row.getCell(COLS.NAME);
  name.font = { name: FONT, size: 30 };
  name.alignment = { horizontal: 'left' };
  name.border = borderRightBottom();

  const hours = row.getCell(COLS.HOURS);
  hours.font = { name: FONT, size: 30 };
  hours.alignment = { horizontal: 'center' };
  hours.fill = LIGHT_FILL;
  hours.border = borderBoxed();

  const rank = row.getCell(COLS.RANK);
  rank.value = 'Hörmətlə ';
  rank.font = { name: FONT, size: 25, bold: true };
  rank.alignment = { horizontal: 'center' };
  rank.fill = WHITE_FILL;
  rank.border = borderBoxed();

  const date = row.getCell(COLS.DATE);
  date.font = { name: FONT, size: 30 };
  date.alignment = { horizontal: 'center' };
  date.border = borderRightBottom();

  const teacher = row.getCell(COLS.TEACHER);
  teacher.value = 'Dənizçilərin xüsusi hazırlıq üzrə təlim şöbəsi';
  teacher.font = { name: FONT, size: 25, bold: true };
  teacher.alignment = { horizontal: 'center' };
  teacher.fill = WHITE_FILL;
  teacher.border = borderBoxed();
}

// Logo placement, measured from the reference file's drawing XML: anchored at column A,
// row 0, offset 704850 EMU (=74px) from the left, sized 5514975 x 2609850 EMU (=579x274px).
// Column A is 13.98828125 characters wide, i.e. 98px at this workbook's default font size,
// so the offset is expressed as a fraction of column A's width (74/98) for ExcelJS's anchor.
function addLogo(workbook, sheet, logoBuffer) {
  if (!logoBuffer) return;
  const imageId = workbook.addImage({ buffer: logoBuffer, extension: 'png' });
  sheet.addImage(imageId, {
    tl: { col: 74 / 98, row: 0 },
    ext: { width: 579, height: 274 },
  });
}

function slugGroupNum(groupNum) {
  return String(groupNum || '').replace(/[\\/]/g, '-').replace(/\s+/g, '');
}

/**
 * @param {Array} groups - pre-assembled groups, each:
 *   { courseCode, courseName, courseHours, startDate, students, teacher, groupNum }
 * @param {ArrayBuffer} logoBuffer
 * @returns {Promise<{buffer: ArrayBuffer, fileName: string}>}
 */
export async function generateTrainingPlan(groups, logoBuffer) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Plan', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0, footer: 0,
      },
    },
  });

  applyColWidths(sheet);

  // Row 1: thin spacer the logo overlaps.
  sheet.getRow(1).height = 14.25;

  // Row 2: institution title, merged B2:F2, with the logo floating over its left edge.
  sheet.mergeCells('B2:F2');
  const titleRow = sheet.getRow(2);
  titleRow.height = 181.5;
  const title = sheet.getCell('B2');
  title.value = 'Industrial Support and Training MMC təlim-tədris müəssisəsində tədris edilən xüsusi hazırlıq kurslarına dair həftəlik dərs cədvəli  ';
  title.font = { name: FONT, size: 28, bold: true };
  title.alignment = { horizontal: 'center', vertical: 'middle' };

  addLogo(workbook, sheet, logoBuffer);

  let currentRow = 3;

  groups.forEach((group) => {
    const {
      courseCode, courseName, courseHours, startDate, students, teacher, groupNum,
    } = group;
    if (!students || students.length === 0) return;

    // finishDate is derived, never stored: hours -> 8h/day -> calendar days from startDate.
    const days = Math.max(1, Math.ceil((courseHours || getCourseHours(courseCode)) / 8));
    const finishDate = addDays(startDate, days - 1);
    const dateRange = (startDate && finishDate) ? `${startDate} - ${finishDate}` : (startDate || '');

    writeLabelRow(sheet, currentRow);
    currentRow += 1;

    writeValuesRow(sheet, currentRow, {
      courseName: courseName || getCourseName(courseCode),
      courseHours: courseHours || getCourseHours(courseCode),
      groupNum: groupNum || '',
      dateRange,
      teacher: teacher || '',
    });
    currentRow += 1;

    students.forEach((student, idx) => {
      writeStudentRow(sheet, currentRow, idx + 1, student);
      currentRow += 1;
    });

    writeSeparatorRow(sheet, currentRow);
    currentRow += 1;
  });

  writeFooterRow(sheet, currentRow);

  const buffer = await workbook.xlsx.writeBuffer();

  let fileName = 'Training_Plan.xlsx';
  const withStudents = groups.filter((g) => g.students && g.students.length > 0);
  if (withStudents.length === 1) {
    const g = withStudents[0];
    fileName = `Training_Plan_${g.courseCode}_${slugGroupNum(g.groupNum)}.xlsx`;
  } else if (withStudents.length > 1) {
    fileName = `Training_Plan_${withStudents.length}_kurs.xlsx`;
  }

  return { buffer, fileName };
}
