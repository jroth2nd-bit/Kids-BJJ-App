import * as unified from './unified-students.js?v=4';
import * as kidsStudents from './students.js?v=5';
import * as adultStudents from './adult-students.js?v=3';
import * as kidsAttendance from './attendance.js?v=6';
import * as adultAttendance from './adult-attendance.js?v=4';
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
const expanded = new Set();
let sortField = 'name';
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
function fillRanks(select, type, selected) { select.replaceChildren(); ranks(type).forEach((rank) => select.appendChild(new Option(rank, rank, false, rank === selected))); }
function fillBelts(select, type, selected) { select.replaceChildren(new Option('Select size', '')); beltSizes.getSizesForType(type === 'child' ? 'kids' : 'adult').forEach((size) => select.appendChild(new Option(size, size, false, size === selected))); }
function sessionSelect(date, current = '') { const select = document.createElement('select'); adultAttendance.getSessionsForDate(date).forEach((session) => select.appendChild(new Option(`${session.label} · ${session.slot}`, session.id, false, session.id === current))); return select; }

function updateAttendanceRecord(student, record, item) {
  item.replaceChildren(); item.classList.add('history-editing');
  const api = attendanceApi(student);
  const date = Object.assign(document.createElement('input'), { type: 'date', value: record.date });
  const present = document.createElement('select'); present.innerHTML = '<option value="true">Present</option><option value="false">Absent</option>'; present.value = String(record.present);
  let session;
  if (student.studentType === 'adult') { session = sessionSelect(date.value, record.sessionId); date.addEventListener('change', () => { const next = sessionSelect(date.value); session.replaceWith(next); session = next; }); }
  item.append(date);
  if (session) item.append(session);
  item.append(present, makeButton('Save', 'save', () => {
    if (!date.value) return;
    if (student.studentType === 'adult') { if (!session.value) return; api.updateAttendance(student.sourceId, record.date, record.sessionId, date.value, session.value, present.value === 'true'); }
    else api.updateAttendance(student.sourceId, record.date, date.value, present.value === 'true');
    expanded.add(key(student)); render();
  }), makeButton('Cancel', 'cancel', render));
}

function attendanceHistory(student, container) {
  const data = stats(student).history.slice().reverse();
  if (!data.length) { container.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No attendance recorded.' })); return; }
  data.forEach((record) => {
    const row = document.createElement('div'); row.className = 'attendance-history-row';
    const detail = document.createElement('span'); detail.textContent = `${formatDate(record.date)}${student.studentType === 'adult' ? ` · ${adultAttendance.getSessionById(record.sessionId)?.label || record.sessionId}` : ''}`;
    const present = document.createElement('strong'); present.className = record.present ? 'status-present' : 'status-absent'; present.textContent = record.present ? 'Present' : 'Absent';
    const actions = document.createElement('span'); actions.className = 'history-actions';
    actions.append(makeButton('Edit', 'history-edit', () => updateAttendanceRecord(student, record, row)), makeButton('Delete', 'history-delete', () => {
      if (!confirm(`Delete attendance on ${record.date}?`)) return;
      if (student.studentType === 'adult') adultAttendance.deleteAttendance(student.sourceId, record.date, record.sessionId); else kidsAttendance.deleteAttendance(student.sourceId, record.date);
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
  let session;
  if (student.studentType === 'adult') { session = sessionSelect(date.value); date.addEventListener('change', () => { const next = sessionSelect(date.value); session.replaceWith(next); session = next; }); }
  form.append(date);
  if (session) form.append(session);
  form.append(present, makeButton('Save attendance', 'attendance-add', () => {
    if (!date.value) return;
    if (student.studentType === 'adult') { if (!session.value) return; adultAttendance.markAttendance(student.sourceId, date.value, session.value, present.value === 'true'); }
    else kidsAttendance.markAttendance(student.sourceId, date.value, present.value === 'true');
    expanded.add(key(student)); render();
  }), makeButton('Cancel', 'cancel', () => container.replaceChildren()));
  container.appendChild(form);
}

function detailsFor(student, row) {
  const detail = document.createElement('div'); detail.className = 'student-details'; detail.hidden = !expanded.has(key(student));
  const studentStats = stats(student);
  const info = document.createElement('div'); info.className = 'student-detail-info';
  [typeLabel(student.studentType), `${studentStats.count}/${studentStats.total} attended · ${studentStats.percent}%`, `Last: ${formatDate(studentStats.last)}`].forEach((text) => info.appendChild(Object.assign(document.createElement('span'), { textContent: text })));
  const activeLabel = document.createElement('label'); activeLabel.className = 'active-toggle'; activeLabel.appendChild(Object.assign(document.createElement('input'), { type: 'checkbox', checked: student.active !== false })); activeLabel.append(' Active');
  activeLabel.querySelector('input').addEventListener('change', async (event) => { unified.updateStudent(student, { active: event.target.checked, inactiveSince: event.target.checked ? '' : new Date().toISOString().slice(0, 10) }); const synced = await unified.flushStudentUpdates(); setStatus(synced ? 'Student status synced.' : 'Status changed locally; cloud sync failed.'); render(); });
  const fields = document.createElement('div'); fields.className = 'student-info-edit-fields';
  const rank = document.createElement('select'); fillRanks(rank, student.studentType, student.rank || 'White');
  rank.addEventListener('change', async () => { unified.updateRank(student, rank.value); const synced = await unified.flushStudentUpdates(); setStatus(synced ? `${student.firstName} ${student.lastName} rank synced` : 'Rank changed locally; cloud sync failed.'); render(); });
  const belt = document.createElement('select'); fillBelts(belt, student.studentType, student.beltSize); belt.addEventListener('change', async () => { unified.updateBeltSize(student, belt.value); const synced = await unified.flushStudentUpdates(); setStatus(synced ? `${student.firstName} ${student.lastName} belt size synced` : 'Belt size changed locally; cloud sync failed.'); render(); });
  const rankField = document.createElement('label'); rankField.textContent = 'Current rank'; rankField.append(rank);
  const beltField = document.createElement('label'); beltField.textContent = 'Belt size'; beltField.append(belt);
  fields.append(rankField, beltField);
  const waiver = waiverStore.getLatestWaiverForStudent(student.studentType === 'child' ? 'kids' : 'adult', student.sourceId);
  const waiverRow = document.createElement('div'); waiverRow.className = 'student-info-waiver';
  const waiverText = document.createElement('span'); waiverText.textContent = waiver ? `Signed ${formatDate(waiver.signedAt)}` : 'Missing'; waiverText.className = waiver ? 'status-present' : 'status-absent';
  const waiverLink = document.createElement('a'); waiverLink.className = 'btn'; waiverLink.href = `waiver.html?studentType=${student.studentType === 'child' ? 'kids' : 'adult'}&studentId=${student.sourceId}`; waiverLink.textContent = waiver ? 'View waiver' : 'Create waiver'; waiverRow.append(waiverText, waiverLink);
  const notes = document.createElement('label'); notes.className = 'student-notes-section'; notes.append('Notes');
  const textarea = document.createElement('textarea'); textarea.value = student.notes || ''; textarea.rows = 3; textarea.setAttribute('aria-label', `Notes for ${student.firstName} ${student.lastName}`);
  const saveNotes = makeButton('Save notes', 'save', async () => { unified.updateNotes(student, textarea.value.trim()); const synced = await unified.flushStudentUpdates(); setStatus(synced ? 'Student notes synced.' : 'Notes saved locally; cloud sync failed.'); }); notes.append(textarea, saveNotes);
  const historyTitle = document.createElement('div'); historyTitle.className = 'detail-heading'; historyTitle.innerHTML = '<h3>Attendance History</h3>';
  const history = document.createElement('div'); history.className = 'attendance-history'; attendanceHistory(student, history);
  const addArea = document.createElement('div'); addArea.className = 'attendance-add-area';
  const actions = document.createElement('div'); actions.className = 'detail-actions';
  actions.append(makeButton('Edit name', 'student-edit-action', () => { fields.replaceChildren(); const first = Object.assign(document.createElement('input'), { value: student.firstName, 'aria-label': 'First name' }); const last = Object.assign(document.createElement('input'), { value: student.lastName, 'aria-label': 'Last name' }); const save = makeButton('Save name', 'save', async () => { if (!first.value.trim() || !last.value.trim()) return; unified.updateStudent(student, { firstName: first.value, lastName: last.value }); const synced = await unified.flushStudentUpdates(); setStatus(synced ? 'Student name synced.' : 'Name changed locally; cloud sync failed.'); expanded.add(key(student)); render(); }); fields.append(first, last, save); }), makeButton('Add attendance', 'attendance-add', () => addAttendance(student, addArea)));
  detail.append(info, activeLabel, fields, waiverRow, notes, historyTitle, history, actions, addArea);
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
    else { left = `${a.lastName} ${a.firstName}`; right = `${b.lastName} ${b.firstName}`; }
    return (typeof left === 'number' ? left - right : String(left).localeCompare(String(right))) * sortDirection;
  });
  list.replaceChildren();
  if (!result.length) { list.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No students match these filters.' })); return; }
  result.forEach((student) => {
    const row = document.createElement('article'); row.className = `student-info-row student-row belt-${String(student.rank || 'white').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const main = document.createElement('div'); main.className = 'student-main';
    const name = document.createElement('button'); name.type = 'button'; name.className = 'student-name-button'; const stripe = document.createElement('span'); stripe.className = 'belt-stripe';
    const nameText = document.createElement('span'); nameText.innerHTML = `<strong>${student.firstName} ${student.lastName}</strong><small>${typeLabel(student.studentType)} · ${student.rank || 'White'}</small>`; name.append(stripe, nameText);
    name.addEventListener('click', () => { if (expanded.has(key(student))) expanded.delete(key(student)); else expanded.add(key(student)); render(); });
    const stat = stats(student); const attendanceCell = Object.assign(document.createElement('span'), { className: 'student-info-attendance', textContent: `${stat.count}/${stat.total} · ${stat.percent}%` });
    const typeCell = Object.assign(document.createElement('span'), { className: 'student-info-type', textContent: typeLabel(student.studentType) });
    const rankCell = Object.assign(document.createElement('span'), { className: 'student-info-rank', textContent: student.rank || 'White' });
    const waiver = waiverStore.getLatestWaiverForStudent(student.studentType === 'child' ? 'kids' : 'adult', student.sourceId); const waiverCell = Object.assign(document.createElement('span'), { className: `student-info-waiver ${waiver ? 'status-present' : 'status-absent'}`, textContent: waiver ? 'Signed' : 'Missing' });
    const activeCell = Object.assign(document.createElement('span'), { className: 'student-info-active', textContent: student.active === false ? 'Inactive' : 'Active' });
    main.append(name, typeCell, rankCell, attendanceCell, waiverCell, activeCell); row.appendChild(main); detailsFor(student, row);
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
render();
window.addEventListener('storage', (event) => { if (['bjj_students', 'bjj_adult_students', 'bjj_attendance', 'bjj_adult_attendance', 'bjj_waivers'].includes(event.key)) render(); });
window.addEventListener('focus', async () => { await Promise.allSettled([kidsStudents.syncFromCloud(), adultStudents.syncFromCloud(), kidsAttendance.syncFromCloud(), adultAttendance.syncFromCloud(), waiverStore.syncFromCloud()]); render(); });
export function refresh() { render(); }
