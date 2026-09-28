import * as unified from './unified-students.js?v=4';
import * as kidsStudents from './students.js?v=6';
import * as adultStudents from './adult-students.js?v=4';
import * as kidsAttendance from './attendance.js?v=6';
import * as adultAttendance from './adult-attendance.js?v=5';
import * as beltSizes from './shared-belt-sizes.js?v=1';
import * as waiverStore from './waiver-store.js?v=1';

const list = document.getElementById('studentInfoList');
const filters = {
  search: document.getElementById('nameSearch'),
  type: document.getElementById('typeFilter'),
  rank: document.getElementById('rankFilter'),
  attendance: document.getElementById('attendanceFilter'),
  status: document.getElementById('statusFilter'),
};
const statusEl = document.getElementById('studentInfoStatus');
const filterBar = document.querySelector('.student-info-controls');
const filtersToggle = document.getElementById('studentInfoFiltersToggle');
filtersToggle?.addEventListener('click', () => {
  const open = document.body.classList.toggle('mobile-filters-open');
  filtersToggle.setAttribute('aria-expanded', String(open));
});
const expanded = new Set();
const expandedAttendanceHistory = new Set();
const pendingRankChanges = new Map();
const deepLinkParams = new URLSearchParams(window.location.search);
let sortField = 'lastName';
let sortDirection = 1;

function updateStickyOffset() { document.documentElement.style.setProperty('--student-info-controls-height', `${filterBar.offsetHeight}px`); }
if (typeof ResizeObserver === 'function') new ResizeObserver(updateStickyOffset).observe(filterBar);
window.addEventListener('resize', updateStickyOffset);
updateStickyOffset();

const KIDS_RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Grey/White', 'Grey/White 1', 'Grey/White 2', 'Grey/White 3', 'Grey/White 4', 'Grey', 'Grey 1', 'Grey 2', 'Grey 3', 'Grey 4', 'Grey/Black', 'Grey/Black 1', 'Grey/Black 2', 'Grey/Black 3', 'Grey/Black 4', 'Yellow/White', 'Yellow/White 1', 'Yellow/White 2', 'Yellow/White 3', 'Yellow/White 4', 'Yellow', 'Yellow 1', 'Yellow 2', 'Yellow 3', 'Yellow 4', 'Yellow/Black', 'Yellow/Black 1', 'Yellow/Black 2', 'Yellow/Black 3', 'Yellow/Black 4', 'Orange/White', 'Orange/White 1', 'Orange/White 2', 'Orange/White 3', 'Orange/White 4', 'Orange', 'Orange 1', 'Orange 2', 'Orange 3', 'Orange 4', 'Orange/Black', 'Orange/Black 1', 'Orange/Black 2', 'Orange/Black 3', 'Orange/Black 4', 'Green/White', 'Green/White 1', 'Green/White 2', 'Green/White 3', 'Green/White 4', 'Green', 'Green 1', 'Green 2', 'Green 3', 'Green 4', 'Green/Black', 'Green/Black 1', 'Green/Black 2', 'Green/Black 3', 'Green/Black 4'];
const ADULT_RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Blue', 'Blue 1', 'Blue 2', 'Blue 3', 'Blue 4', 'Purple', 'Purple 1', 'Purple 2', 'Purple 3', 'Purple 4', 'Brown', 'Brown 1', 'Brown 2', 'Brown 3', 'Brown 4', 'Black', 'Black 1', 'Black 2', 'Black 3', 'Black 4'];
const key = (student) => `${student.studentType}:${student.sourceId}`;
const attendanceApi = (student) => student.studentType === 'adult' ? adultAttendance : kidsAttendance;
const typeLabel = (type) => type === 'child' ? 'Child' : 'Adult';
const ranks = (type) => type === 'adult' ? ADULT_RANKS : KIDS_RANKS;
const formatDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const formatPhone = (value) => { const digits = String(value || '').replace(/\D/g, ''); const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits; return national.length === 10 ? `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}` : String(value || 'Not set'); };
const setStatus = (message) => { statusEl.textContent = message; };
function allRanks() { return [...new Set([...KIDS_RANKS, ...ADULT_RANKS])]; }
function stats(student) {
  const api = attendanceApi(student);
  const history = api.getAllAttendanceForStudent(student.sourceId);
  const count = api.getTotalAttended(student.sourceId);
  const total = student.studentType === 'adult' ? api.getTotalClasses() : api.getTotalClasses(student.sourceId);
  const last = history.filter((record) => record.present).reduce((latest, record) => record.date > latest ? record.date : latest, '');
  return { count, total, percent: total ? Math.round(count / total * 100) : 0, last, history };
}
function makeButton(label, className, onClick) { const button = document.createElement('button'); button.type = 'button'; button.className = `btn ${className}`; button.textContent = label; button.addEventListener('click', onClick); return button; }
function studentSummaryField(label, value) {
  const field = document.createElement('span'); field.className = 'student-info-summary-field';
  field.append(Object.assign(document.createElement('strong'), { textContent: label }), Object.assign(document.createElement('small'), { textContent: value }));
  return field;
}
function fillRanks(select, type, selected) { select.replaceChildren(); ranks(type).forEach((rank) => select.appendChild(new Option(rank, rank, false, rank === selected))); }
function fillBelts(select, type, selected) { select.replaceChildren(new Option('Select size', '')); beltSizes.getSizesForType(type === 'child' ? 'kids' : 'adult').forEach((size) => select.appendChild(new Option(size, size, false, size === selected))); }
function sanitizeNotesMarkup(value) {
  const parsed = new DOMParser().parseFromString(String(value || ''), 'text/html');
  const allowed = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'UL', 'OL', 'LI', 'H3']);
  const output = document.createElement('div');
  const copy = (node, parent) => {
    if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.nodeValue || '')); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (!allowed.has(node.tagName)) { Array.from(node.childNodes).forEach((child) => copy(child, parent)); return; }
    const element = document.createElement(node.tagName.toLowerCase()); parent.appendChild(element);
    Array.from(node.childNodes).forEach((child) => copy(child, element));
  };
  Array.from(parsed.body.childNodes).forEach((node) => copy(node, output));
  return output.innerHTML || '<p></p>';
}
function updateAttendanceRecord(student, record, item) {
  item.replaceChildren(); item.classList.add('history-editing');
  const api = attendanceApi(student);
  const date = Object.assign(document.createElement('input'), { type: 'date', value: record.date });
  const present = document.createElement('select'); present.innerHTML = '<option value="true">Present</option><option value="false">Absent</option>'; present.value = String(record.present);
  item.append(date);
  item.append(present, makeButton('Save', 'save', () => {
    if (!date.value) return;
    if (student.studentType === 'adult') api.updateAttendance(student.sourceId, record.date, date.value, present.value === 'true');
    else api.updateAttendance(student.sourceId, record.date, date.value, present.value === 'true');
    expanded.add(key(student)); render();
  }), makeButton('Cancel', 'cancel', render));
}

function attendanceHistory(student, container) {
  const data = stats(student).history.slice().reverse();
  if (!data.length) { container.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No attendance recorded.' })); return; }
  data.forEach((record) => {
    const row = document.createElement('div'); row.className = 'attendance-history-row student-info-attendance-row';
    const detail = document.createElement('span'); detail.textContent = formatDate(record.date);
    const present = document.createElement('strong'); present.className = record.present ? 'status-present' : 'status-absent'; present.textContent = record.present ? 'Present' : 'Absent';
    const actions = document.createElement('span'); actions.className = 'history-actions student-info-history-actions';
    actions.append(makeButton('Edit', 'history-edit', () => updateAttendanceRecord(student, record, row)), makeButton('Delete', 'history-delete', () => {
      if (!confirm(`Delete attendance on ${record.date}?`)) return;
      if (student.studentType === 'adult') adultAttendance.deleteAttendance(student.sourceId, record.date); else kidsAttendance.deleteAttendance(student.sourceId, record.date);
      expanded.add(key(student)); render();
    }));
    row.append(detail, present, actions); container.appendChild(row);
  });
}

function addAttendance(student, container) {
  if (container.firstChild) return;
  const form = document.createElement('form'); form.className = 'attendance-add-row';
  const date = Object.assign(document.createElement('input'), { type: 'date', value: new Date().toISOString().slice(0, 10), required: true });
  const present = document.createElement('select'); present.innerHTML = '<option value="true">Present</option><option value="false">Absent</option>';
  form.append(date);
  form.append(present, makeButton('Save attendance', 'attendance-add', () => {
    if (!date.value) return;
    if (student.studentType === 'adult') adultAttendance.markAttendance(student.sourceId, date.value, present.value === 'true');
    else kidsAttendance.markAttendance(student.sourceId, date.value, present.value === 'true');
    expanded.add(key(student)); render();
  }), makeButton('Cancel', 'cancel', () => container.replaceChildren()));
  container.appendChild(form);
}

function detailsFor(student, row, nameGroup) {
  const detail = document.createElement('div'); detail.className = 'student-details'; detail.hidden = !expanded.has(key(student));
  const studentStats = stats(student);
  const waiver = waiverStore.getLatestWaiverForStudent(student.studentType === 'child' ? 'kids' : 'adult', student.sourceId);
  const waiverContact = waiver?.contact || {};
  const info = document.createElement('div'); info.className = 'student-detail-info';
  [
    ['Attendance', `${studentStats.count}/${studentStats.total} attended · ${studentStats.percent}%`],
    ['Last attended', formatDate(studentStats.last)],
    ['Phone', formatPhone(waiverContact.phone)],
    ['Date of birth', waiverContact.dateOfBirth ? formatDate(waiverContact.dateOfBirth) : 'Not set'],
    ['Emergency contact', waiverContact.emergencyName || 'Not set'],
    ['Emergency phone', formatPhone(waiverContact.emergencyPhone)],
    ['Relationship', waiverContact.emergencyRelationship || 'Not set'],
  ].forEach(([label, value]) => info.appendChild(studentSummaryField(label, value)));
  const activeLabel = document.createElement('label'); activeLabel.className = 'active-toggle student-info-summary-active'; activeLabel.appendChild(Object.assign(document.createElement('input'), { type: 'checkbox', checked: student.active !== false })); activeLabel.append(' Active');
  activeLabel.querySelector('input').addEventListener('change', async (event) => { unified.updateStudent(student, { active: event.target.checked, inactiveSince: event.target.checked ? '' : new Date().toISOString().slice(0, 10) }); const synced = await unified.flushStudentUpdates(); setStatus(synced ? 'Student status synced.' : 'Status changed locally; cloud sync failed.'); render(); });
  info.appendChild(activeLabel);
  const fields = document.createElement('div'); fields.className = 'student-info-edit-fields';
  const currentRank = student.rank || 'White';
  const rank = document.createElement('select'); rank.id = `student-info-rank-${student.studentType}-${student.sourceId}`; fillRanks(rank, student.studentType, pendingRankChanges.get(key(student)) || currentRank);
  const rankField = document.createElement('div'); rankField.className = 'student-info-rank-field';
  const rankLabel = document.createElement('label'); rankLabel.htmlFor = rank.id; rankLabel.textContent = 'Current rank';
  const saveRank = makeButton('Save rank', 'save student-info-save-rank', async () => {
    if (rank.value === currentRank) return;
    unified.updateRank(student, rank.value);
    const synced = await unified.flushStudentUpdates();
    pendingRankChanges.delete(key(student));
    setStatus(synced ? `${student.firstName} ${student.lastName} rank synced` : 'Rank changed locally; cloud sync failed.');
    render();
  });
  saveRank.disabled = rank.value === currentRank;
  rank.addEventListener('change', () => {
    if (rank.value === currentRank) pendingRankChanges.delete(key(student));
    else pendingRankChanges.set(key(student), rank.value);
    saveRank.disabled = rank.value === currentRank;
  });
  rankField.append(rankLabel, rank, saveRank);
  const belt = document.createElement('select'); fillBelts(belt, student.studentType, student.beltSize);
  belt.id = `student-info-belt-${student.studentType}-${student.sourceId}`;
  const beltField = document.createElement('div'); beltField.className = 'student-info-belt-field';
  const beltLabel = document.createElement('label'); beltLabel.htmlFor = belt.id; beltLabel.textContent = 'Belt size';
  const saveBelt = makeButton('Save belt size', 'save student-info-save-belt', async () => { unified.updateBeltSize(student, belt.value); const synced = await unified.flushStudentUpdates(); student.beltSize = belt.value; setStatus(synced ? `${student.firstName} ${student.lastName} belt size synced` : 'Belt size saved locally; cloud sync failed.'); });
  beltField.append(beltLabel, belt, saveBelt);
  fields.append(rankField, beltField);
  const editName = makeButton('', 'student-info-name-edit', () => {
    fields.replaceChildren();
    const first = Object.assign(document.createElement('input'), { value: student.firstName, 'aria-label': 'First name' });
    const last = Object.assign(document.createElement('input'), { value: student.lastName, 'aria-label': 'Last name' });
    const save = makeButton('Save name', 'save', async () => {
      if (!first.value.trim() || !last.value.trim()) return;
      unified.updateStudent(student, { firstName: first.value, lastName: last.value });
      const synced = await unified.flushStudentUpdates();
      setStatus(synced ? 'Student name synced.' : 'Name changed locally; cloud sync failed.');
      expanded.add(key(student)); render();
    });
    fields.append(first, last, save);
  });
  editName.setAttribute('aria-label', 'Edit name');
  editName.title = 'Edit name';
  const editIcon = Object.assign(document.createElement('span'), { className: 'student-info-name-edit-icon', textContent: '\u270e' });
  editIcon.setAttribute('aria-hidden', 'true');
  editName.append(editIcon, Object.assign(document.createElement('span'), { className: 'student-info-name-edit-label', textContent: 'Edit name' }));
  nameGroup.appendChild(editName);
  const waiverRow = document.createElement('div'); waiverRow.className = 'student-info-waiver';
  const waiverText = document.createElement('span'); waiverText.textContent = waiver ? `Signed ${formatDate(waiver.signedAt)}` : 'Missing'; waiverText.className = waiver ? 'status-present' : 'status-absent';
  const waiverLink = document.createElement('a'); waiverLink.className = 'btn'; waiverLink.href = `waiver.html?studentType=${student.studentType === 'child' ? 'kids' : 'adult'}&studentId=${student.sourceId}`; waiverLink.textContent = waiver ? 'View' : 'Create'; waiverRow.append(waiverText, waiverLink);
  const notes = document.createElement('section'); notes.className = 'student-notes-section';
  const notesHeading = document.createElement('div'); notesHeading.className = 'student-info-notes-heading'; notesHeading.innerHTML = '<h3>Notes</h3>';
  const toolbar = document.createElement('div'); toolbar.className = 'student-info-notes-toolbar'; toolbar.setAttribute('role', 'toolbar'); toolbar.setAttribute('aria-label', 'Notes formatting');
  const editor = document.createElement('div'); editor.className = 'student-info-notes-editor'; editor.contentEditable = 'true'; editor.setAttribute('role', 'textbox'); editor.setAttribute('aria-multiline', 'true'); editor.setAttribute('aria-label', `Notes for ${student.firstName} ${student.lastName}`); editor.innerHTML = sanitizeNotesMarkup(student.notes || '<p></p>');
  [['bold','B'],['italic','I'],['underline','U'],['insertUnorderedList','Bullets'],['insertOrderedList','Numbered']].forEach(([command,label]) => { const button = makeButton(label, 'student-info-format-button', () => { editor.focus(); document.execCommand(command); }); button.setAttribute('aria-label', label === 'B' ? 'Bold' : label === 'I' ? 'Italic' : label === 'U' ? 'Underline' : label); button.addEventListener('mousedown', (event) => event.preventDefault()); toolbar.appendChild(button); });
  const format = document.createElement('select'); format.className = 'student-info-block-format'; format.setAttribute('aria-label', 'Paragraph style'); format.append(new Option('Paragraph','p'),new Option('Heading','h3')); format.addEventListener('change', () => { editor.focus(); document.execCommand('formatBlock', false, format.value); }); toolbar.appendChild(format);
  const saveFeedback = Object.assign(document.createElement('span'), { className: 'student-info-save-feedback', role: 'status' });
  const saveNotes = makeButton('Save notes', 'save student-info-save-notes', async () => { unified.updateNotes(student, sanitizeNotesMarkup(editor.innerHTML)); const synced = await unified.flushStudentUpdates(); const message = synced ? 'Notes saved.' : 'Notes saved locally; cloud sync failed.'; saveFeedback.textContent = message; setStatus(message); });
  notes.append(notesHeading, toolbar, editor, saveNotes, saveFeedback);
  const addArea = document.createElement('div'); addArea.className = 'attendance-add-area';
  const historyTitle = document.createElement('div'); historyTitle.className = 'detail-heading';
  const historyHeading = Object.assign(document.createElement('h3'), { textContent: 'Attendance History' });
  const history = document.createElement('div'); history.className = 'attendance-history'; history.id = `attendance-history-${student.studentType}-${student.sourceId}`; history.hidden = !expandedAttendanceHistory.has(key(student));
  const historyToggle = makeButton('', 'student-info-history-toggle', () => {
    history.hidden = !history.hidden;
    if (history.hidden) expandedAttendanceHistory.delete(key(student)); else expandedAttendanceHistory.add(key(student));
    historyToggle.setAttribute('aria-label', history.hidden ? 'Show attendance history' : 'Hide attendance history');
    historyToggle.title = history.hidden ? 'Show attendance history' : 'Hide attendance history';
    historyToggle.setAttribute('aria-expanded', String(!history.hidden));
  });
  historyToggle.appendChild(Object.assign(document.createElement('span'), { className: 'student-info-history-chevron', textContent: '>' }));
  historyToggle.setAttribute('aria-controls', history.id);
  historyToggle.setAttribute('aria-label', history.hidden ? 'Show attendance history' : 'Hide attendance history');
  historyToggle.title = history.hidden ? 'Show attendance history' : 'Hide attendance history';
  historyToggle.setAttribute('aria-expanded', String(!history.hidden));
  const addAttendanceButton = makeButton('Add attendance', 'attendance-add', () => {
    if (history.hidden) {
      history.hidden = false;
      expandedAttendanceHistory.add(key(student));
      historyToggle.setAttribute('aria-label', 'Hide attendance history');
      historyToggle.title = 'Hide attendance history';
      historyToggle.setAttribute('aria-expanded', 'true');
    }
    addAttendance(student, addArea);
  });
  historyTitle.append(historyToggle, historyHeading, addAttendanceButton);
  history.appendChild(addArea); attendanceHistory(student, history);
  detail.append(info, fields, waiverRow, notes, historyTitle, history);
  detail.classList.add('student-info-expanded-details');
  row.appendChild(detail);
}

function render() {
  const query = filters.search.value.trim().toLowerCase();
  const type = filters.type.value; const rank = filters.rank.value; const attendanceFilter = filters.attendance.value; const selectedStatus = filters.status.value;
  const result = unified.getStudents().filter((student) => {
    const studentStats = stats(student); const name = `${student.firstName} ${student.lastName}`.toLowerCase();
    if (selectedStatus !== 'all' && (selectedStatus === 'active' ? student.active === false : student.active !== false)) return false;
    if (type !== 'all' && student.studentType !== type) return false;
    if (query && !name.includes(query)) return false;
    if (rank && student.rank !== rank) return false;
    if (attendanceFilter === 'none' && studentStats.count) return false;
    if (attendanceFilter === 'high' && studentStats.percent < 75) return false;
    if (attendanceFilter === 'low' && studentStats.percent >= 50) return false;
    return true;
  }).sort((a, b) => {
    let left; let right;
    if (sortField === 'attendance') { left = stats(a).count; right = stats(b).count; }
    else if (sortField === 'rank') { left = ranks(a.studentType).indexOf(a.rank); right = ranks(b.studentType).indexOf(b.rank); }
    else if (sortField === 'type') { left = a.studentType; right = b.studentType; }
    else { left = sortField === 'firstName' ? a.firstName : a.lastName; right = sortField === 'firstName' ? b.firstName : b.lastName; }
    const primary = typeof left === 'number' ? left - right : String(left).localeCompare(String(right));
    if (primary) return primary * sortDirection;
    if (sortField === 'firstName') return String(a.lastName).localeCompare(String(b.lastName)) * sortDirection;
    return String(a.firstName).localeCompare(String(b.firstName)) * sortDirection;
  });
  list.replaceChildren();
  if (!result.length) { list.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No students match these filters.' })); return; }
  result.forEach((student) => {
    const row = document.createElement('article'); row.className = `student-info-row student-row belt-${String(student.rank || 'white').toLowerCase().replace(/[^a-z0-9]+/g, '-')}${expanded.has(key(student)) ? ' is-expanded' : ''}`; row.dataset.studentType = student.studentType; row.dataset.studentId = String(student.sourceId);
    const main = document.createElement('div'); main.className = 'student-main';
    const name = document.createElement('button'); name.type = 'button'; name.className = 'student-name-button'; name.setAttribute('aria-label', `${student.firstName} ${student.lastName}`); const stripe = document.createElement('span'); stripe.className = 'belt-stripe';
    const nameText = document.createElement('span'); nameText.innerHTML = `<strong data-last-name="${student.lastName}">${student.firstName}</strong><small>${typeLabel(student.studentType)} · ${student.rank || 'White'}</small>`; name.append(stripe, nameText);
    const nameGroup = document.createElement('div'); nameGroup.className = 'student-info-name-group'; nameGroup.appendChild(name);
    name.addEventListener('click', () => { if (expanded.has(key(student))) expanded.delete(key(student)); else expanded.add(key(student)); render(); });
    const stat = stats(student); const attendanceCell = Object.assign(document.createElement('span'), { className: 'student-info-attendance', textContent: `${stat.count}/${stat.total} · ${stat.percent}%` });
    const lastNameCell = Object.assign(document.createElement('span'), { className: 'student-info-last-name-cell', textContent: student.lastName });
    const typeCell = Object.assign(document.createElement('span'), { className: 'student-info-type', textContent: typeLabel(student.studentType) });
    const rankCell = Object.assign(document.createElement('span'), { className: 'student-info-rank', textContent: student.rank || 'White' });
    const waiver = waiverStore.getLatestWaiverForStudent(student.studentType === 'child' ? 'kids' : 'adult', student.sourceId); const waiverCell = Object.assign(document.createElement('span'), { className: `student-info-waiver ${waiver ? 'status-present' : 'status-absent'}`, textContent: waiver ? 'Signed' : 'Missing' });
    const activeCell = Object.assign(document.createElement('span'), { className: 'student-info-active', textContent: student.active === false ? 'Inactive' : 'Active' });
    main.append(nameGroup, lastNameCell, typeCell, rankCell, attendanceCell, waiverCell, activeCell); row.appendChild(main); detailsFor(student, row, nameGroup);
    row.addEventListener('click', (event) => { if (event.target.closest('button,input,select,textarea,a,label,.student-details')) return; if (expanded.has(key(student))) expanded.delete(key(student)); else expanded.add(key(student)); render(); });
    list.appendChild(row);
  });
  document.querySelectorAll('.student-info-header [data-sort]').forEach((header) => { header.dataset.direction = header.dataset.sort === sortField ? (sortDirection === 1 ? 'asc' : 'desc') : ''; });
}

allRanks().forEach((rank) => filters.rank.appendChild(new Option(rank, rank)));
document.querySelectorAll('.student-info-header [data-sort]').forEach((header) => header.addEventListener('click', () => { const field = header.dataset.sort; sortDirection = field === sortField ? -sortDirection : 1; sortField = field; render(); }));
Object.values(filters).forEach((control) => control.addEventListener('input', render));
document.getElementById('printStudents').addEventListener('click', () => window.print());
document.getElementById('studentInfoAddToggle').addEventListener('click', () => { const form = document.getElementById('studentInfoAddForm'); form.hidden = !form.hidden; if (!form.hidden) document.getElementById('studentInfoFirstName').focus(); });
document.getElementById('studentInfoAddForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const first = document.getElementById('studentInfoFirstName').value.trim(); const last = document.getElementById('studentInfoLastName').value.trim(); const type = document.getElementById('studentInfoNewType').value; if (!first || !last) return; try { await (type === 'child' ? kidsStudents : adultStudents).addStudentAndSync(first, last); form.reset(); form.hidden = true; setStatus('Student added and synced.'); render(); } catch (error) { setStatus(`Student could not be synced: ${error.message}`); } });
await Promise.allSettled([kidsStudents.syncFromCloud(), adultStudents.syncFromCloud(), kidsAttendance.syncFromCloud(), adultAttendance.syncFromCloud(), waiverStore.syncFromCloud()]);
const deepLinkId = Number(deepLinkParams.get('studentId'));
const deepLinkType = deepLinkParams.get('studentType');
const deepLinkStudent = deepLinkParams.get('expand') === 'true' && Number.isFinite(deepLinkId) ? unified.getStudent(deepLinkType, deepLinkId) : null;
if (deepLinkStudent) {
  filters.search.value = `${deepLinkStudent.firstName} ${deepLinkStudent.lastName}`;
  filters.type.value = deepLinkStudent.studentType;
  filters.status.value = deepLinkStudent.active === false ? 'inactive' : 'active';
  expanded.add(key(deepLinkStudent));
}
render();
if (deepLinkStudent) requestAnimationFrame(() => {
  const row = [...list.querySelectorAll('.student-info-row')].find((item) => item.dataset.studentType === deepLinkStudent.studentType && item.dataset.studentId === String(deepLinkStudent.sourceId));
  row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
window.addEventListener('storage', (event) => { if (['bjj_students', 'bjj_adult_students', 'bjj_attendance', 'bjj_adult_attendance', 'bjj_waivers'].includes(event.key)) render(); });
window.addEventListener('focus', async () => { await Promise.allSettled([kidsStudents.syncFromCloud(), adultStudents.syncFromCloud(), kidsAttendance.syncFromCloud(), adultAttendance.syncFromCloud(), waiverStore.syncFromCloud()]); render(); });
export function refresh() { render(); }
