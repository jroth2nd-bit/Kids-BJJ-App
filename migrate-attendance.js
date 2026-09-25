import { supabase } from './supabase-client.js';

const summary = document.getElementById('migrationSummary');
const status = document.getElementById('migrationStatus');
const refreshButton = document.getElementById('refreshMigration');
const migrateButton = document.getElementById('migrateAttendance');

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function readObject(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? value : fallback;
  } catch (error) {
    return fallback;
  }
}

function localData() {
  return {
    kids: readList('bjj_attendance'),
    adults: readList('bjj_adult_attendance'),
    adultSettings: readObject('bjj_adult_class_settings', { sessions: [] }),
  };
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', isError);
}

function renderPreview() {
  const data = localData();
  summary.innerHTML = '';
  const total = document.createElement('strong');
  total.textContent = `Total attendance records: ${data.kids.length + data.adults.length}`;
  const breakdown = document.createElement('span');
  breakdown.textContent = `Kids: ${data.kids.length} | Adults: ${data.adults.length}`;
  const sessions = document.createElement('span');
  sessions.textContent = `Adult class sessions configured: ${data.adultSettings.sessions?.length || 0}`;
  summary.append(total, breakdown, sessions);
  setStatus('Ready to preview or migrate.');
}

async function getCloudStudents() {
  const { data, error } = await supabase.from('students').select('id, legacy_id, program');
  if (error) throw error;
  return new Map(data.map((student) => [`${student.program}:${student.legacy_id}`, student.id]));
}

async function migrate() {
  const data = localData();
  const total = data.kids.length + data.adults.length;
  if (total === 0) {
    setStatus('No local attendance records were found.', true);
    return;
  }

  migrateButton.disabled = true;
  setStatus(`Preparing ${total} attendance records...`);
  try {
    const studentIds = await getCloudStudents();
    const missing = [];
    const sessions = (data.adultSettings.sessions || []).map((session) => ({
      id: session.id,
      program: 'adult',
      day_of_week: Number(session.day),
      slot: String(session.slot || ''),
      label: String(session.label || ''),
      start_time: session.start || null,
      end_time: session.end || null,
      active: true,
    }));

    if (sessions.length) {
      const { error } = await supabase.from('class_sessions').upsert(sessions, { onConflict: 'id' });
      if (error) throw error;
    }

    const rows = [];
    data.kids.forEach((record) => {
      const studentId = studentIds.get(`kids:${record.studentId}`);
      if (!studentId) missing.push(`kids:${record.studentId}`);
      else rows.push({ student_id: studentId, class_date: record.date, session_id: null, present: Boolean(record.present) });
    });
    data.adults.forEach((record) => {
      const studentId = studentIds.get(`adult:${record.studentId}`);
      if (!studentId) missing.push(`adult:${record.studentId}`);
      else rows.push({ student_id: studentId, class_date: record.date, session_id: record.sessionId || null, present: Boolean(record.present) });
    });

    if (missing.length) throw new Error(`Missing cloud students: ${missing.join(', ')}`);
    const { error } = await supabase.from('attendance').insert(rows);
    if (error) throw error;
    setStatus(`Migration complete: ${rows.length} attendance records copied and ${sessions.length} adult sessions prepared.`);
  } catch (error) {
    setStatus(`Migration failed: ${error.message}`, true);
  } finally {
    migrateButton.disabled = false;
  }
}

refreshButton.addEventListener('click', renderPreview);
migrateButton.addEventListener('click', migrate);
renderPreview();
