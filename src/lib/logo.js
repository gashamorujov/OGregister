import logoUrl from '../assets/ist-logo.png?url';

export async function fetchLogoBuffer() {
  const resp = await fetch(logoUrl);
  return resp.arrayBuffer();
}
