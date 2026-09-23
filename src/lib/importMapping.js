// Shared schema + header-detection helpers for the İSTREGISTER data model.
//
// This is the single source of truth for the site's 14 record fields (their
// order and display labels) and for the logic that maps a REGİSTR-2026
// spreadsheet's column HEADERS onto those fields. Column position is never
// trusted — only header wording — so the importer keeps working even if the
// source spreadsheet's columns get reordered.

// Canonical field order used across the table, the preview, and the filters.
export const TARGET_FIELDS = [
  'fullName', 'serial', 'idNumber', 'birthDate', 'phone', 'email',
  'rank', 'fullNameId', 'rank2', 'courseCode', 'startDate', 'finishDate',
  'note', 'date',
];

// Display labels — identical wording to what the main grid shows, so the
// import preview matches the site exactly.
export const FIELD_LABELS = {
  fullName: 'Soyad, Ad və Ata adı',
  serial: 'Seriya nömrəsi',
  idNumber: 'Fərdi ID nömrəsi',
  birthDate: 'Doğum tarixi',
  phone: 'Telefon',
  email: 'Email',
  rank: 'Rank (Working Diploma)',
  fullNameId: 'Full Name (ID)',
  rank2: 'Rank / Vəzifə',
  courseCode: 'Course Code',
  startDate: 'Başlama tarixi',
  finishDate: 'Bitmə tarixi',
  note: 'Qeyd',
  date: 'Tarix',
};

// Unique identity used to detect already-existing records (import dedup).
export function rowKey(row) {
  return [row.fullName, row.serial, row.idNumber, row.courseCode]
    .map((v) => String(v || '').trim().toLowerCase())
    .join('|');
}

// A row only counts as a real record if it identifies a person — some
// spreadsheet exports drag a single value (e.g. a status column) down far
// past the real data with nothing else filled in, which "any field is
// non-empty" would otherwise mistake for genuine rows.
const IDENTITY_FIELDS = ['fullName', 'fullNameId', 'serial', 'idNumber'];

export function hasIdentitySignal(rec) {
  return IDENTITY_FIELDS.some((f) => String((rec && rec[f]) || '').trim());
}

// Which of a record's target fields hold no value.
export function emptyFieldsOf(rec) {
  return TARGET_FIELDS.filter((f) => !String((rec && rec[f]) || '').trim());
}

// --- Header-text matching -------------------------------------------------
// Azerbaijani header text shows up with inconsistent accents across exports
// (e.g. "Vezife" vs "Vəzifə"), so we fold everything to a plain ASCII,
// lower-case form before comparing.

const AZ_FOLD = {
  Ə: 'e', ə: 'e', I: 'i', İ: 'i', ı: 'i',
  Ö: 'o', ö: 'o', Ü: 'u', ü: 'u',
  Ğ: 'g', ğ: 'g', Ş: 's', ş: 's', Ç: 'c', ç: 'c',
};

export function normalizeHeader(str) {
  return String(str == null ? '' : str)
    .replace(/[ƏəIİıÖöÜüĞğŞşÇç]/g, (ch) => AZ_FOLD[ch] ?? ch)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// Ordered rules for matching a (normalized) header cell to a field. Order
// matters: more specific patterns must come before broader ones that would
// otherwise also match — e.g. "full name" is checked before the generic
// "soyad" rule (column I's real header contains both words), and the bare
// "tarix" rule is checked last since "doğum tarixi" / "başlama tarixi" also
// contain "tarix". `dual: true` marks a field whose header text the source
// sheet repeats verbatim for two different site columns (rank / rank2) —
// both occurrences are captured, assigned in the order they appear.
const RULES = [
  { field: 'fullNameId', test: (h) => h.includes('full name') },
  { field: 'fullName', test: (h) => h.includes('soyad') },
  { field: 'idNumber', test: (h) => h.includes('identifikasiya') },
  { field: 'serial', test: (h) => h.includes('seriya') },
  { field: 'birthDate', test: (h) => h.includes('dogum') },
  { field: 'startDate', test: (h) => h.includes('baslama') || h.includes('start date') },
  { field: 'finishDate', test: (h) => h.includes('bitme') || h.includes('finish date') },
  { field: 'phone', test: (h) => h.includes('telefon') || h.includes('phone') },
  { field: 'email', test: (h) => h.includes('mail') },
  { field: 'rank', test: (h) => h.includes('rank') && (h.includes('vezife') || h.includes('diplomu')), dual: true },
  { field: 'courseCode', test: (h) => h.includes('course code') || h.includes('telimin kodu') },
  { field: 'note', test: (h) => h.includes('qeyd') },
  { field: 'date', test: (h) => h === 'tarix' },
];

// A field claimed a second time by a `dual` rule goes here instead.
const DUAL_NEXT = { rank: 'rank2' };

// Minimum number of recognised columns before a row of text is trusted as
// the real header row, rather than a data row that happens to contain a
// matching word (e.g. an email column value).
export const HEADER_MATCH_THRESHOLD = 4;

/**
 * Reads one row's cell texts (array, index 0 = first column) and returns
 * which column holds each site field — by header wording, not position.
 *   colIndexToField: Map<columnIndex, fieldKey>
 *   matchedFields:   Set<fieldKey>
 */
export function detectColumnMapping(headerCells) {
  const colIndexToField = new Map();
  const claimed = new Set();
  const dualSeen = {};

  (headerCells || []).forEach((raw, idx) => {
    const h = normalizeHeader(raw);
    if (!h) return;
    for (const rule of RULES) {
      if (!rule.test(h)) continue;
      if (rule.dual) {
        const seen = dualSeen[rule.field] || 0;
        const field = seen === 0 ? rule.field : DUAL_NEXT[rule.field];
        if (!field || claimed.has(field)) break;
        dualSeen[rule.field] = seen + 1;
        colIndexToField.set(idx, field);
        claimed.add(field);
        break;
      }
      if (claimed.has(rule.field)) break;
      colIndexToField.set(idx, rule.field);
      claimed.add(rule.field);
      break;
    }
  });

  return { colIndexToField, matchedFields: claimed };
}
