// Firebase Realtime Database — single source of truth for all İSTREGISTER data.
import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, onValue, set, update, remove, push, runTransaction,
} from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyABi2wFkLO3LsXCZTGSUX_jxV0dw3UbOAc",
  authDomain: "istregister.firebaseapp.com",
  databaseURL: "https://istregister-default-rtdb.firebaseio.com",
  projectId: "istregister",
  storageBucket: "istregister.firebasestorage.app",
  messagingSenderId: "784860362514",
  appId: "1:784860362514:web:bc706c8007dc43384165cb"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const RECORDS_PATH = 'istregister/records';
const TEACHERS_PATH = 'istregister/teachers';
const COURSE_SETTINGS_PATH = 'istregister/courseSettings';
const GROUP_COUNTERS_PATH = 'istregister/groupCounters';
const ARCHIVE_TRAINING_PLANS_PATH = 'istregister/archive/trainingPlans';
const ARCHIVE_JOURNALS_PATH = 'istregister/archive/jurnallar';
const ARCHIVE_PROTOKOLLAR_PATH = 'istregister/archive/protokollar';

export function recordsRef() {
  return ref(db, RECORDS_PATH);
}

export function singleRecordRef(id) {
  return ref(db, `${RECORDS_PATH}/${id}`);
}

// ---- Teachers (Admin Panel → Müəllimlər) ----
export function teachersRef() {
  return ref(db, TEACHERS_PATH);
}

export function singleTeacherRef(id) {
  return ref(db, `${TEACHERS_PATH}/${id}`);
}

// ---- Per-course settings: duration (days) + max participants ----
export function courseSettingsRef() {
  return ref(db, COURSE_SETTINGS_PATH);
}

export function singleCourseSettingRef(code) {
  return ref(db, `${COURSE_SETTINGS_PATH}/${code}`);
}

// ---- Per-course group-number counters (e.g. SL -> 038/26 -> 039/26 -> ...) ----
export function groupCountersRef(kind = 'trainingPlan') {
  return ref(db, kind === 'protokol' ? `${GROUP_COUNTERS_PATH}/protokol` : GROUP_COUNTERS_PATH);
}

export function singleGroupCounterRef(kind = 'trainingPlan', code) {
  return ref(db, kind === 'protokol'
    ? `${GROUP_COUNTERS_PATH}/protokol/${code}`
    : `${GROUP_COUNTERS_PATH}/${code}`);
}

// ---- Document archive (Training Plan + Jurnal + Protokol), kept fully in Firebase ----
function archivePath(kind) {
  if (kind === 'journal') return ARCHIVE_JOURNALS_PATH;
  if (kind === 'protokol') return ARCHIVE_PROTOKOLLAR_PATH;
  return ARCHIVE_TRAINING_PLANS_PATH;
}

export function archiveRef(kind) {
  return ref(db, archivePath(kind));
}

export function singleArchiveRef(kind, id) {
  return ref(db, `${archivePath(kind)}/${id}`);
}

export {
  db, onValue, set, update, remove, push, ref, runTransaction,
};
