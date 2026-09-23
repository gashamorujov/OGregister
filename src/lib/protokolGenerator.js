import { getCourseHours, getCourseName } from '../data/courses';
import { addDays, formatGroupLabel } from './courseGroups';
import { fetchProtokolTemplateBuffer } from './templates';
import {
  loadDocxXml, saveDocxXml, replaceEverywhere, replaceValueAfterLabel, replaceTableRows, replaceExactRun,
} from './docxTemplate';

/* ============================================================================
 * Protokol export.
 * ----------------------------------------------------------------------------
 * Loads the real reference file (src/assets/protokol_template.docx, the
 * exact file supplied as the master template) and edits word/document.xml
 * directly, replacing only the values that are meant to change — the
 * legal boilerplate, headings and signature lines are never touched.
 *
 * `group` is one already-generated Jurnal archive entry (see useArchive.js
 * with kind 'journal') — the group number, course, dates, teacher and
 * roster all come from there, which is what keeps the two documents
 * necessarily in agreement (§14/§24 of the update spec): there is no
 * separate "protocol group number" to type in and get wrong.
 * ========================================================================== */

// Known sample values baked into the reference file.
const SAMPLE = {
  groupLabel: '046/26 SOXQ',
  courseName: 'Sürətli olmayan xilasedici qayıq, növbətçi qayıq və sallar üzrə mütəxəssis',
  dateRange: '12.09.2026-15.09.2026',
  studentCountLabel: 'Dinləyicilərin ümumi sayı',
  firstStudentMarker: 'Əliyev Əli Rafiq',
  lastStudentMarker: 'Kazımzadə Cavidan Çingiz',
  sampleSeq: '1',
  sampleName: 'Əliyev Əli Rafiq',
  sampleRank: 'Növbə matrosu',
};

function slugGroupNum(groupNum) {
  return String(groupNum || '').replace(/[\\/]/g, '-').replace(/\s+/g, '');
}

export async function generateProtokol(group, opts) {
  const options = opts || {};
  const getDays = options.getDays;

  const buffer = await fetchProtokolTemplateBuffer();
  const { zip, xml: loadedXml } = await loadDocxXml(buffer);
  let xml = loadedXml;

  const courseName = group.courseName || getCourseName(group.courseCode);
  const totalDays = Math.max(
    1,
    getDays ? getDays(group.courseCode) : Math.ceil((group.courseHours || getCourseHours(group.courseCode) || 8) / 8),
  );
  const finishDate = addDays(group.startDate, totalDays - 1);
  const dateRange = (group.startDate && finishDate) ? (group.startDate + '-' + finishDate) : (group.startDate || '');
  const groupLabel = formatGroupLabel(group.groupNum, group.courseCode);
  const students = group.students || [];

  // "PROTOKOL №" and the "Qrup nömrəsi" table row both show this same
  // label — one global replace keeps them identical by construction.
  xml = replaceEverywhere(xml, SAMPLE.groupLabel, groupLabel);
  // The course's full name — embedded in the legal paragraph and the
  // "Təlimin adı" row.
  xml = replaceEverywhere(xml, SAMPLE.courseName, courseName);
  // "Tədris müddəti".
  xml = replaceEverywhere(xml, SAMPLE.dateRange, dateRange);
  // "Dinləyicilərin ümumi sayı" — too generic a value ("4") to search for
  // globally, so it's targeted by the label right before it instead.
  xml = replaceValueAfterLabel(xml, SAMPLE.studentCountLabel, String(students.length));
  // "İştirak etməyənlər" is left at the template's own default ("-") —
  // the system has no per-student "did not attend" flag to report here.

  // Participant table: clone the template's own row once per student.
  // "Nəticə" is left as the template's default ("İştirak etdi") for the
  // same reason as above.
  xml = replaceTableRows(xml, SAMPLE.firstStudentMarker, SAMPLE.lastStudentMarker, students, (rowXml, student, idx) => {
    let row = rowXml;
    row = replaceExactRun(row, SAMPLE.sampleSeq, String(idx + 1));
    row = replaceExactRun(row, SAMPLE.sampleName, student.fullName || '');
    row = replaceExactRun(row, SAMPLE.sampleRank, student.rank || '');
    return row;
  });

  const outBuffer = await saveDocxXml(zip, xml);
  const fileName = 'Protokol_' + group.courseCode + '_' + slugGroupNum(group.groupNum) + '.docx';
  return { buffer: outBuffer, fileName };
}
