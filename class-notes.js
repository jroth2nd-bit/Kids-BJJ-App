const NOTES_KEY = 'bjj_class_notes';

const notesDate = document.getElementById('notesDate');
const notesTitle = document.getElementById('notesTitle');
const notesEditor = document.getElementById('notesEditor');
const notesHistory = document.getElementById('notesHistory');
const notesStatus = document.getElementById('notesStatus');

const saveBtn = document.getElementById('saveNote');
const copyPreviousBtn = document.getElementById('copyPrevious');
const deleteBtn = document.getElementById('deleteNote');
const newBtn = document.getElementById('newNote');
const exportJsonBtn = document.getElementById('exportNotesJson');
const exportCsvBtn = document.getElementById('exportNotesCsv');
const toolbar = document.getElementById('notesToolbar');

let currentDate = '';
let dirty = false;

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function setStatus(text) {
  if (notesStatus) notesStatus.textContent = text;
}

function defaultTemplate() {
  return [
    '<h3>Warm Up</h3>',
    '<p></p>',
    '<h3>Lesson</h3>',
    '<p></p>',
    '<h3>Rolling</h3>',
    '<p></p>',
    '<h3>Notes</h3>',
    '<p></p>'
  ].join('');
}

function loadAllNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveAllNotes(list) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(list));
}

function getNoteByDate(date) {
  return loadAllNotes().find(n => n.date === date) || null;
}

function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'H3', 'H4', 'BLOCKQUOTE']);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node);
    node = walker.nextNode();
  }

  nodes.forEach((el) => {
    const tag = el.tagName;

    // Strip all attributes (including inline handlers/styles).
    while (el.attributes.length > 0) {
      el.removeAttribute(el.attributes[0].name);
    }

    if (!allowed.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
    }
  });

  return root.innerHTML;
}

function noteToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

function formatDateLabel(dateStr) {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function sortNewestFirst(list) {
  return list.slice().sort((a, b) => b.date.localeCompare(a.date));
}

function getPreviousNote(date) {
  const list = loadAllNotes();
  if (list.length === 0) return null;

  // Prefer the most recent note strictly before the selected date.
  const older = list
    .filter(n => n.date < date)
    .sort((a, b) => b.date.localeCompare(a.date));
  if (older.length > 0) return older[0];

  // Fallback: if there is no earlier note, use most recent note on a different date.
  const latestOther = sortNewestFirst(list).find(n => n.date !== date);
  return latestOther || null;
}

function markDirty() {
  dirty = true;
  setStatus('Unsaved changes');
}

function clearDirty() {
  dirty = false;
  setStatus('Saved');
}

function renderHistory() {
  if (!notesHistory) return;
  notesHistory.innerHTML = '';

  const list = sortNewestFirst(loadAllNotes());
  if (list.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'No class notes yet';
    notesHistory.appendChild(empty);
    return;
  }

  list.forEach((n) => {
    const li = document.createElement('li');
    li.className = 'notes-history-item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'notes-history-btn';
    if (n.date === currentDate) btn.classList.add('active');

    const title = document.createElement('div');
    title.className = 'notes-history-title';
    title.textContent = (n.title || '').trim() || '(No lesson title)';

    const date = document.createElement('div');
    date.className = 'notes-history-date muted';
    date.textContent = formatDateLabel(n.date);

    btn.appendChild(title);
    btn.appendChild(date);

    btn.addEventListener('click', () => {
      if (dirty && !confirm('Discard unsaved changes and switch dates?')) return;
      loadDate(n.date);
    });

    li.appendChild(btn);
    notesHistory.appendChild(li);
  });
}

function loadDate(date) {
  currentDate = date;
  if (notesDate) notesDate.value = date;

  const rec = getNoteByDate(date);
  if (notesTitle) notesTitle.value = rec ? (rec.title || '') : '';
  if (notesEditor) notesEditor.innerHTML = rec ? (rec.content || defaultTemplate()) : defaultTemplate();

  dirty = false;
  setStatus(rec ? `Loaded ${formatDateLabel(date)}` : 'New note for selected date');
  renderHistory();
}

function saveCurrentNote() {
  const date = notesDate ? notesDate.value : '';
  if (!date) return alert('Select a date');

  const title = (notesTitle ? notesTitle.value : '').trim();
  const content = sanitizeHtml(notesEditor ? notesEditor.innerHTML : '');
  const now = new Date().toISOString();

  const list = loadAllNotes();
  const idx = list.findIndex(n => n.date === date);

  if (idx === -1) {
    list.push({
      date,
      title,
      content,
      createdAt: now,
      updatedAt: now
    });
  } else {
    list[idx] = {
      ...list[idx],
      title,
      content,
      updatedAt: now
    };
  }

  saveAllNotes(list);
  currentDate = date;
  clearDirty();
  renderHistory();
}

function deleteCurrentDate() {
  const date = notesDate ? notesDate.value : '';
  if (!date) return;
  const rec = getNoteByDate(date);
  if (!rec) {
    if (notesEditor) notesEditor.innerHTML = defaultTemplate();
    if (notesTitle) notesTitle.value = '';
    dirty = false;
    setStatus('Nothing to delete for selected date');
    return;
  }

  if (!confirm(`Delete notes for ${formatDateLabel(date)}?`)) return;
  const filtered = loadAllNotes().filter(n => n.date !== date);
  saveAllNotes(filtered);
  if (notesEditor) notesEditor.innerHTML = defaultTemplate();
  if (notesTitle) notesTitle.value = '';
  dirty = false;
  setStatus('Deleted');
  renderHistory();
}

function copyPreviousLesson() {
  const selectedDate = notesDate ? notesDate.value : '';
  if (!selectedDate) return alert('Select a date first');

  const prev = getPreviousNote(selectedDate);
  if (!prev) return alert('No previous class notes found to copy');

  if (dirty && !confirm('Replace current unsaved changes with previous lesson?')) return;

  if (notesTitle) notesTitle.value = prev.title || '';
  if (notesEditor) notesEditor.innerHTML = prev.content || defaultTemplate();
  markDirty();
  setStatus(`Copied lesson from ${formatDateLabel(prev.date)}`);
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  const list = sortNewestFirst(loadAllNotes());
  const payload = {
    notes: list,
    exportedAt: new Date().toISOString()
  };
  download('class-notes.json', JSON.stringify(payload, null, 2), 'application/json');
}

function csvEscape(value) {
  return `"${String(value || '').replace(/"/g, '""')}"`;
}

function exportCsv() {
  const list = sortNewestFirst(loadAllNotes());
  const header = ['date', 'title', 'contentHtml', 'contentText', 'createdAt', 'updatedAt'];
  const rows = [header.join(',')];

  list.forEach((n) => {
    rows.push([
      csvEscape(n.date),
      csvEscape(n.title),
      csvEscape(n.content),
      csvEscape(noteToPlainText(n.content)),
      csvEscape(n.createdAt),
      csvEscape(n.updatedAt)
    ].join(','));
  });

  download('class-notes.csv', rows.join('\n'), 'text/csv');
}

function applyCommand(cmd, value) {
  if (!notesEditor) return;
  notesEditor.focus();

  if (cmd === 'formatBlock') {
    document.execCommand('formatBlock', false, value || 'p');
  } else {
    document.execCommand(cmd, false, null);
  }
  markDirty();
}

function resetForSelectedDate() {
  if (!notesEditor || !notesDate || !notesTitle) return;
  if (dirty && !confirm('Discard unsaved changes?')) return;

  const rec = getNoteByDate(notesDate.value);
  if (rec) {
    notesTitle.value = rec.title || '';
    notesEditor.innerHTML = rec.content || defaultTemplate();
    dirty = false;
    setStatus('Loaded existing note');
  } else {
    notesTitle.value = '';
    notesEditor.innerHTML = defaultTemplate();
    dirty = false;
    setStatus('New note for selected date');
  }
  currentDate = notesDate.value;
  renderHistory();
}

if (toolbar) {
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    applyCommand(btn.dataset.cmd, btn.dataset.value || '');
  });
}

if (notesDate) {
  notesDate.addEventListener('change', () => {
    if (dirty && !confirm('Discard unsaved changes and switch dates?')) {
      notesDate.value = currentDate || todayISO();
      return;
    }
    loadDate(notesDate.value || todayISO());
  });
}

notesTitle && notesTitle.addEventListener('input', markDirty);
notesEditor && notesEditor.addEventListener('input', markDirty);

saveBtn && saveBtn.addEventListener('click', saveCurrentNote);
copyPreviousBtn && copyPreviousBtn.addEventListener('click', copyPreviousLesson);
deleteBtn && deleteBtn.addEventListener('click', deleteCurrentDate);
newBtn && newBtn.addEventListener('click', resetForSelectedDate);
exportJsonBtn && exportJsonBtn.addEventListener('click', exportJson);
exportCsvBtn && exportCsvBtn.addEventListener('click', exportCsv);

function init() {
  const initial = todayISO();
  if (notesDate) notesDate.value = initial;
  loadDate(initial);
}

init();
