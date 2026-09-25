import { supabase } from './supabase-client.js';

const summary = document.getElementById('migrationSummary');
const status = document.getElementById('migrationStatus');
const refreshButton = document.getElementById('refreshMigration');
const migrateButton = document.getElementById('migrateStudents');

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function localStudents() {
  return [
    ...readList('bjj_students').map((student) => ({ ...student, program: 'kids' })),
    ...readList('bjj_adult_students').map((student) => ({ ...student, program: 'adult' })),
  ];
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', isError);
}

function renderPreview() {
  const students = localStudents();
  const kids = students.filter((student) => student.program === 'kids').length;
  const adults = students.filter((student) => student.program === 'adult').length;
  summary.innerHTML = '';
  const total = document.createElement('strong');
  total.textContent = `Total students: ${students.length}`;
  const breakdown = document.createElement('span');
  breakdown.textContent = `Kids: ${kids} | Adults: ${adults}`;
  summary.append(total, breakdown);
  setStatus('Ready to preview or migrate.');
  return students;
}

async function migrate() {
  const students = localStudents();
  if (students.length === 0) {
    setStatus('No local students were found.', true);
    return;
  }

  migrateButton.disabled = true;
  setStatus(`Migrating ${students.length} students...`);
  const rows = students.map((student) => ({
    legacy_id: Number(student.id),
    first_name: String(student.firstName || '').trim(),
    last_name: String(student.lastName || '').trim(),
    program: student.program,
    active: student.active !== false,
    rank: String(student.rank || 'White'),
    belt_size: String(student.beltSize || ''),
    notes: String(student.notes || ''),
  }));

  const { error } = await supabase
    .from('students')
    .upsert(rows, { onConflict: 'program,legacy_id' });

  migrateButton.disabled = false;
  if (error) {
    setStatus(`Migration failed: ${error.message}`, true);
    return;
  }
  setStatus(`Migration complete: ${rows.length} students copied to Supabase.`);
}

refreshButton.addEventListener('click', renderPreview);
migrateButton.addEventListener('click', migrate);
renderPreview();
