import * as adultAttendance from './adult-attendance.js?v=3';
import { syncFromCloud, syncLocalNotes } from './class-notes-cloud.js';

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
let savedRange = null;
const expandedMonths = new Set([new Date().toISOString().slice(0, 7)]);

function todayISO() { return new Date().toISOString().split('T')[0]; }
function defaultContent() { return '<h3>Warm Up</h3><p></p><h3>Lesson</h3><p></p><h3>Rolling</h3><p></p><h3>Notes</h3><p></p>'; }
function loadNotes() { try { const value = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch (e) { return []; } }
function saveNotes(value) { localStorage.setItem(NOTES_KEY, JSON.stringify(value)); void syncLocalNotes('adult', value).catch((error) => console.error('Cloud adult notes save failed', error)); }
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
  coachInput.value = note?.coach || ''; titleInput.value = note?.title || ''; editor.innerHTML = note?.content || defaultContent(); dirty = false; setStatus(note ? 'Loaded' : 'New note for selected class'); refreshCoachOptions(); renderHistory();
}
function sanitizeHtml(html) {
  const parser = new DOMParser(); const doc = parser.parseFromString(`<div>${html || ''}</div>`, 'text/html'); const root = doc.body.firstElementChild; if (!root) return '';
  const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'H3', 'H4', 'BLOCKQUOTE', 'SPAN']);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT); const nodes = []; let node = walker.nextNode(); while (node) { nodes.push(node); node = walker.nextNode(); }
  nodes.forEach((element) => { const weight = element.style.fontWeight; if (!allowed.has(element.tagName)) { const parent = element.parentNode; while (element.firstChild) parent.insertBefore(element.firstChild, element); parent.removeChild(element); return; } if (element.tagName === 'SPAN') { while (element.attributes.length) element.removeAttribute(element.attributes[0].name); if (weight === 'normal' || weight === 'bold') element.style.fontWeight = weight; } else { while (element.attributes.length) element.removeAttribute(element.attributes[0].name); } });
  return root.innerHTML;
}
function saveCurrentNote() {
  const session = selectedSession(); if (!dateInput.value || !session) return alert('Choose a scheduled date and class');
  const now = new Date().toISOString(); const note = { key: noteKey(dateInput.value, session.id), date: dateInput.value, sessionId: session.id, coach: coachInput.value.trim(), title: titleInput.value.trim(), content: sanitizeHtml(editor.innerHTML), updatedAt: now };
  const notes = loadNotes(); const index = notes.findIndex((item) => item.key === note.key); if (index === -1) { note.createdAt = now; notes.push(note); } else { note.createdAt = notes[index].createdAt || now; notes[index] = note; }
  saveNotes(notes); currentKey = note.key; dirty = false; setStatus('Saved'); refreshCoachOptions(); renderHistory();
}
function deleteCurrentNote() { const notes = loadNotes().filter((note) => note.key !== currentKey); if (notes.length === loadNotes().length) return setStatus('Nothing to delete'); saveNotes(notes); loadNote(dateInput.value, sessionSelect.value); setStatus('Deleted'); }
function copyPreviousNote() { const previous = loadNotes().filter((note) => note.date < dateInput.value).sort((a, b) => `${b.date}${b.sessionId}`.localeCompare(`${a.date}${a.sessionId}`))[0]; if (!previous) return alert('No previous Adult class note found'); coachInput.value = previous.coach || ''; titleInput.value = previous.title || ''; editor.innerHTML = previous.content || defaultContent(); markDirty(); setStatus(`Copied from ${previous.date}`); }
function rememberSelection() { const selection = window.getSelection(); if (selection?.rangeCount && editor.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange(); }
function applyCommand(command, value) { editor.focus(); if (savedRange) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); } document.execCommand(command, false, value || null); markDirty(); }

document.addEventListener('selectionchange', rememberSelection);
toolbar.addEventListener('mousedown', (event) => { if (event.target.closest('button[data-cmd]')) { rememberSelection(); event.preventDefault(); } });
toolbar.addEventListener('click', (event) => { const button = event.target.closest('button[data-cmd]'); if (button) applyCommand(button.dataset.cmd, button.dataset.value || ''); });
dateInput.addEventListener('change', () => { if (dirty && !confirm('Discard unsaved changes?')) return; refreshSessionOptions(); loadNote(dateInput.value || todayISO(), sessionSelect.value); });
sessionSelect.addEventListener('change', () => { if (dirty && !confirm('Discard unsaved changes?')) return; loadNote(dateInput.value, sessionSelect.value); });
coachInput.addEventListener('input', markDirty); titleInput.addEventListener('input', markDirty); editor.addEventListener('input', markDirty);
document.getElementById('saveAdultNote').addEventListener('click', saveCurrentNote); document.getElementById('copyPreviousAdultNote').addEventListener('click', copyPreviousNote); document.getElementById('deleteAdultNote').addEventListener('click', deleteCurrentNote); document.getElementById('newAdultNote').addEventListener('click', () => loadNote(dateInput.value || todayISO(), sessionSelect.value));
document.getElementById('exportAdultNotesJson').addEventListener('click', () => { const blob = new Blob([JSON.stringify(loadNotes(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'adult-class-notes.json'; link.click(); URL.revokeObjectURL(url); });
document.getElementById('exportAdultNotesCsv').addEventListener('click', () => { const rows = [['date', 'sessionId', 'coach', 'title', 'content']].concat(loadNotes().map((note) => [note.date, note.sessionId, note.coach, note.title, note.content])); const csv = rows.map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'adult-class-notes.csv'; link.click(); URL.revokeObjectURL(url); });

const params = new URLSearchParams(window.location.search);
await syncFromCloud('adult', NOTES_KEY);
dateInput.value = params.get('date') || todayISO(); refreshSessionOptions(params.get('session') || ''); loadNote(dateInput.value, params.get('session') || sessionSelect.value);