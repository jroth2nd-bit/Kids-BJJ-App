import { syncFromCloud, syncLocalNotes, deleteCloudNote } from './class-notes-cloud.js?v=2';
import { sanitizeNotesHtml, setupNotesToolbar, fillEmptyBlocks } from './notes-editor.js?v=5';

const NOTES_KEY = 'bjj_class_notes';
const dateInput = document.getElementById('notesDate');
const classInput = document.getElementById('notesClass');
const coachInput = document.getElementById('notesCoach');
const coachOptions = document.getElementById('kidsCoachOptions');
const titleInput = document.getElementById('notesTitle');
const editor = document.getElementById('notesEditor');
const history = document.getElementById('notesHistory');
const status = document.getElementById('notesStatus');
const toolbar = document.getElementById('notesToolbar');
let currentKey = '';
let currentSessionId = '';
let dirty = false;
const expandedMonths = new Set([new Date().toISOString().slice(0, 7)]);

function todayISO() { return new Date().toISOString().split('T')[0]; }
function defaultContent() { return '<h3>Warm Up</h3><p></p><h3>Lesson</h3><p></p><h3>Rolling</h3><p></p><h3>Notes</h3><p></p>'; }
function loadNotes() {
  try {
    const value = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    let changed = false;
    const migrated = value.map((note) => {
      if (note.key) return note;
      changed = true;
      return { ...note, key: `${note.date}::kids-class`, sessionId: 'kids-class', className: 'Kids Class', coach: note.coach || '' };
    });
    if (changed) localStorage.setItem(NOTES_KEY, JSON.stringify(migrated));
    return migrated;
  } catch (e) { return []; }
}
function saveNotes(value) { localStorage.setItem(NOTES_KEY, JSON.stringify(value)); return syncLocalNotes('kids', value); }
function sortNotes(notes) { return notes.sort((a, b) => b.date.localeCompare(a.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))); }
function newSessionId() { return 'kids-class-' + Math.random().toString(36).slice(2, 8); }
function setStatus(value) { status.textContent = value; }
function markDirty() { dirty = true; setStatus('Unsaved changes'); }
function keyFor(date, sessionId) { return `${date}::${sessionId}`; }
function currentNote() { return loadNotes().find((note) => note.key === currentKey) || null; }
function refreshCoachOptions() { coachOptions.innerHTML = ''; [...new Set(loadNotes().map((note) => note.coach).filter(Boolean).sort())].forEach((coach) => coachOptions.appendChild(new Option(coach, coach))); }
function renderHistory() {
  history.innerHTML = '';
  const notes = sortNotes(loadNotes());
  if (!notes.length) { history.innerHTML = '<li class="muted">No Kids class notes yet</li>'; return; }
  const groups = new Map(); notes.forEach((note) => { const month = note.date.slice(0, 7); if (!groups.has(month)) groups.set(month, []); groups.get(month).push(note); });
  groups.forEach((monthNotes, month) => {
    const group = document.createElement('li'); group.className = 'notes-month-group'; const monthButton = document.createElement('button'); monthButton.type = 'button'; monthButton.className = 'notes-month-toggle'; const arrow = document.createElement('span'); arrow.className = 'notes-month-arrow'; const label = document.createElement('strong'); label.textContent = new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); monthButton.append(arrow, label); const items = document.createElement('ul'); items.className = 'notes-month-items'; const open = expandedMonths.has(month); items.hidden = !open; arrow.textContent = open ? 'v' : '>'; monthButton.addEventListener('click', () => { const next = items.hidden; items.hidden = !next; expandedMonths[next ? 'add' : 'delete'](month); arrow.textContent = next ? 'v' : '>'; }); group.append(monthButton, items);
    monthNotes.forEach((note) => { const item = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.className = 'notes-history-btn'; if (note.key === currentKey) button.classList.add('active'); const heading = document.createElement('div'); heading.className = 'notes-history-title'; heading.textContent = note.title || '(No lesson title)'; const detail = document.createElement('div'); detail.className = 'notes-history-date muted'; detail.textContent = `${note.date} — ${note.className || 'Kids Class'}${note.coach ? ` — Coach: ${note.coach}` : ''}`; button.append(heading, detail); button.addEventListener('click', () => { if (dirty && note.key !== currentKey && !confirm('Discard unsaved changes?')) return; loadNote(note.date, note.sessionId); }); item.appendChild(button); items.appendChild(item); });
    history.appendChild(group);
  });
}
function loadNote(date, sessionId) {
  const notes = loadNotes();
  const existing = sessionId ? notes.find((note) => note.key === keyFor(date, sessionId)) : null;
  const note = existing || (sessionId ? null : sortNotes(notes.filter((item) => item.date === date))[0]) || null;
  dateInput.value = date; currentSessionId = note?.sessionId || sessionId || newSessionId(); currentKey = note ? note.key : '';
  classInput.value = note?.className || 'Kids Class'; coachInput.value = note?.coach || ''; titleInput.value = note?.title || ''; editor.innerHTML = note?.content || defaultContent(); fillEmptyBlocks(editor); dirty = false; setStatus(note ? 'Loaded' : 'New note for selected date'); refreshCoachOptions(); renderHistory();
}
function sanitizeHtml(html) { return sanitizeNotesHtml(html); }
function saveNote() {
  const date = dateInput.value; if (!date) return alert('Select a date');
  const now = new Date().toISOString(); const notes = loadNotes(); const old = notes.find((note) => note.key === currentKey);
  let sessionId = currentSessionId || newSessionId();
  if (notes.some((item) => item.key === keyFor(date, sessionId) && item.key !== currentKey)) sessionId = newSessionId();
  const note = { key: keyFor(date, sessionId), date, sessionId, className: classInput.value.trim() || 'Kids Class', coach: coachInput.value.trim(), title: titleInput.value.trim(), content: sanitizeHtml(editor.innerHTML), createdAt: old?.createdAt || now, updatedAt: now };
  const moved = old && old.key !== note.key ? old : null;
  const next = notes.filter((item) => item.key !== currentKey && item.key !== note.key); next.push(note);
  const cloud = saveNotes(next);
  if (moved) cloud.then(() => deleteCloudNote('kids', moved.date, moved.sessionId)).catch((error) => { console.error('Cloud kids note move failed', error); setStatus('Saved here, but the old cloud copy was not removed: ' + (error.message || 'cloud error')); });
  else cloud.catch((error) => console.error('Cloud kids notes save failed', error));
  currentKey = note.key; currentSessionId = sessionId; dirty = false; setStatus(moved ? 'Saved - moved to ' + date : 'Saved'); refreshCoachOptions(); renderHistory();
}
async function deleteNote() { const notes = loadNotes(); const target = notes.find((note) => note.key === currentKey); if (!target) return setStatus('Nothing to delete'); if (!confirm('Delete this note for ' + target.date + '? This removes it from cloud storage and cannot be undone.')) return; setStatus('Deleting...'); try { await deleteCloudNote('kids', target.date, target.sessionId || 'kids-class'); } catch (error) { console.error('Cloud kids note delete failed', error); return setStatus('Delete failed: ' + (error.message || 'cloud error') + '. Note kept.'); } try { await saveNotes(notes.filter((note) => note.key !== currentKey)); } catch (error) { console.error('Cloud kids notes save failed', error); } loadNote(dateInput.value); setStatus('Deleted'); }
function copyPrevious() { const previous = loadNotes().filter((note) => note.date < dateInput.value).sort((a, b) => b.date.localeCompare(a.date))[0]; if (!previous) return alert('No previous Kids class note found'); classInput.value = previous.className || 'Kids Class'; coachInput.value = previous.coach || ''; titleInput.value = previous.title || ''; editor.innerHTML = previous.content || defaultContent(); fillEmptyBlocks(editor); markDirty(); }

setupNotesToolbar(toolbar, editor, markDirty);
dateInput.addEventListener('change', () => { if (!dateInput.value) dateInput.value = todayISO(); markDirty(); if (currentKey) setStatus('Date changed - Save to move this note'); });
classInput.addEventListener('input', markDirty); coachInput.addEventListener('input', markDirty); titleInput.addEventListener('input', markDirty); editor.addEventListener('input', markDirty);
document.getElementById('saveNote').addEventListener('click', saveNote); document.getElementById('copyPrevious').addEventListener('click', copyPrevious); document.getElementById('deleteNote').addEventListener('click', deleteNote); document.getElementById('newNote').addEventListener('click', () => { if (dirty && !confirm('Discard unsaved changes?')) return; loadNote(dateInput.value || todayISO(), newSessionId()); });

const params = new URLSearchParams(window.location.search);
dateInput.value = params.get('date') || todayISO();
await syncFromCloud('kids', NOTES_KEY);
loadNote(dateInput.value);
