// Shared "group students by course + start date" logic used by:
//  - the Training Plan generator
//  - the Jurnal (journal) generator
//  - the auto-grouping (max-participant overflow) flow
//
// Having one shared implementation means a course group split into two
// sub-groups (§5 of the spec) is split identically no matter which document
// gets generated from it, and the two documents always agree on rosters.
import { getCourseName, getCourseHours, getCourseShortName } from '../data/courses';

/**
 * "046/26" + "SL" -> "046/26 SOXQ" — the combined label the Protokol uses
 * for its "PROTOKOL №" / "Qrup nömrəsi" fields (both must show the same
 * text). The bare sequential groupNum itself is left untouched everywhere
 * else (Jurnal's own "Qrup №" cell, the archive, filenames) — this
 * combined form is only for places that are meant to show it, i.e. the
 * Protokol document and its group picker.
 */
export function formatGroupLabel(groupNum, courseCode) {
  const shortName = getCourseShortName(courseCode);
  const base = groupNum || '';
  return shortName ? `${base} ${shortName}`.trim() : base;
}

/** dd.mm.yyyy + N days -> dd.mm.yyyy (same helper used by both generators). */
export function addDays(dateStr, days) {
  if (!dateStr) return '';
  const parts = dateStr.split('.');
  if (parts.length !== 3) return '';
  const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  d.setDate(d.getDate() + days);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/**
 * Groups records by courseCode + startDate (finishDate is ignored — it is
 * always derived, never stored) and returns one entry per group, each
 * carrying its full student roster.
 */
export function buildCourseGroups(records) {
  const groups = {};
  const order = [];
  (records || []).forEach((r) => {
    if (!r || (!r.fullName && !r.courseCode)) return;
    if (!r.courseCode) return;
    const key = `${r.courseCode}__${r.startDate || ''}`;
    if (!groups[key]) {
      groups[key] = {
        key,
        courseCode: r.courseCode,
        courseName: getCourseName(r.courseCode),
        courseHours: getCourseHours(r.courseCode),
        startDate: r.startDate || '',
        students: [],
      };
      order.push(key);
    }
    groups[key].students.push(r);
  });
  return order.map((k) => {
    const g = groups[k];
    return { ...g, studentCount: g.students.length };
  });
}

/**
 * Splits one course group into two sequential sub-groups (used by the
 * auto-grouping / max-participant overflow flow). The first `firstCount`
 * students (in original row order) become sub-group 1, the rest sub-group 2.
 */
export function splitGroupBySize(group, firstCount) {
  const total = group.students.length;
  const n1 = Math.max(1, Math.min(total - 1, Math.round(firstCount)));
  const part1 = group.students.slice(0, n1);
  const part2 = group.students.slice(n1);
  const mk = (students, subIndex) => ({
    ...group,
    key: `${group.key}__sub${subIndex}`,
    subIndex,
    subLabel: `Qrup ${subIndex}`,
    students,
    studentCount: students.length,
  });
  return [mk(part1, 1), mk(part2, 2)];
}
