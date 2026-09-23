// Fetches the two "master template" files that ship with the app and are
// used verbatim (not redrawn) as the base for every generated document —
// see journalGenerator.js and protokolGenerator.js. Same pattern as
// logo.js: the file is a bundled asset, fetched once per generation call
// as a raw ArrayBuffer.
import jurnalTemplateUrl from '../assets/jurnal_template.xlsx?url';
import protokolTemplateUrl from '../assets/protokol_template.docx?url';

export async function fetchJurnalTemplateBuffer() {
  const resp = await fetch(jurnalTemplateUrl);
  return resp.arrayBuffer();
}

export async function fetchProtokolTemplateBuffer() {
  const resp = await fetch(protokolTemplateUrl);
  return resp.arrayBuffer();
}
