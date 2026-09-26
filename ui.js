import * as students from './students.js?v=4';
import * as attendance from './attendance.js?v=6';

const datePicker = document.getElementById('datePicker');
const studentsList = document.getElementById('studentsList');
const inactiveList = document.getElementById('inactiveList');
const addStudentForm = document.getElementById('addStudentForm');
const addStudentToggle = document.getElementById('addStudentToggle');
const attendanceDayStatus = document.getElementById('attendanceDayStatus');
let expandedStudentId = null;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function formatDate(date) { return date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function download(filename, content, mime = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type: mime })); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function csvCell(value) { const text = String(value ?? ''); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function beltClass(rank) { return `belt-${String(rank || 'white').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
function summary(student) { return `${attendance.getTotalAttended(student.id)}/${attendance.getTotalClasses(student.id)} attended`; }
function makeButton(text, className, handler) { const button = document.createElement('button'); button.type = 'button'; button.className = `btn ${className}`; button.textContent = text; button.addEventListener('click', handler); return button; }

function render() {
  const date = datePicker.value || todayISO();
  attendanceDayStatus.textContent = attendance.isScheduledClassDate(date) ? 'Class day' : 'No scheduled class';
  renderActiveStudents(date); renderInactiveStudents();
}

function renderHistory(container, student) {
  container.replaceChildren();
  const records = attendance.getAllAttendanceForStudent(student.id).slice().reverse();
  if (!records.length) { container.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No attendance recorded yet.' })); return; }
  records.forEach((record) => {
    const row = document.createElement('div'); row.className = 'attendance-history-row';
    const date = document.createElement('span'); date.textContent = formatDate(record.date);
    const state = document.createElement('strong'); state.className = record.present ? 'status-present' : 'status-absent'; state.textContent = record.present ? 'Present' : 'Absent';
    const actions = document.createElement('span'); actions.className = 'history-actions';
    actions.append(makeButton('Edit', 'history-edit', () => editHistory(row, student, record)), makeButton('Delete', 'history-delete', () => { if (confirm(`Delete attendance on ${record.date}?`)) { attendance.deleteAttendance(student.id, record.date); render(); } }));
    row.append(date, state, actions); container.appendChild(row);
  });
}

function editHistory(row, student, record) {
  row.replaceChildren(); row.classList.add('history-editing');
  const date = Object.assign(document.createElement('input'), { type: 'date', value: record.date });
  const present = document.createElement('select'); present.innerHTML = '<option value="true">Present</option><option value="false">Absent</option>'; present.value = String(record.present);
  row.append(date, present, makeButton('Save', 'save', () => { if (date.value) { attendance.updateAttendance(student.id, record.date, date.value, present.value === 'true'); render(); } }), makeButton('Cancel', 'cancel', () => render()));
}

function addAttendanceForm(container, student) {
  if (container.childElementCount) return;
  const form = document.createElement('form'); form.className = 'attendance-add-row';
  const date = Object.assign(document.createElement('input'), { type: 'date', value: datePicker.value || todayISO(), required: true });
  const state = document.createElement('select'); state.innerHTML = '<option value="true">Present</option><option value="false">Absent</option>';
  const submit = makeButton('Save attendance', 'attendance-add', () => { if (date.value) { attendance.markAttendance(student.id, date.value, state.value === 'true'); render(); } });
  form.append(date, state, submit); container.appendChild(form);
}

function buildDetails(row, student) {
  const details = document.createElement('div'); details.className = 'student-details'; details.hidden = true;
  const info = document.createElement('div'); info.className = 'student-detail-info';
  info.append(Object.assign(document.createElement('span'), { textContent: 'Child' }), Object.assign(document.createElement('span'), { textContent: summary(student) }), Object.assign(document.createElement('span'), { textContent: `Last: ${formatDate(attendance.getLastAttended(student.id))}` }));
  const activeLabel = document.createElement('label'); activeLabel.className = 'active-toggle'; activeLabel.textContent = 'Active';
  const active = Object.assign(document.createElement('input'), { type: 'checkbox', checked: Boolean(student.active) }); active.addEventListener('change', () => { students.setActiveStatus(student.id, active.checked); render(); }); activeLabel.prepend(active);
  const historyTitle = document.createElement('div'); historyTitle.className = 'detail-heading'; historyTitle.innerHTML = '<h3>Attendance History</h3>';
  const history = document.createElement('div'); history.className = 'attendance-history'; renderHistory(history, student);
  const addArea = document.createElement('div'); addArea.className = 'attendance-add-area';
  const actions = document.createElement('div'); actions.className = 'detail-actions';
  const markInactive = () => { if (confirm(`Mark ${student.firstName} ${student.lastName} inactive?`)) { students.setActiveStatus(student.id, false); render(); } };
  actions.append(makeButton('Edit student', 'student-edit-action', () => enterStudentEdit(row, student)), makeButton('Mark inactive', 'student-inactive-action', markInactive), makeButton('View Full History', 'history-full', () => history.classList.toggle('history-expanded')), makeButton('Add Attendance', 'attendance-add', () => addAttendanceForm(addArea, student)));
  details.append(info, activeLabel, historyTitle, history, actions, addArea); row.appendChild(details);
  details.hidden = expandedStudentId !== student.id;
}

function enterStudentEdit(row, student) {
  expandedStudentId = student.id;
  const details = row.querySelector('.student-details'); details.hidden = false;
  const info = row.querySelector('.student-detail-info'); info.replaceChildren();
  const first = Object.assign(document.createElement('input'), { value: student.firstName, 'aria-label': 'First name' });
  const last = Object.assign(document.createElement('input'), { value: student.lastName, 'aria-label': 'Last name' });
  info.append(first, last, makeButton('Save', 'save', () => { students.updateStudent(student.id, first.value, last.value); render(); }), makeButton('Cancel', 'cancel', render));
}

function renderActiveStudents(date) {
  studentsList.replaceChildren();
  const list = students.getActiveStudents().sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  if (!list.length) { studentsList.appendChild(Object.assign(document.createElement('li'), { className: 'muted empty-state', textContent: 'No active students' })); return; }
  list.forEach((student) => {
    const row = document.createElement('li'); row.className = `student-row ${beltClass(student.rank)}`; row.dataset.studentId = student.id;
    const main = document.createElement('div'); main.className = 'student-main';
    const name = document.createElement('button'); name.type = 'button'; name.className = 'student-name-button';
    const stripe = document.createElement('span'); stripe.className = 'belt-stripe'; stripe.setAttribute('aria-hidden', 'true');
    const nameText = document.createElement('span'); nameText.innerHTML = `<strong>${student.firstName} ${student.lastName}</strong><small>${student.rank || 'White'} belt</small>`; name.append(stripe, nameText);
    name.addEventListener('click', () => { const details = row.querySelector('.student-details'); details.hidden = !details.hidden; expandedStudentId = details.hidden ? null : student.id; });
    const record = attendance.getAttendance(student.id, date);
    const present = document.createElement('button'); present.type = 'button'; present.className = `attendance-toggle ${record?.present ? 'is-present' : ''}`; present.textContent = record?.present ? 'Present' : 'Absent'; present.title = attendance.isScheduledClassDate(date) ? 'Toggle attendance' : 'Attendance is recorded on Tuesdays and Thursdays';
    present.addEventListener('click', () => { expandedStudentId = student.id; attendance.markAttendance(student.id, date, !present.classList.contains('is-present')); render(); });
    const markInactive = () => { if (confirm(`Mark ${student.firstName} ${student.lastName} inactive?`)) { students.setActiveStatus(student.id, false); render(); } };
    main.append(name, present, makeButton('Edit', 'edit', () => enterStudentEdit(row, student)), makeButton('Mark inactive', 'inactive', markInactive));
    row.append(main); buildDetails(row, student);
    row.addEventListener('click', (event) => {
      if (event.target.closest('.student-details, button, input, select, label, a')) return;
      const details = row.querySelector('.student-details'); details.hidden = !details.hidden; expandedStudentId = details.hidden ? null : student.id;
    });
    studentsList.appendChild(row);
  });
}

function renderInactiveStudents() {
  inactiveList.replaceChildren();
  const list = students.getStudents().filter((student) => !student.active);
  if (!list.length) { inactiveList.appendChild(Object.assign(document.createElement('li'), { className: 'muted', textContent: 'No inactive students' })); return; }
  list.forEach((student) => { const row = document.createElement('li'); row.className = 'inactive-row'; const name = document.createElement('span'); name.textContent = `${student.firstName} ${student.lastName}`; row.append(name, makeButton('Activate', 'save', () => { students.setActiveStatus(student.id, true); render(); })); inactiveList.appendChild(row); });
}

addStudentToggle.addEventListener('click', () => { addStudentForm.hidden = !addStudentForm.hidden; if (!addStudentForm.hidden) document.getElementById('firstName').focus(); });
addStudentForm.addEventListener('submit', (event) => { event.preventDefault(); students.addStudent(document.getElementById('firstName').value, document.getElementById('lastName').value); addStudentForm.reset(); addStudentForm.hidden = true; render(); });
datePicker.addEventListener('change', render);
document.getElementById('exportJson').addEventListener('click', () => download('bjj-data.json', JSON.stringify({ students: students.getStudents(), attendance: attendance.getAllAttendance(), classStartDate: attendance.getClassStartDate(), exportedAt: new Date().toISOString() }, null, 2)));
document.getElementById('exportCsv').addEventListener('click', () => { const rows = [['studentId', 'date', 'present'], ...attendance.getAllAttendance().map((record) => [record.studentId, record.date, record.present])]; download('attendance.csv', rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv'); });

if (!datePicker.value) datePicker.value = todayISO();
await Promise.all([students.syncFromCloud(), attendance.syncFromCloud()]);
render();

export function refresh() { render(); }
export default { refresh };