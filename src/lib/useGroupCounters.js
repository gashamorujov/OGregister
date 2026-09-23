// Realtime, Firebase-backed per-course group-number counters
// (e.g. SL: 038/26 -> 039/26 -> 040/26 -> ...).
//
// The year is intentionally NEVER stored — it is always computed live from
// the system clock (current year's last two digits) so it rolls over
// automatically at New Year with no admin action and no stale value can
// ever get stuck in Firebase. Only the sequence number is persisted.
//
// `allocate()` uses a Firebase transaction, so two people generating
// documents for the same course at the same moment can never be handed the
// same group number ("Duplicate qrup nömrələrinin qarşısının alınması").
import { useState, useEffect, useCallback } from 'react';
import {
  groupCountersRef, singleGroupCounterRef, onValue, runTransaction, update as fbUpdate,
} from './firebase';

/** Always read live — never cached at module-load time — so a page left open
 * across a New Year's rollover still shows the new year without a reload. */
function currentYearSuffix() {
  return String(new Date().getFullYear()).slice(-2);
}

function formatGroupNumber(seq, year) {
  return `${String(seq).padStart(3, '0')}/${year}`;
}

export default function useGroupCounters() {
  const [counters, setCounters] = useState({});
  const [protokolCounters, setProtokolCounters] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onValue(groupCountersRef(), (snap) => {
      setCounters(snap.val() || {});
      setLoading(false);
    }, (err) => { console.error('Group counters read error:', err); setLoading(false); });
    const unsubProtokol = onValue(groupCountersRef('protokol'), (snap) => {
      setProtokolCounters(snap.val() || {});
    }, (err) => console.error('Protokol counters read error:', err));
    return () => { unsub(); unsubProtokol(); };
  }, []);

  /** Read-only preview of the next number for a course code (does not consume it). */
  const peekNext = useCallback((code) => {
    const c = counters[code];
    const seq = c && c.seq != null ? Number(c.seq) + 1 : 1;
    return formatGroupNumber(seq, currentYearSuffix());
  }, [counters]);

  /**
   * Atomically allocates `count` sequential group numbers for a course code
   * and persists the new counter value. Returns the array of formatted
   * numbers in ascending order, e.g. allocate('SL', 2) -> ['038/26','039/26'].
   */
  const allocate = useCallback(async (code, count = 1) => {
    const nodeRef = singleGroupCounterRef('trainingPlan', code);
    const txResult = await runTransaction(nodeRef, (current) => {
      const seq = current && current.seq != null ? Number(current.seq) : 0;
      return { seq: seq + count };
    });
    const finalVal = (txResult && txResult.snapshot && txResult.snapshot.val()) || { seq: count };
    const lastSeq = Number(finalVal.seq);
    const year = currentYearSuffix();
    const numbers = [];
    for (let i = count - 1; i >= 0; i -= 1) {
      numbers.push(formatGroupNumber(lastSeq - i, year));
    }
    return numbers;
  }, []);

  const peekNextProtokol = useCallback((code) => {
    const c = protokolCounters[code];
    const seq = c && c.seq != null ? Number(c.seq) + 1 : 1;
    return formatGroupNumber(seq, currentYearSuffix());
  }, [protokolCounters]);

  const allocateProtokol = useCallback(async (code, count = 1) => {
    const nodeRef = singleGroupCounterRef('protokol', code);
    const txResult = await runTransaction(nodeRef, (current) => {
      const seq = current && current.seq != null ? Number(current.seq) : 0;
      return { seq: seq + count };
    });
    const finalVal = (txResult && txResult.snapshot && txResult.snapshot.val()) || { seq: count };
    const lastSeq = Number(finalVal.seq);
    const year = currentYearSuffix();
    return Array.from({ length: count }, (_, i) => formatGroupNumber(lastSeq - count + i + 1, year));
  }, []);

  /** Manual admin override of the sequence — applies instantly, any time. */
  const setCounter = useCallback((code, seq) => fbUpdate(singleGroupCounterRef(code), {
    seq: Number(seq) || 0,
  }).catch((err) => console.error('Group counter update failed:', err)), []);

  const setCounterProtokol = useCallback((code, seq) => fbUpdate(singleGroupCounterRef('protokol', code), {
    seq: Number(seq) || 0,
  }).catch((err) => console.error('Protokol counter update failed:', err)), []);

  return {
    counters, loading, peekNext, allocate, setCounter,
    peekNextProtokol, allocateProtokol, setCounterProtokol, currentYear: currentYearSuffix(),
  };
}
