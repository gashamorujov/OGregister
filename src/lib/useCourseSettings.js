// Realtime, Firebase-backed per-course settings: how many days a course runs
// (used to auto-generate Jurnal date columns) and its max participant count
// (used by the auto-grouping flow). Seeds itself from the bundled
// adminPanel.json (days) and the §4 default table (max participants) —
// after that, the Admin Panel's "Kurslar" tab is the single source of truth
// and overrides apply instantly everywhere.
import { useState, useEffect, useCallback } from 'react';
import { courseSettingsRef, singleCourseSettingRef, onValue, update as fbUpdate } from './firebase';
import courses from '../data/courses';
import adminDaysSeed from '../data/adminPanel.json';
import { getDefaultMaxParticipants } from '../data/courseDefaults';

const DAYS_SEED = {};
(adminDaysSeed || []).forEach(({ code, days }) => { DAYS_SEED[code] = days; });

function defaultDaysFor(code) {
  if (DAYS_SEED[code] != null) return DAYS_SEED[code];
  const hours = (courses[code] && courses[code].hours) || 8;
  return Math.max(1, Math.ceil(hours / 8));
}

export default function useCourseSettings() {
  const [overrides, setOverrides] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onValue(courseSettingsRef(), (snap) => {
      setOverrides(snap.val() || {});
      setLoading(false);
    }, (err) => { console.error('Course settings read error:', err); setLoading(false); });
    return () => unsub();
  }, []);

  const getDays = useCallback((code) => {
    const ov = overrides[code];
    if (ov && ov.days != null && ov.days !== '') return Number(ov.days);
    return defaultDaysFor(code);
  }, [overrides]);

  const getMaxParticipants = useCallback((code) => {
    const ov = overrides[code];
    if (ov && ov.maxParticipants != null && ov.maxParticipants !== '') return Number(ov.maxParticipants);
    return getDefaultMaxParticipants(code);
  }, [overrides]);

  const updateSetting = useCallback((code, patch) => {
    return fbUpdate(singleCourseSettingRef(code), patch)
      .catch((err) => console.error('Course setting update failed:', err));
  }, []);

  // Full table for the Admin Panel's "Kurslar" tab — one row per known course code.
  const settings = Object.keys(courses).map((code) => ({
    code,
    name: courses[code].name,
    hours: courses[code].hours,
    days: getDays(code),
    maxParticipants: getMaxParticipants(code),
  }));

  return {
    settings, loading, getDays, getMaxParticipants, updateSetting,
  };
}
