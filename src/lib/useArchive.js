// Realtime, Firebase-backed archive for generated documents (§11).
// `kind` is either 'trainingPlan' or 'journal' — each keeps its own list
// under istregister/archive/{trainingPlans|jurnallar}. Every entry stores the
// generated file itself (base64) plus the exact student roster and settings
// used, so "Redaktə et" can regenerate the file after an edit and "Sil"
// removes it from Firebase immediately, everywhere.
import { useState, useEffect, useCallback } from 'react';
import {
  archiveRef, singleArchiveRef, onValue, set as fbSet, update as fbUpdate, remove as fbRemove, push,
} from './firebase';

export default function useArchive(kind) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onValue(archiveRef(kind), (snap) => {
      const val = snap.val();
      const list = val ? Object.entries(val).map(([id, data]) => ({ _id: id, ...data })) : [];
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setItems(list);
      setLoading(false);
    }, (err) => { console.error('Archive read error:', err); setLoading(false); });
    return () => unsub();
  }, [kind]);

  const addEntry = useCallback((entry) => {
    const newRef = push(archiveRef(kind));
    return fbSet(newRef, { ...entry, createdAt: Date.now() })
      .then(() => newRef.key)
      .catch((err) => {
        console.error('Archive add failed:', err);
        throw err;
      });
  }, [kind]);

  const updateEntry = useCallback((id, patch) => {
    if (!id) return Promise.resolve();
    return fbUpdate(singleArchiveRef(kind, id), patch)
      .catch((err) => console.error('Archive update failed:', err));
  }, [kind]);

  const removeEntry = useCallback((id) => {
    if (!id) return Promise.resolve();
    return fbRemove(singleArchiveRef(kind, id))
      .catch((err) => console.error('Archive delete failed:', err));
  }, [kind]);

  return {
    items, loading, addEntry, updateEntry, removeEntry,
  };
}
