import { supabase } from './supabase-client.js';

const STORAGE_KEY = 'bjj_attendance';
const CLASS_START_KEY = 'bjj_class_start_date';
const DEFAULT_CLASS_START = '2026-07-28';

function loadAttendance() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveAttendance(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

async function cloudStudentId(legacyId) {
  const { data, error } = await supabase
    .from('students')
    .select('id')
    .eq('program', 'kids')
    .eq('legacy_id', Number(legacyId))
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function saveCloudRecord(record) {
  const studentId = await cloudStudentId(record.studentId);
  if (!studentId) throw new Error(`Cloud student not found for local ID ${record.studentId}`);
  const { data: existing, error: lookupError } = await supabase
    .from('attendance')
    .select('id')
    .eq('student_id', studentId)
    .eq('class_date', record.date)
    .is('session_id', null)
    .maybeSingle();
  if (lookupError) throw lookupError;
  const payload = { student_id: studentId, class_date: record.date, session_id: null, present: Boolean(record.present) };
  const result = existing
    ? await supabase.from('attendance').update(payload).eq('id', existing.id)
    : await supabase.from('attendance').insert(payload);
  if (result.error) throw result.error;
}

async function deleteCloudRecord(studentId, date) {
  const cloudId = await cloudStudentId(studentId);
  if (!cloudId) return;
  const { error } = await supabase.from('attendance').delete().eq('student_id', cloudId).eq('class_date', date).is('session_id', null);
  if (error) throw error;
}

export async function syncFromCloud() {
  const { data, error } = await supabase
    .from('attendance')
    .select('class_date, present, students!inner(legacy_id, program)')
    .eq('students.program', 'kids')
    .is('session_id', null)
    .order('class_date');
  if (error) throw error;
  const list = data.map((record) => ({ studentId: Number(record.students.legacy_id), date: record.class_date, present: record.present }));
  saveAttendance(list);
  return list;
}

function normalizeDate(date) {
  if (!date) return null;
  if (typeof date === 'string') return date;
  // Date object
  return date.toISOString().split('T')[0];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function isValidISODate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''));
}

function toLocalDate(dateStr) {
  // Use local midnight to avoid timezone drift around UTC boundaries.
  return new Date(`${dateStr}T00:00:00`);
}

function toISOFromLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isScheduledClassDate(date) {
  const d = normalizeDate(date);
  if (!d || !isValidISODate(d)) return false;
  const day = toLocalDate(d).getDay();
  return day === 2 || day === 4; // Tue/Thu
}

export function getClassStartDate() {
  const stored = localStorage.getItem(CLASS_START_KEY);
  if (stored && isValidISODate(stored)) return stored;
  if (!stored) localStorage.setItem(CLASS_START_KEY, DEFAULT_CLASS_START);
  return DEFAULT_CLASS_START;
}

export function setClassStartDate(date) {
  const d = normalizeDate(date);
  if (!d || !isValidISODate(d)) throw new Error('Invalid class start date');
  localStorage.setItem(CLASS_START_KEY, d);
  return d;
}

function isWithinClassWindow(dateStr, endDate = todayISO()) {
  const start = getClassStartDate();
  return dateStr >= start && dateStr <= endDate;
}

function getScheduledClassDates(endDate = todayISO()) {
  const start = getClassStartDate();
  if (endDate < start) return [];

  const out = [];
  let d = toLocalDate(start);
  const end = toLocalDate(endDate);

  while (d <= end) {
    const day = d.getDay();
    if (day === 2 || day === 4) {
      out.push(toISOFromLocalDate(d));
    }
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function markAttendance(studentId, date, present) {
  const d = normalizeDate(date);
  if (!d) throw new Error('Invalid date');
  const id = Number(studentId);
  const list = loadAttendance();
  const idx = list.findIndex(r => r.studentId === id && r.date === d);
  const record = { studentId: id, date: d, present: !!present };
  if (idx === -1) {
    list.push(record);
  } else {
    list[idx] = record;
  }
  saveAttendance(list);
  void saveCloudRecord(record).catch((error) => console.error('Cloud attendance save failed', error));
  return record;
}

export function getAttendanceForDate(date) {
  const d = normalizeDate(date);
  return loadAttendance().filter(r => r.date === d);
}

export function getAttendance(studentId, date) {
  const d = normalizeDate(date);
  const id = Number(studentId);
  return loadAttendance().find(r => r.studentId === id && r.date === d) || null;
}

export function getAllAttendanceForStudent(studentId) {
  const id = Number(studentId);
  return loadAttendance().filter(r => r.studentId === id).sort((a,b)=> a.date.localeCompare(b.date));
}

export function getTotalAttended(studentId) {
  const endDate = todayISO();
  // Count only scheduled class days between configured start date and today.
  const presentDates = new Set(
    getAllAttendanceForStudent(studentId)
      .filter(r => r.present)
      .map(r => r.date)
      .filter(d => isWithinClassWindow(d, endDate) && isScheduledClassDate(d))
  );
  return presentDates.size;
}

export function getTotalClasses(studentId) {
  // Student-independent class count from start date through today (Tue/Thu only).
  void studentId;
  return getScheduledClassDates(todayISO()).length;
}

export function getPercent(studentId) {
  const total = getTotalClasses(studentId);
  if (total === 0) return 0;
  const attended = getTotalAttended(studentId);
  return Math.round((attended / total) * 100);
}

export function getLastClass(studentId) {
  const endDate = todayISO();
  const attended = getAllAttendanceForStudent(studentId)
    .filter(r => r.present)
    .filter(r => isWithinClassWindow(r.date, endDate) && isScheduledClassDate(r.date));
  if (attended.length === 0) return null;
  // Dates are ISO strings; pick max lexicographically
  const last = attended.reduce((a,b)=> a.date > b.date ? a : b);
  return last.date;
}

export function getLastAttended(studentId) {
  const records = getAllAttendanceForStudent(studentId).filter((record) => record.present);
  return records.reduce((latest, record) => record.date > latest ? record.date : latest, '');
}

export function getAllAttendance() {
  return loadAttendance();
}

export function deleteAttendance(studentId, date) {
  const d = normalizeDate(date);
  const id = Number(studentId);
  const list = loadAttendance();
  const filtered = list.filter(r => !(r.studentId === id && r.date === d));
  saveAttendance(filtered);
  void deleteCloudRecord(id, d).catch((error) => console.error('Cloud attendance delete failed', error));
  return true;
}

export function updateAttendance(studentId, oldDate, newDate, present) {
  const oldD = normalizeDate(oldDate);
  const newD = normalizeDate(newDate);
  const id = Number(studentId);
  const list = loadAttendance();
  // remove old record if date changed or overwrite existing
  const other = list.filter(r => !(r.studentId === id && r.date === oldD));
  // ensure we don't keep duplicate for same student+newDate
  const withoutDup = other.filter(r => !(r.studentId === id && r.date === newD));
  const record = { studentId: id, date: newD, present: !!present };
  withoutDup.push(record);
  saveAttendance(withoutDup);
  void deleteCloudRecord(id, oldD).then(() => saveCloudRecord(record)).catch((error) => console.error('Cloud attendance update failed', error));
  return record;
}

export function deleteAttendanceForStudent(studentId) {
  const id = Number(studentId);
  const list = loadAttendance();
  const filtered = list.filter(r => r.studentId !== id);
  saveAttendance(filtered);
  void cloudStudentId(id).then((cloudId) => cloudId && supabase.from('attendance').delete().eq('student_id', cloudId).is('session_id', null)).catch((error) => console.error('Cloud student attendance delete failed', error));
  return true;
}

export default {
  markAttendance,
  syncFromCloud,
  getAttendanceForDate,
  getAttendance,
  getTotalAttended,
  getTotalClasses,
  getPercent,
  getLastClass,
  getLastAttended,
  getAllAttendance,
  isScheduledClassDate,
  getClassStartDate,
  setClassStartDate,
};
