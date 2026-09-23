// Realtime, Firebase-backed teacher list. Seeds itself from the bundled static
// list (src/data/teachers.js) on first use OR when SEED_VERSION changes,
// ensuring the admin panel always reflects the latest canonical teacher list.
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  teachersRef, singleTeacherRef, onValue,
  set as fbSet, update as fbUpdate, remove as fbRemove, push, ref, db,
} from './firebase';
import staticTeachers from '../data/teachers';

// Bump this string whenever teachers.js changes — triggers a full re-seed.
const SEED_VERSION = 'v4-2026-09-23-istregister';

export default function useTeachers() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const seededRef = useRef(false);

  useEffect(() => {
    const unsub = onValue(teachersRef(), async (snap) => {
      const val = snap.val();
      const metaRef = ref(db, 'istregister/meta/teacherSeedVersion');

      // Check seed version
      let currentVersion = null;
      try {
        const metaSnap = await new Promise((res) => {
          const u = onValue(metaRef, (s) => { res(s); u(); });
        });
        currentVersion = metaSnap.val();
      } catch (_) { /* ignore */ }

      const needsReseed = currentVersion !== SEED_VERSION;

      if (needsReseed && !seededRef.current) {
        seededRef.current = true;
        const data = {};
        staticTeachers.forEach((name, i) => { data[`ts-${i}`] = { name, active: true }; });
        try {
          // Replace all existing teachers with the new seed list
          await fbSet(teachersRef(), data);
          await fbSet(metaRef, SEED_VERSION);
        } catch (err) {
          console.error('Teacher reseed failed:', err);
        }
        setTeachers(staticTeachers.map((name, i) => ({ _id: `ts-${i}`, name, active: true })));
        setLoading(false);
        return;
      }

      if (val && typeof val === 'object' && Object.keys(val).length > 0) {
        const list = Object.entries(val).map(([id, data]) => ({
          _id: id,
          name: (data && data.name) || '',
          active: !(data && data.active === false),
        }));
        list.sort((a, b) => a.name.localeCompare(b.name, 'az'));
        setTeachers(list);
        setLoading(false);
      } else if (!seededRef.current) {
        seededRef.current = true;
        const data = {};
        staticTeachers.forEach((name, i) => { data[`ts-${i}`] = { name, active: true }; });
        fbUpdate(teachersRef(), data).catch((err) => console.error('Teacher seed failed:', err));
        fbSet(metaRef, SEED_VERSION).catch(() => {});
        setTeachers(staticTeachers.map((name, i) => ({ _id: `ts-${i}`, name, active: true })));
        setLoading(false);
      } else {
        setTeachers([]);
        setLoading(false);
      }
    }, (err) => { console.error('Teachers read error:', err); setLoading(false); });
    return () => unsub();
  }, []);

  const addTeacher = useCallback((name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const newRef = push(teachersRef());
    fbSet(newRef, { name: trimmed, active: true }).catch((err) => console.error('Teacher add failed:', err));
  }, []);

  const updateTeacher = useCallback((id, patch) => {
    if (!id) return;
    fbUpdate(singleTeacherRef(id), patch).catch((err) => console.error('Teacher update failed:', err));
  }, []);

  const removeTeacher = useCallback((id) => {
    if (!id) return;
    fbRemove(singleTeacherRef(id)).catch((err) => console.error('Teacher delete failed:', err));
  }, []);

  const activeTeachers = teachers.filter((t) => t.active);

  return {
    teachers, activeTeachers, loading, addTeacher, updateTeacher, removeTeacher,
  };
}
