// Small shared helpers: trigger a browser download for a generated workbook
// buffer, and convert to/from base64 so a copy can be stored in the Firebase
// archive (§11) and re-downloaded later ("Yüklə" / "Yenidən aç").
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function downloadBuffer(buffer, fileName, mimeType) {
  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // iOS/Android browsers may start the download asynchronously; revoking the
  // object URL immediately can result in an empty file or a generic error.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadWorkbookBuffer(buffer, fileName) {
  downloadBuffer(buffer, fileName, XLSX_MIME);
}

export function downloadDocxBuffer(buffer, fileName) {
  downloadBuffer(buffer, fileName, DOCX_MIME);
}

export function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export function downloadBase64Xlsx(base64, fileName) {
  downloadWorkbookBuffer(base64ToBuffer(base64), fileName);
}

export function downloadBase64Docx(base64, fileName) {
  downloadDocxBuffer(base64ToBuffer(base64), fileName);
}

/** Picks the right MIME type from a stored archive entry's file name, for
 * generic code (like the Admin Panel's ArchiveTab) that handles both
 * Jurnal/Training Plan (.xlsx) and Protokol (.docx) entries the same way. */
export function mimeForFileName(fileName) {
  return String(fileName || '').toLowerCase().endsWith('.docx') ? DOCX_MIME : XLSX_MIME;
}

export function downloadBase64File(base64, fileName) {
  downloadBuffer(base64ToBuffer(base64), fileName, mimeForFileName(fileName));
}
