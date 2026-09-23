// Real-time data hook: subscribes to the Firebase records node, keeps the UI
// optimistically in sync, auto-saves every edit and heals offline edits when
// the connection comes back.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  recordsRef,
  singleRecordRef,
  onValue,
  set as fbSet,
  update as fbUpdate,
  remove as fbRemove,
  db,
  ref,
} from './firebase';
import registeredData from '../data/registrData.json';

function generateId() {
  return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const EMPTY_ROW = {
  fullName: '', serial: '', idNumber: '', birthDate: '',
  phone: '', email: '', rank: '', fullNameId: '', rank2: '',
  courseCode: '', startDate: '', finishDate: '', note: '', date: '',
};

const MAX_HISTORY = 100;

// Firebase can hand back objects (rich text, text wrappers…) — flatten to
// plain display strings so cells always show clean text.
function sanitize(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (v.richText && Array.isArray(v.richText)) return v.richText.map(rt => rt.text || '').join('');
    if (v.text !== undefined) return String(v.text);
    if (v instanceof Date && !isNaN(v.getTime())) {
      const d = String(v.getUTCDate()).padStart(2, '0');
      const m = String(v.getUTCMonth() + 1).padStart(2, '0');
      return `${d}.${m}.${v.getUTCFullYear()}`;
    }
    return '';
  }
  const s = String(v);
  return s.includes('[object Object]') ? '' : s;
}

// Firebase Realtime Database never preserves insertion order for an object
// whose keys aren't its own auto-generated push IDs — it sorts children by
// its own key-ordering rules. Our record IDs (`reg-0`, `rec-<ts>-<rand>`,
// etc.) are compared as plain strings, so e.g. "rec-…" sorts before "reg-…"
// and "reg-10" sorts before "reg-2". Relying on key order for row order was
// exactly what made the first ~50 rows render blank (the old placeholder
// rows' "rec-…" ids happened to sort ahead of every real "reg-…" row). To
// make display order fully independent of Firebase's key sorting, every
// record carries an explicit numeric `order` field, and reads are always
// sorted by it. Records written before this field existed fall back to a
// large number so they sort after everything ordered, rather than jumping
// unpredictably to the front.
const NO_ORDER = Number.MAX_SAFE_INTEGER;

// A record with none of its identity/content fields filled in and no
// `order` of its own is a stray leftover placeholder row (e.g. from the
// batch of 50 blank rows an earlier version of this app used to seed) —
// not real data. These are dropped on read so they can never resurface as
// a block of empty rows, however Firebase happens to key them.
function isStrayBlankRow(data) {
  if (!data || typeof data !== 'object') return true;
  if (typeof data.order === 'number' && Number.isFinite(data.order)) return false;
  return Object.entries(data).every(([k, v]) => k === 'order' || !String(sanitize(v)).trim());
}

function sanitizeRecords(val) {
  const rows = Object.entries(val || {})
    .filter(([, data]) => !isStrayBlankRow(data))
    .map(([id, data]) => {
      const clean = {};
      for (const [k, v] of Object.entries(data || {})) {
        if (k === 'order') continue; // kept numeric, applied separately below
        clean[k] = sanitize(v);
      }
      const order = typeof data?.order === 'number' && Number.isFinite(data.order) ? data.order : NO_ORDER;
      return { _id: id, ...clean, order };
    });
  rows.sort((a, b) => (a.order - b.order) || String(a._id).localeCompare(String(b._id)));
  return rows;
}

function serializeRecord(row) {
  const { _id, ...rest } = row || {};
  return rest;
}

// Stamps every row with its array index as `order`, so the exact on-screen
// order at the moment of a write is what gets persisted and later re-read —
// independent of however Firebase itself would sort the keys.
function renumberOrder(rowsArr) {
  return rowsArr.map((r, i) => ({ ...r, order: i }));
}

// Render a usable registry immediately while the realtime subscription is
// negotiating. Firebase remains the source of truth and replaces this seed as
// soon as its first snapshot arrives; this avoids a blank/loading screen when
// the network is slow or temporarily unavailable.
//
// Only real registry rows are seeded — no blank placeholder rows. Use the
// "+" / context-menu row-insert action to add blank rows when needed.
function createLocalSeed() {
  return registeredData.map((r, i) => ({ _id: `reg-${i}`, order: i, ...r }));
}

export default function useFirebaseData() {
  const [rows, setRows] = useState(createLocalSeed);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(true);
  const [syncError, setSyncError] = useState('');

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  // Tracks writes we've made locally so we don't treat Firebase's own echo
  // of *our* write as an external change. Keyed by a monotonically
  // increasing token rather than a bare counter, so overlapping writes
  // (e.g. a cell edit landing while a reconnect-flush is still in flight)
  // can never desync the count the way a simple increment/decrement did.
  const pendingWritesRef = useRef(0);
  const dirtyRef = useRef(false);
  const seededRef = useRef(false);
  const mountedRef = useRef(true);
  // An empty snapshot is only trusted as "the database is really empty"
  // after it's been seen twice in a row. A single empty read is far more
  // likely to be a transient/race artifact (e.g. arriving between a
  // delete-then-reseed, or a brief permission/connection hiccup) than an
  // actual full wipe, and blindly clearing the grid on one such read was
  // exactly what made data appear to vanish ~1-2s after load.
  const emptyStreakRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Re-sync everything to Firebase (used by undo/redo and offline healing).
  const flushToFirebase = useCallback((nextRows) => {
    pendingWritesRef.current += 1;
    const ordered = renumberOrder(nextRows);
    const data = {};
    ordered.forEach(row => { data[row._id || generateId()] = serializeRecord(row); });
    return fbSet(recordsRef(), data)
      .then(() => { if (mountedRef.current) { dirtyRef.current = false; setSyncError(''); } })
      .catch(err => {
        console.error('Firebase write error:', err);
        dirtyRef.current = true;
        if (mountedRef.current) setSyncError('Bağlantı kəsildi — dəyişikliklər yenidən bağlandıqda sinxronlaşacaq.');
      })
      .finally(() => { pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1); });
  }, []);

  // Seed the database once with the built-in registry when it is empty.
  const seedOnce = useCallback(() => {
    seededRef.current = true;
    const seed = createLocalSeed();
    setRows(seed);
    const data = {};
    seed.forEach(row => { data[row._id] = serializeRecord(row); });
    pendingWritesRef.current += 1;
    fbUpdate(recordsRef(), data)
      .then(() => { dirtyRef.current = false; })
      .catch(err => console.error('Seed error:', err))
      .finally(() => { pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1); });
  }, []);

  // Live subscription — the table updates automatically for every session.
  //
  // We deliberately do NOT try to "skip" snapshots that echo our own writes
  // (a fragile counter approach used to live here and could desync whenever
  // writes overlapped, e.g. a cell edit firing while a reconnect-flush was
  // still in flight — causing either a stale skip of real external data, or
  // a spurious pass-through that wiped the grid). Instead we always apply
  // what Firebase reports — it is the single source of truth — and simply
  // avoid treating one isolated empty read as "the data is gone".
  useEffect(() => {
    const unsub = onValue(recordsRef(), (snap) => {
      if (!mountedRef.current) return;
      if (dirtyRef.current) return; // keep local unsynced edits; flushed on reconnect
      const val = snap.val();
      if (val && typeof val === 'object' && Object.keys(val).length > 0) {
        emptyStreakRef.current = 0;
        const sanitized = sanitizeRecords(val);
        setRows(sanitized);
        setLoading(false);
        // One-time self-heal: older data written before the `order` field
        // existed sorts by raw key as a fallback (see sanitizeRecords),
        // which is only ever "good enough", not correct. The first time
        // such data is loaded, silently persist proper sequential `order`
        // values so every future load sorts correctly with no fallback
        // needed — no manual migration step required.
        const needsOrderRepair = sanitized.some(r => r.order === NO_ORDER);
        if (needsOrderRepair && !dirtyRef.current) {
          const repaired = renumberOrder(sanitized);
          pendingWritesRef.current += 1;
          const updates = {};
          repaired.forEach(row => { updates[row._id] = serializeRecord(row); });
          fbUpdate(recordsRef(), updates)
            .catch(err => console.error('Order repair failed:', err))
            .finally(() => { pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1); });
        }
        return;
      }
      // Empty/null snapshot. If a write is still in flight, this is almost
      // certainly a transient intermediate state rather than real data
      // loss — ignore it and wait for the settled snapshot.
      if (pendingWritesRef.current > 0) return;
      emptyStreakRef.current += 1;
      if (!seededRef.current) {
        seedOnce();
        setLoading(false);
        return;
      }
      // Require two consecutive confirmed-empty reads before trusting that
      // the database is genuinely empty and clearing the grid.
      if (emptyStreakRef.current >= 2) {
        setRows([]);
      }
      setLoading(false);
    }, (err) => {
      console.error('Firebase read error:', err);
      if (mountedRef.current) {
        setLoading(false);
        setSyncError('Firebase oxunarkən xəta baş verdi: ' + (err?.message || err));
      }
    });
    return () => unsub();
  }, [seedOnce]);

  // Connection state + offline healing.
  useEffect(() => {
    const connRef = ref(db, '.info/connected');
    const unsub = onValue(connRef, (snap) => {
      if (!mountedRef.current) return;
      const isOnline = snap.val() === true;
      setConnected(isOnline);
      if (isOnline) {
        if (dirtyRef.current) {
          flushToFirebase(rowsRef.current);
        } else {
          setSyncError('');
        }
      }
    }, () => {});
    return () => unsub();
  }, [flushToFirebase]);

  const pushHistory = useCallback((before) => {
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), before];
    futureRef.current = [];
  }, []);

  // ---- Public operations (all auto-saved to Firebase) ----

  const updateCell = useCallback((rowId, field, value) => {
    setRows(prev => {
      const next = prev.map(r => (r._id === rowId ? { ...r, [field]: value } : r));
      pushHistory(prev);
      const row = next.find(r => r._id === rowId);
      if (row && rowId) {
        pendingWritesRef.current += 1;
        fbUpdate(singleRecordRef(rowId), serializeRecord(row))
          .then(() => {
            dirtyRef.current = false;
            if (mountedRef.current) setSyncError('');
          })
          .catch(err => {
            console.error('Cell save failed:', err);
            dirtyRef.current = true;
            if (mountedRef.current) setSyncError('Bağlantı kəsildi — dəyişikliklər yenidən bağlandıqda sinxronlaşacaq.');
          })
          .finally(() => { pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1); });
      }
      return next;
    });
  }, [pushHistory]);

  const addRow = useCallback((position, afterIndex) => {
    setRows(prev => {
      const newRow = { _id: generateId(), ...EMPTY_ROW };
      const inserted = [...prev];
      const idx = afterIndex !== undefined && afterIndex >= 0 ? afterIndex : prev.length - 1;
      if (position === 'above') inserted.splice(idx, 0, newRow);
      else inserted.splice(idx + 1, 0, newRow);
      pushHistory(prev);
      // The insert shifts every row after it, so all affected rows need
      // their `order` re-stamped to match — not just the new one.
      const next = renumberOrder(inserted);
      pendingWritesRef.current += 1;
      const updates = {};
      next.forEach(row => { updates[row._id] = serializeRecord(row); });
      fbUpdate(recordsRef(), updates)
        .then(() => { dirtyRef.current = false; })
        .catch(err => {
          console.error('Row add failed:', err);
          dirtyRef.current = true;
          if (mountedRef.current) setSyncError('Bağlantı kəsildi — dəyişikliklər yenidən bağlandıqda sinxronlaşacaq.');
        })
        .finally(() => { pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1); });
      return next;
    });
  }, [pushHistory]);

  const deleteRow = useCallback((index) => {
    setRows(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const target = prev[index];
      const filtered = prev.filter((_, i) => i !== index);
      pushHistory(prev);
      // Removal shifts every row after it, so re-stamp `order` on what's
      // left the same way addRow does.
      const next = renumberOrder(filtered);
      if (target?._id) {
        pendingWritesRef.current += 1;
        const updates = { [target._id]: null };
        next.forEach(row => { updates[row._id] = serializeRecord(row); });
        fbUpdate(recordsRef(), updates)
          .then(() => { dirtyRef.current = false; })
          .catch(err => {
            console.error('Row delete failed:', err);
            dirtyRef.current = true;
            if (mountedRef.current) setSyncError('Bağlantı kəsildi — silinmə yenidən bağlandıqda sinxronlaşacaq.');
          })
          .finally(() => { pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1); });
      }
      return next;
    });
  }, [pushHistory]);

  // Import: `added` are brand-new records, `updated` replace existing ones by
  // _id, and `removed` are _ids present locally but absent from the import
  // source — used for a full "mirror" sync where the spreadsheet is treated
  // as the source of truth and rows deleted there get deleted here too.
  const importRows = useCallback((added = [], updated = [], removed = []) => {
    setRows(prev => {
      const removedIds = new Set(removed);
      let merged = prev.filter(r => !removedIds.has(r._id));
      added.forEach(r => { merged.push({ _id: generateId(), ...r }); });
      updated.forEach(r => {
        const idx = merged.findIndex(x => x._id === r._id);
        if (idx >= 0) merged[idx] = { ...merged[idx], ...r };
        else merged.push({ _id: r._id, ...r });
      });
      pushHistory(prev);
      // New rows are appended and deletions shift what remains, so
      // re-stamp `order` across the whole merged array to match.
      const next = renumberOrder(merged);
      const byId = new Map(next.map(r => [r._id, r]));

      pendingWritesRef.current += 1;
      const updates = {};
      next.forEach(row => { updates[row._id] = serializeRecord(row); });
      removedIds.forEach(id => { if (!byId.has(id)) updates[id] = null; }); // null deletes the key in an update()
      fbUpdate(recordsRef(), updates)
        .then(() => { dirtyRef.current = false; if (mountedRef.current) setSyncError(''); })
        .catch(err => {
          console.error('Import write failed:', err);
          dirtyRef.current = true;
          if (mountedRef.current) setSyncError('Bağlantı kəsildi — idxal yenidən bağlandıqda sinxronlaşacaq.');
        })
        .finally(() => { pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1); });
      return next;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const snapshot = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    futureRef.current = [rowsRef.current, ...futureRef.current];
    setRows(snapshot);
    flushToFirebase(snapshot);
  }, [flushToFirebase]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const snapshot = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    historyRef.current = [...historyRef.current, rowsRef.current];
    setRows(snapshot);
    flushToFirebase(snapshot);
  }, [flushToFirebase]);

  return {
    rows,
    loading,
    connected,
    syncError,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    updateCell,
    addRow,
    deleteRow,
    importRows,
    undo,
    redo,
  };
}
