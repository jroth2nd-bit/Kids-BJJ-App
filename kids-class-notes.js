import { syncFromCloud, syncLocalNotes } from './class-notes-cloud.js';

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
let dirty = false;
let savedRange = null;
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
function saveNotes(value) { localStorage.setItem(NOTES_KEY, JSON.stringify(value)); void syncLocalNotes('kids', value).catch((error) => console.error('Cloud kids notes save failed', error)); }
function setStatus(value) { status.textContent = value; }
function markDirty() { dirty = true; setStatus('Unsaved changes'); }
function currentKeyFor(date) { return `${date}::kids-class`; }
function currentNote() { return loadNotes().find((note) => note.key === currentKey) || null; }
function refreshCoachOptions() { coachOptions.innerHTML = ''; [...new Set(loadNotes().map((note) => note.coach).filter(Boolean).sort())].forEach((coach) => coachOptions.appendChild(new Option(coach, coach))); }
function renderHistory() {
  history.innerHTML = '';
  const notes = loadNotes().sort((a, b) => b.date.localeCompare(a.date));
  if (!notes.length) { history.innerHTML = '<li class="muted">No Kids class notes yet</li>'; return; }
  const groups = new Map(); notes.forEach((note) => { const month = note.date.slice(0, 7); if (!groups.has(month)) groups.set(month, []); groups.get(month).push(note); });
  groups.forEach((monthNotes, month) => {
    const group = document.createElement('li'); group.className = 'notes-month-group'; const monthButton = document.createElement('button'); monthButton.type = 'button'; monthButton.className = 'notes-month-toggle'; const arrow = document.createElement('span'); arrow.className = 'notes-month-arrow'; const label = document.createElement('strong'); label.textContent = new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); monthButton.append(arrow, label); const items = document.createElement('ul'); items.className = 'notes-month-items'; const open = expandedMonths.has(month); items.hidden = !open; arrow.textContent = open ? 'v' : '>'; monthButton.addEventListener('click', () => { const next = items.hidden; items.hidden = !next; expandedMonths[next ? 'add' : 'delete'](month); arrow.textContent = next ? 'v' : '>'; }); group.append(monthButton, items);
    monthNotes.forEach((note) => { const item = document.createElement('li'); const button = document.createElement('button'); button.type = 'button'; button.className = 'notes-history-btn'; if (note.key === currentKey) button.classList.add('active'); const heading = document.createElement('div'); heading.className = 'notes-history-title'; heading.textContent = note.title || '(No lesson title)'; const detail = document.createElement('div'); detail.className = 'notes-history-date muted'; detail.textContent = `${note.date} — ${note.className || 'Kids Class'}${note.coach ? ` — Coach: ${note.coach}` : ''}`; button.append(heading, detail); button.addEventListener('click', () => loadNote(note.date)); item.appendChild(button); items.appendChild(item); });
    history.appendChild(group);
  });
}
function loadNote(date) {
  dateInput.value = date; currentKey = currentKeyFor(date); const note = currentNote();
  classInput.value = note?.className || 'Kids Class'; coachInput.value = note?.coach || ''; titleInput.value = note?.title || ''; editor.innerHTML = note?.content || defaultContent(); dirty = false; setStatus(note ? 'Loaded' : 'New note for selected date'); refreshCoachOptions(); renderHistory();
}
function sanitizeHtml(html) {
  const parser = new DOMParser(); const doc = parser.parseFromString(`<div>${html || ''}</div>`, 'text/html'); const root = doc.body.firstElementChild; if (!root) return '';
  const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'H3', 'H4', 'BLOCKQUOTE', 'SPAN']); const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT); const nodes = []; let node = walker.nextNode(); while (node) { nodes.push(node); node = walker.nextNode(); }
  nodes.forEach((element) => { const weight = element.style.fontWeight; if (!allowed.has(element.tagName)) { const parent = element.parentNode; while (element.firstChild) parent.insertBefore(element.firstChild, element); parent.removeChild(element); return; } if (element.tagName === 'SPAN') { while (element.attributes.length) element.removeAttribute(element.attributes[0].name); if (weight === 'normal' || weight === 'bold') element.style.fontWeight = weight; } else { while (element.attributes.length) element.removeAttribute(element.attributes[0].name); } });
  return root.innerHTML;
}
function saveNote() {
  const date = dateInput.value; if (!date) return alert('Select a date'); const now = new Date().toISOString(); const notes = loadNotes(); const old = notes.find((note) => note.key === currentKey); const note = { key: currentKeyFor(date), date, sessionId: 'kids-class', className: classInput.value.trim() || 'Kids Class', coach: coachInput.value.trim(), title: titleInput.value.trim(), content: sanitizeHtml(editor.innerHTML), createdAt: old?.createdAt || now, updatedAt: now };
  const index = notes.findIndex((item) => item.key === note.key); if (index === -1) notes.push(note); else notes[index] = note; saveNotes(notes); currentKey = note.key; dirty = false; setStatus('Saved'); refreshCoachOptions(); renderHistory();
}
function deleteNote() { const notes = loadNotes(); const filtered = notes.filter((note) => note.key !== currentKey); if (filtered.length === notes.length) return setStatus('Nothing to delete'); saveNotes(filtered); loadNote(dateInput.value); setStatus('Deleted'); }
function copyPrevious() { const previous = loadNotes().filter((note) => note.date < dateInput.value).sort((a, b) => b.date.localeCompare(a.date))[0]; if (!previous) return alert('No previous Kids class note found'); classInput.value = previous.className || 'Kids Class'; coachInput.value = previous.coach || ''; titleInput.value = previous.title || ''; editor.innerHTML = previous.content || defaultContent(); markDirty(); }
function rememberSelection() { const selection = window.getSelection(); if (selection?.rangeCount && editor.contains(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange(); }
function applyCommand(command, value) { editor.focus(); if (savedRange) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); } document.execCommand(command, false, value || null); markDirty(); }
function download(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }

document.addEventListener('selectionchange', rememberSelection);
toolbar.addEventListener('mousedown', (event) => { if (event.target.closest('button[data-cmd]')) { rememberSelection(); event.preventDefault(); } });
toolbar.addEventListener('click', (event) => { const button = event.target.closest('button[data-cmd]'); if (button) applyCommand(button.dataset.cmd, button.dataset.value || ''); });
dateInput.addEventListener('change', () => { if (dirty && !confirm('Discard unsaved changes?')) return; loadNote(dateInput.value || todayISO()); });
classInput.addEventListener('input', markDirty); coachInput.addEventListener('input', markDirty); titleInput.addEventListener('input', markDirty); editor.addEventListener('input', markDirty);
document.getElementById('saveNote').addEventListener('click', saveNote); document.getElementById('copyPrevious').addEventListener('click', copyPrevious); document.getElementById('deleteNote').addEventListener('click', deleteNote); document.getElementById('newNote').addEventListener('click', () => loadNote(dateInput.value || todayISO()));
document.getElementById('exportNotesJson').addEventListener('click', () => download('kids-class-notes.json', JSON.stringify(loadNotes(), null, 2), 'application/json'));
document.getElementById('exportNotesCsv').addEventListener('click', () => { const rows = [['date', 'className', 'coach', 'title', 'content'], ...loadNotes().map((note) => [note.date, note.className, note.coach, note.title, note.content])]; download('kids-class-notes.csv', rows.map((row) => row.map((value) => `"${String(value || '').replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv'); });

const params = new URLSearchParams(window.location.search);
dateInput.value = params.get('date') || todayISO();
await syncFromCloud('kids', NOTES_KEY);
loadNote(dateInput.value);
