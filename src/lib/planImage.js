import { getCourseHours, getCourseName } from '../data/courses';

function parseLocalDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const parts = text.includes('.') ? text.split('.') : text.split('-').reverse();
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    ? null
    : date;
}

function formatLocalDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

function formatInputDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addLocalDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

export function getPlanDateRange(days, now = new Date(), selectedStartDate = '') {
  const safeDays = Math.max(1, Math.floor(Number(days) || 0));
  const selectedStart = parseLocalDate(selectedStartDate);
  const start = selectedStart || new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = addLocalDays(start, safeDays);
  return {
    start,
    end,
    inputStartDate: formatInputDate(start),
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
}

export function getPlanCourses(rows, startDate, endDate, getDays) {
  const from = parseLocalDate(startDate);
  const to = parseLocalDate(endDate);
  if (!from || !to) return [];

  const grouped = new Map();
  (rows || []).forEach((row) => {
    const courseCode = String(row?.courseCode || '').trim();
    const courseStart = parseLocalDate(row?.startDate);
    if (!courseCode || !courseStart || courseStart < from || courseStart > to) return;

    const key = `${courseCode}__${formatLocalDate(courseStart)}`;
    const current = grouped.get(key);
    if (current) {
      current.participantCount += 1;
      if (!current.finishDate && row.finishDate) current.finishDate = row.finishDate;
      return;
    }

    const configuredDays = Number(getDays?.(courseCode));
    const durationDays = Number.isFinite(configuredDays) && configuredDays > 0
      ? Math.floor(configuredDays)
      : Math.max(1, Math.ceil((getCourseHours(courseCode) || 8) / 8));
    const fallbackFinish = formatLocalDate(addLocalDays(courseStart, durationDays - 1));

    grouped.set(key, {
      courseName: getCourseName(courseCode),
      startDate: formatLocalDate(courseStart),
      finishDate: row.finishDate || fallbackFinish,
      participantCount: 1,
    });
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const dateDiff = parseLocalDate(a.startDate) - parseLocalDate(b.startDate);
    return dateDiff || a.courseName.localeCompare(b.courseName, 'az');
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

export function renderPlanImage(courses) {
  if (typeof document === 'undefined') throw new Error('Şəkil yaratmaq üçün brauzer tələb olunur.');

  const canvas = document.createElement('canvas');
  const width = 1600;
  const padding = 56;
  const tableWidth = width - padding * 2;
  const columns = [
    { label: ['Kursun adı'], width: 700, align: 'left' },
    { label: ['Başlama', 'tarixi'], width: 248, align: 'center' },
    { label: ['Bitmə', 'tarixi'], width: 248, align: 'center' },
    { label: ['İştirakçı sayı'], width: 292, align: 'center' },
  ];
  const headerHeight = 104;
  const rowPadding = 22;
  const lineHeight = 36;

  const measureCanvas = document.createElement('canvas');
  const measure = measureCanvas.getContext('2d');
  if (!measure) throw new Error('Şəkil ölçüləri hesablana bilmədi.');
  measure.font = '600 28px "Segoe UI", Arial, sans-serif';

  const prepared = (courses || []).map((course) => {
    const lines = wrapText(measure, course.courseName, columns[0].width - 44);
    return { ...course, lines, height: Math.max(78, lines.length * lineHeight + rowPadding * 2) };
  });
  const height = padding + headerHeight + prepared.reduce((sum, row) => sum + row.height, 0) + padding;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Şəkil çəkilə bilmədi.');
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  const left = padding;
  let y = padding;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(left, y, tableWidth, headerHeight);
  ctx.font = '700 24px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#ffffff';

  let x = left;
  columns.forEach((column) => {
    ctx.textAlign = column.align;
    ctx.textBaseline = 'middle';
    const textX = column.align === 'left' ? x + 22 : x + column.width / 2;
    const lineHeight = 29;
    const firstLineY = y + headerHeight / 2 - ((column.label.length - 1) * lineHeight) / 2;
    column.label.forEach((line, lineIndex) => {
      ctx.fillText(line, textX, firstLineY + lineIndex * lineHeight);
    });
    x += column.width;
  });

  y += headerHeight;
  prepared.forEach((course, rowIndex) => {
    ctx.fillStyle = rowIndex % 2 === 0 ? '#ffffff' : '#eef4f8';
    ctx.fillRect(left, y, tableWidth, course.height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, y, tableWidth, course.height);

    x = left;
    columns.forEach((column, columnIndex) => {
      if (columnIndex > 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + course.height);
        ctx.stroke();
      }
      x += column.width;
    });

    ctx.font = '600 28px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    course.lines.forEach((line, lineIndex) => {
      ctx.fillText(line, left + 22, y + rowPadding + lineHeight * (lineIndex + 0.8));
    });

    ctx.font = '600 28px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(course.startDate, left + columns[0].width + columns[1].width / 2, y + course.height / 2);
    ctx.fillText(course.finishDate, left + columns[0].width + columns[1].width + columns[2].width / 2, y + course.height / 2);
    ctx.font = '700 31px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#0f766e';
    ctx.fillText(String(course.participantCount), left + tableWidth - columns[3].width / 2, y + course.height / 2);
    y += course.height;
  });

  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}