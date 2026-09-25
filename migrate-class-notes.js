import { supabase } from './supabase-client.js';

const summary = document.getElementById('migrationSummary');
const status = document.getElementById('migrationStatus');
const refreshButton = document.getElementById('refreshMigration');
const migrateButton = document.getElementById('migrateNotes');

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function localNotes() {
  return [
    ...readList('bjj_class_notes').map((note) => ({ ...note, program: 'kids', sessionId: note.sessionId || 'kids-class' })),
    ...readList('bjj_adult_class_notes').map((note) => ({ ...note, program: 'adult' })),
  ];
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', isError);
}

function renderPreview() {
  const notes = localNotes();
  const kids = notes.filter((note) => note.program === 'kids').length;
  const adults = notes.filter((note) => note.program === 'adult').length;
  summary.innerHTML = '';
  const total = document.createElement('strong');
  total.textContent = `Total class notes: ${notes.length}`;
  const breakdown = document.createElement('span');
  breakdown.textContent = `Kids: ${kids} | Adults: ${adults}`;
  summary.append(total, breakdown);
  setStatus('Ready to preview or migrate.');
}

async function migrate() {
  const notes = localNotes();
  if (!notes.length) {
    setStatus('No local class notes were found.', true);
    return;
  }
  migrateButton.disabled = true;
  setStatus(`Preparing ${notes.length} class notes...`);
  try {
    const rows = notes.map((note) => ({
      program: note.program,
      class_date: note.date,
      session_id: note.sessionId || (note.program === 'kids' ? 'kids-class' : 'adult-class'),
      title: String(note.title || ''),
      content: String(note.content || ''),
      created_at: note.createdAt || new Date().toISOString(),
      updated_at: note.updatedAt || note.createdAt || new Date().toISOString(),
    }));
    const { error } = await supabase.from('class_notes').upsert(rows, { onConflict: 'program,class_date,session_id' });
    if (error) throw error;
    setStatus(`Migration complete: ${rows.length} class notes copied.`);
  } catch (error) {
    setStatus(`Migration failed: ${error.message}`, true);
  } finally {
    migrateButton.disabled = false;
  }
}

refreshButton.addEventListener('click', renderPreview);
migrateButton.addEventListener('click', migrate);
renderPreview();
