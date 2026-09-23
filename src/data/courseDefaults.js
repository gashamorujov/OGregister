// Default "maksimum iştirakçı sayı" (max participants) per course code.
// SP / SI / SH / SG / ST / SX = 15, everything else = 12.
// These are only the starting defaults — the Admin Panel's "Kurslar" tab can
// override any course code's value, and that override is stored in Firebase
// (istregister/courseSettings/<code>.maxParticipants) so it applies instantly
// everywhere, on every device.
const FIFTEEN_CODES = new Set(['SP', 'SI', 'SH', 'SG', 'ST', 'SX']);

export const DEFAULT_MAX_PARTICIPANTS = 12;

export function getDefaultMaxParticipants(code) {
  return FIFTEEN_CODES.has(code) ? 15 : DEFAULT_MAX_PARTICIPANTS;
}
