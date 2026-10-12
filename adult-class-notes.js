import * as adultAttendance from './adult-attendance.js?v=5';
import { syncFromCloud, syncLocalNotes, deleteCloudNote } from './class-notes-cloud.js?v=2';
import { sanitizeNotesHtml, setupNotesToolbar, fillEmptyBlocks } from './notes-editor.js?v=5';

const NOTES_KEY = 'bjj_adult_class_notes';
const dateInput = document.getElementById('adultNotesDate');
const sessionSelect = document.getElementById('adultNotesSession');
const coachInput = document.getElementById('adultNotesCoach');
const coachOptions = document.getElementById('adultCoachOptions');
const titleInput = document.getElementById('adultNotesTitle');
const editor = document.getElementById('adultNotesEditor');
const history = document.getElementById('adultNotesHistory');
const status = document.getElementById('adultNotesStatus');
const toolbar = document.getElementById('adultNotesToolbar');
let currentKey = '';
let dirty = false;
const expandedMonths = new Set([new Date().toISOString().slice(0, 7)]);

function todayISO() { return new Date().toISOString().split('T')[0]; }
function defaultContent() { return '<h3>Warm Up</h3><p></p><h3>Lesson</h3><p></p><h3>Rolling</h3><p></p><h3>Notes</h3><p></p>'; }
function loadNotes() { try { const value = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch (e) { return []; } }
function saveNotes(value) { localStorage.setItem(NOTES_KEY, JSON.stringify(value)); return syncLocalNotes('adult', value); }
function noteKey(date, sessionId) { return `${date}::${sessionId}`; }
function setStatus(value) { status.textContent = value; }
function markDirty() { dirty = true; setStatus('Unsaved changes'); }
function sessionForCurrentDate() { return adultAttendance.getSessionsForDate(dateInput.value || todayISO()); }
function selectedSession() { return sessionForCurrentDate().find((session) => session.id === sessionSelect.value) || null; }
function formatSession(session) { return `${session.label} — ${session.slot} (${session.start}–${session.end})`; }
function refreshSessionOptions(preferredId = '') {
  const sessions = sessionForCurrentDate();
  sessionSelect.innerHTML = '';
  sessions.forEach((session) => { const option = new Option(formatSession(session), session.id); option.selected = session.id === preferredId; sessionSelect.appendChild(option); });
  if (!sessions.length) sessionSelect.appendChild(new Option('No class scheduled', ''));
}
function getCurrentNote() { return loadNotes().find((note) => note.key === currentKey) || null; }
function refreshCoachOptions() {
  coachOptions.innerHTML = '';
  [...new Set(loadNotes().map((note) => note.coach).filter(Boolean).sort())].forEach((coach) => coachOptions.appendChild(new Option(coach, coach)));
}
function renderHistory() {
  history.innerHTML = '';
  const notes = loadNotes().sort((a, b) => `${b.date}${b.sessionId}`.localeCompare(`${a.date}${a.sessionId}`));
  if (!notes.length) { history.innerHTML = '<li class="muted">No Adult class notes yet</li>'; return; }
  const groups = new Map(); notes.forEach((note) => { const month = note.date.slice(0, 7); if (!groups.has(month)) groups.set(month, []); groups.get(month).push(note); });
  groups.forEach((monthNotes, month) => {
    const group = document.createElement('li'); group.className = 'notes-month-group'; const monthButton = document.createElement('button'); monthButton.type = 'button'; monthButton.className = 'notes-month-toggle'; const arrow = document.createElement('span'); arrow.className = 'notes-month-arrow'; const label = document.createElement('strong'); label.textContent = new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); monthButton.append(arrow, label); const items = document.createElement('ul'); items.className = 'notes-month-items'; const open = expandedMonths.has(month); items.hidden = !open; arrow.textContent = open ? 'v' : '>'; monthButton.addEventListener('click', () => { const next = items.hidden; items.hidden = !next; expandedMonths[next ? 'add' : 'delete'](month); arrow.textContent = next ? 'v' : '>'; }); group.append(monthButton, items);
    monthNotes.forEach((note) => { const item = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.className = 'notes-history-btn'; if (note.key === currentKey) button.classList.add('active'); const session = adultAttendance.getSessionById(note.sessionId); const heading = document.createElement('div'); heading.className = 'notes-history-title'; heading.textContent = note.title || (session ? session.label : 'Untitled class'); const detail = document.createElement('div'); detail.className = 'notes-history-date muted'; detail.textContent = `${note.date} — ${session ? formatSession(session) : note.sessionId}${note.coach ? ` — Coach: ${note.coach}` : ''}`; button.append(heading, detail); button.addEventListener('click', () => loadNote(note.date, note.sessionId)); item.appendChild(button); items.appendChild(item); });
    history.appendChild(group);
  });
}
function loadNote(date, sessionId) {
  dateInput.value = date; refreshSessionOptions(sessionId); currentKey = noteKey(date, sessionSelect.value || sessionId);
  const note = getCurrentNote();
  coachInput.value = note?.coach || ''; titleInput.value = note?.title || ''; editor.innerHTML = note?.content || defaultContent(); fillEmptyBlocks(editor); dirty = false; setStatus(note ? 'Loaded' : 'New note for selected class'); refreshCoachOptions(); renderHistory();
}
function sanitizeHtml(html) { return sanitizeNotesHtml(html); }
function saveCurrentNote() {
  const session = selectedSession(); if (!dateInput.value || !session) return alert('Choose a scheduled date and class');
  const now = new Date().toISOString(); const notes = loadNotes(); const old = notes.find((item) => item.key === currentKey);
  const note = { key: noteKey(dateInput.value, session.id), date: dateInput.value, sessionId: session.id, coach: coachInput.value.trim(), title: titleInput.value.trim(), content: sanitizeHtml(editor.innerHTML), updatedAt: now };
  const clash = notes.find((item) => item.key === note.key && item.key !== currentKey);
  if (clash && !confirm('A note already exists for that date and class. Replace it?')) return;
  note.createdAt = old?.createdAt || clash?.createdAt || now;
  const moved = old && old.key !== note.key ? old : null;
  const next = notes.filter((item) => item.key !== currentKey && item.key !== note.key); next.push(note);
  const cloud = saveNotes(next);
  if (moved) cloud.then(() => deleteCloudNote('adult', moved.date, moved.sessionId)).catch((error) => { console.error('Cloud adult note move failed', error); setStatus('Saved here, but the old cloud copy was not removed: ' + (error.message || 'cloud error')); });
  else cloud.catch((error) => console.error('Cloud adult notes save failed', error));
  currentKey = note.key; dirty = false; setStatus(moved ? 'Saved - moved to ' + note.date : 'Saved'); refreshCoachOptions(); renderHistory();
}
async function deleteCurrentNote() { const all = loadNotes(); const target = all.find((note) => note.key === currentKey); if (!target) return setStatus('Nothing to delete'); if (!confirm('Delete this note for ' + target.date + '? This removes it from cloud storage and cannot be undone.')) return; setStatus('Deleting...'); try { await deleteCloudNote('adult', target.date, target.sessionId); } catch (error) { console.error('Cloud adult note delete failed', error); return setStatus('Delete failed: ' + (error.message || 'cloud error') + '. Note kept.'); } try { await saveNotes(all.filter((note) => note.key !== currentKey)); } catch (error) { console.error('Cloud adult notes save failed', error); } loadNote(dateInput.value, sessionSelect.value); setStatus('Deleted'); }
function copyPreviousNote() { const previous = loadNotes().filter((note) => note.date < dateInput.value).sort((a, b) => `${b.date}${b.sessionId}`.localeCompare(`${a.date}${a.sessionId}`))[0]; if (!previous) return alert('No previous Adult class note found'); coachInput.value = previous.coach || ''; titleInput.value = previous.title || ''; editor.innerHTML = previous.content || defaultContent(); fillEmptyBlocks(editor); markDirty(); setStatus(`Copied from ${previous.date}`); }

setupNotesToolbar(toolbar, editor, markDirty);
dateInput.addEventListener('change', () => {
  if (!dateInput.value) dateInput.value = todayISO();
  if (!getCurrentNote()) { if (dirty && !confirm('Discard unsaved changes?')) return; refreshSessionOptions(); loadNote(dateInput.value, sessionSelect.value); return; }
  refreshSessionOptions(sessionSelect.value); markDirty(); setStatus('Date changed - Save to move this note');
});
sessionSelect.addEventListener('change', () => { if (dirty && !confirm('Discard unsaved changes?')) return; loadNote(dateInput.value, sessionSelect.value); });
coachInput.addEventListener('input', markDirty); titleInput.addEventListener('input', markDirty); editor.addEventListener('input', markDirty);
document.getElementById('saveAdultNote').addEventListener('click', saveCurrentNote); document.getElementById('copyPreviousAdultNote').addEventListener('click', copyPreviousNote); document.getElementById('deleteAdultNote').addEventListener('click', deleteCurrentNote); document.getElementById('newAdultNote').addEventListener('click', () => loadNote(dateInput.value || todayISO(), sessionSelect.value));

const params = new URLSearchParams(window.location.search);
await syncFromCloud('adult', NOTES_KEY);
dateInput.value = params.get('date') || todayISO(); refreshSessionOptions(params.get('session') || ''); loadNote(dateInput.value, params.get('session') || sessionSelect.value);
