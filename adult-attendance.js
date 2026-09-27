import { supabase } from './supabase-client.js';

const ATTENDANCE_KEY = 'bjj_adult_attendance';
const SETTINGS_KEY = 'bjj_adult_class_settings';
const ADULT_CLASS_DAYS = new Set([0, 1, 2, 3, 4, 6]);
const DEFAULT_SETTINGS = {
  startDate: '2026-07-01',
  sessions: [
    { id: 'mon-am', day: 1, slot: 'Morning', label: 'Beginners', start: '09:30', end: '11:30' },
    { id: 'mon-pm', day: 1, slot: 'Evening', label: 'Beginners', start: '18:30', end: '20:30' },
    { id: 'tue-am', day: 2, slot: 'Morning', label: 'No Gi', start: '09:30', end: '11:30' },
    { id: 'tue-pm', day: 2, slot: 'Evening', label: 'No Gi', start: '18:30', end: '20:30' },
    { id: 'wed-am', day: 3, slot: 'Morning', label: 'MMA and Wrestling', start: '09:30', end: '11:30' },
    { id: 'wed-pm', day: 3, slot: 'Evening', label: 'MMA and Wrestling', start: '18:30', end: '20:30' },
    { id: 'thu-am', day: 4, slot: 'Morning', label: 'Advanced', start: '09:30', end: '11:30' },
    { id: 'thu-pm', day: 4, slot: 'Evening', label: 'Advanced', start: '18:30', end: '20:30' },
    { id: 'sat', day: 6, slot: 'Open Mat', label: 'Open Mat', start: '09:30', end: '11:30' },
    { id: 'sun', day: 0, slot: 'Open Mat', label: 'Open Mat', start: '09:30', end: '11:30' }
  ]
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function todayISO() { return new Date().toISOString().split('T')[0]; }
function loadRecords() {
  try { const value = JSON.parse(localStorage.getItem(ATTENDANCE_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch (e) { return []; }
}
function saveRecords(list) { localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(list)); }

async function cloudStudentId(legacyId) {
  const { data, error } = await supabase.from('students').select('id').eq('program', 'adult').eq('legacy_id', Number(legacyId)).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function saveCloudRecord(record) {
  const studentId = await cloudStudentId(record.studentId);
  if (!studentId) throw new Error(`Cloud adult student not found for local ID ${record.studentId}`);
  let lookup = supabase.from('attendance').select('id').eq('student_id', studentId).eq('class_date', record.date);
  lookup = record.sessionId ? lookup.eq('session_id', record.sessionId) : lookup.is('session_id', null);
  const { data: existing, error: lookupError } = await lookup.maybeSingle();
  if (lookupError) throw lookupError;
  const payload = { student_id: studentId, class_date: record.date, session_id: record.sessionId || null, present: Boolean(record.present) };
  const result = existing ? await supabase.from('attendance').update(payload).eq('id', existing.id) : await supabase.from('attendance').insert(payload);
  if (result.error) throw result.error;
}

async function deleteCloudRecord(studentId, date, sessionId) {
  const cloudId = await cloudStudentId(studentId);
  if (!cloudId) return;
  let query = supabase.from('attendance').delete().eq('student_id', cloudId).eq('class_date', date);
  query = sessionId ? query.eq('session_id', sessionId) : query;
  const { error } = await query;
  if (error) throw error;
}

export async function syncFromCloud() {
  const { data, error } = await supabase
    .from('attendance')
    .select('class_date, session_id, present, students!inner(legacy_id, program)')
    .eq('students.program', 'adult')
    .order('class_date');
  if (error) throw error;
  const list = data.map((record) => ({ studentId: Number(record.students.legacy_id), date: record.class_date, ...(record.session_id ? { sessionId: record.session_id } : {}), present: record.present }));
  saveRecords(list);
  return list;
}

export function getSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (value && Array.isArray(value.sessions)) {
      if (value.startDate === '2026-01-01') {
        value.startDate = DEFAULT_SETTINGS.startDate;
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(value));
      }
      return value;
    }
  } catch (e) { /* use defaults */ }
  const defaults = clone(DEFAULT_SETTINGS);
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaults));
  return defaults;
}
export function saveSettings(settings) {
  const next = { startDate: settings.startDate || DEFAULT_SETTINGS.startDate, sessions: Array.isArray(settings.sessions) ? settings.sessions : clone(DEFAULT_SETTINGS.sessions) };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}
export function resetSettings() { return saveSettings(clone(DEFAULT_SETTINGS)); }
export function getSessionsForDate(date) {
  const day = new Date(`${date}T12:00:00`).getDay();
  return getSettings().sessions.filter((session) => session.day === day);
}
export function getSessionById(id) { return getSettings().sessions.find((session) => session.id === id) || null; }
export function isScheduledClassDate(date) { return getSessionsForDate(date).length > 0; }
export function getAttendance(studentId, date, sessionId = '') {
  const records = loadRecords().filter((record) => record.studentId === Number(studentId) && record.date === date && (sessionId ? record.sessionId === sessionId : true));
  return records.find((record) => record.present) || records[0] || null;
}
export function markAttendance(studentId, date, sessionIdOrPresent, presentValue) {
  const legacySessionId = typeof sessionIdOrPresent === 'string' ? sessionIdOrPresent : '';
  const present = typeof sessionIdOrPresent === 'string' ? presentValue : sessionIdOrPresent;
  const list = loadRecords();
  const index = list.findIndex((record) => record.studentId === Number(studentId) && record.date === date && (legacySessionId ? record.sessionId === legacySessionId : !record.sessionId));
  const record = { studentId: Number(studentId), date, ...(legacySessionId ? { sessionId: legacySessionId } : {}), present: Boolean(present) };
  if (index === -1) list.push(record); else list[index] = record;
  saveRecords(list);
  void saveCloudRecord(record).catch((error) => console.error('Cloud adult attendance save failed', error));
  return record;
}
export function deleteAttendance(studentId, date, sessionId) {
  saveRecords(loadRecords().filter((record) => !(record.studentId === Number(studentId) && record.date === date && (!sessionId || record.sessionId === sessionId))));
  void deleteCloudRecord(studentId, date, sessionId).catch((error) => console.error('Cloud adult attendance delete failed', error));
}
export function updateAttendance(studentId, oldDate, oldSessionIdOrNewDate, newDateOrPresent, newSessionId, presentValue) {
  const legacy = arguments.length >= 6;
  const oldSessionId = legacy ? oldSessionIdOrNewDate : '';
  const newDate = legacy ? newDateOrPresent : oldSessionIdOrNewDate;
  const present = legacy ? presentValue : newDateOrPresent;
  const list = loadRecords().filter((record) => !(record.studentId === Number(studentId) && record.date === oldDate && (legacy ? record.sessionId === oldSessionId : true)));
  const duplicateIndex = list.findIndex((record) => record.studentId === Number(studentId) && record.date === newDate && (legacy ? record.sessionId === newSessionId : !record.sessionId));
  const record = { studentId: Number(studentId), date: newDate, ...(legacy ? { sessionId: newSessionId } : {}), present: Boolean(present) };
  if (duplicateIndex === -1) list.push(record); else list[duplicateIndex] = record;
  saveRecords(list);
  void deleteCloudRecord(studentId, oldDate, oldSessionId).then(() => saveCloudRecord(record)).catch((error) => console.error('Cloud adult attendance update failed', error));
  return record;
}
export function getAllAttendance() {
  const byDate = new Map();
  loadRecords().forEach((record) => {
    const key = `${record.studentId}:${record.date}`;
    const current = byDate.get(key);
    if (!current || (!current.present && record.present)) byDate.set(key, record);
  });
  return [...byDate.values()];
}
export function getAllAttendanceForStudent(studentId) {
  const byDate = new Map();
  loadRecords().filter((record) => record.studentId === Number(studentId)).forEach((record) => {
    const current = byDate.get(record.date);
    if (!current || (!current.present && record.present)) byDate.set(record.date, record);
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function deleteAttendanceForStudent(studentId) {
  saveRecords(loadRecords().filter((record) => record.studentId !== Number(studentId)));
  void cloudStudentId(studentId).then((cloudId) => cloudId && supabase.from('attendance').delete().eq('student_id', cloudId).not('session_id', 'is', null)).catch((error) => console.error('Cloud adult student attendance delete failed', error));
}

export function getTotalClasses() {
  const settings = getSettings();
  const start = settings.startDate || DEFAULT_SETTINGS.startDate;
  const end = todayISO();
  let total = 0;
    for (let current = new Date(`${start}T12:00:00`); current <= new Date(`${end}T12:00:00`); current.setDate(current.getDate() + 1)) if (ADULT_CLASS_DAYS.has(current.getDay())) total += 1;
  return total;
}
export function getTotalAttended(studentId) { return new Set(getAllAttendanceForStudent(studentId).filter((record) => record.present && record.date >= getSettings().startDate && record.date <= todayISO()).map((record) => record.date)).size; }
export function getClassBreakdown(studentId) {
  const breakdown = {};
  getAllAttendanceForStudent(studentId).filter((record) => record.present && record.date >= getSettings().startDate && record.date <= todayISO()).forEach((record) => {
    const session = getSessionById(record.sessionId);
    const label = session ? session.label : record.sessionId;
    breakdown[label] = (breakdown[label] || 0) + 1;
  });
  return breakdown;
}
export function getRecentAttended(studentId, days = 30) {
  const end = new Date(`${todayISO()}T12:00:00`);
  end.setDate(end.getDate() - days + 1);
  const start = end.toISOString().split('T')[0];
  return getAllAttendanceForStudent(studentId).filter((record) => record.present && record.date >= start && record.date <= todayISO()).length;
}
export function getPercent(studentId) { const total = getTotalClasses(); return total ? Math.round((getTotalAttended(studentId) / total) * 100) : 0; }
export function getLastClass(studentId) {
  const records = getAllAttendanceForStudent(studentId).filter((record) => record.present);
  if (!records.length) return '';
  return records[records.length - 1].date;
}
export function getLastAttendedForSession(studentId, sessionId) {
  return getAllAttendanceForStudent(studentId)
    .filter((record) => record.present && record.sessionId === sessionId)
    .reduce((latest, record) => record.date > latest ? record.date : latest, '');
}

export default { getSettings, saveSettings, resetSettings, getSessionsForDate, getSessionById, isScheduledClassDate, getAttendance, markAttendance, deleteAttendance, updateAttendance, syncFromCloud, getAllAttendance, getAllAttendanceForStudent, deleteAttendanceForStudent, getTotalClasses, getTotalAttended, getClassBreakdown, getRecentAttended, getPercent, getLastClass, getLastAttendedForSession };
