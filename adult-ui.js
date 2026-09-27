import * as students from './adult-students.js?v=4';
import * as attendance from './adult-attendance.js?v=5';

const datePicker = document.getElementById('adultDatePicker');
const studentsList = document.getElementById('adultStudentsList');
const inactiveList = document.getElementById('adultInactiveList');
const dayStatus = document.getElementById('adultDayStatus');
let expandedStudentId = null;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function formatDate(date) { return date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function beltClass(rank) { return `belt-${String(rank || 'white').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
function makeButton(text, className, handler) { const button = document.createElement('button'); button.type = 'button'; button.className = `btn ${className}`; button.textContent = text; button.addEventListener('click', handler); return button; }
function summary(student) { return `${attendance.getTotalAttended(student.id)} attended`; }

function renderHistory(container, student) {
  container.replaceChildren();
  const records = attendance.getAllAttendanceForStudent(student.id).slice().reverse();
  if (!records.length) { container.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No attendance recorded yet.' })); return; }
  records.forEach((record) => {
    const row = document.createElement('div'); row.className = 'attendance-history-row';
    const meta = document.createElement('span'); meta.innerHTML = `<strong>${formatDate(record.date)}</strong>`;
    const state = document.createElement('strong'); state.className = record.present ? 'status-present' : 'status-absent'; state.textContent = record.present ? 'Present' : 'Absent';
    const actions = document.createElement('span'); actions.className = 'history-actions';
    actions.append(makeButton('Edit', 'history-edit', () => editHistory(row, student, record)), makeButton('Delete', 'history-delete', () => { if (confirm(`Delete attendance on ${record.date}?`)) { attendance.deleteAttendance(student.id, record.date); render(); } }));
    row.append(meta, state, actions); container.appendChild(row);
  });
}

function editHistory(row, student, record) {
  row.replaceChildren(); row.classList.add('history-editing');
  const date = Object.assign(document.createElement('input'), { type: 'date', value: record.date });
  const present = document.createElement('select'); present.innerHTML = '<option value="true">Present</option><option value="false">Absent</option>'; present.value = String(record.present);
  row.append(date, present, makeButton('Save', 'save', () => { if (date.value) { attendance.updateAttendance(student.id, record.date, date.value, present.value === 'true'); render(); } }), makeButton('Cancel', 'cancel', render));
}

function addAttendanceForm(container, student) {
  if (container.childElementCount) return;
  const form = document.createElement('form'); form.className = 'attendance-add-row adult-attendance-add-row';
  const date = Object.assign(document.createElement('input'), { type: 'date', value: datePicker.value || todayISO(), required: true });
  const state = document.createElement('select'); state.innerHTML = '<option value="true">Present</option><option value="false">Absent</option>';
  const save = makeButton('Save attendance', 'attendance-add', () => { if (date.value) { attendance.markAttendance(student.id, date.value, state.value === 'true'); render(); } });
  form.append(date, state, save, makeButton('Cancel', 'cancel', () => container.replaceChildren())); container.appendChild(form);
}

function editStudent(row, student) {
  expandedStudentId = student.id; const details = row.querySelector('.student-details'); details.hidden = false;
  const info = row.querySelector('.student-detail-info'); info.replaceChildren();
  const first = Object.assign(document.createElement('input'), { value: student.firstName, 'aria-label': 'First name' });
  const last = Object.assign(document.createElement('input'), { value: student.lastName, 'aria-label': 'Last name' });
  info.append(first, last, makeButton('Save', 'save', () => { students.updateStudent(student.id, first.value, last.value); render(); }), makeButton('Cancel', 'cancel', render));
}

function buildDetails(row, student) {
  const details = document.createElement('div'); details.className = 'student-details'; details.hidden = expandedStudentId !== student.id;
  const info = document.createElement('div'); info.className = 'student-detail-info';
  info.append(Object.assign(document.createElement('span'), { textContent: 'Adult' }), Object.assign(document.createElement('span'), { textContent: summary(student) }), Object.assign(document.createElement('span'), { textContent: `Last: ${formatDate(String(attendance.getLastClass(student.id)).slice(0, 10))}` }));
  const activeLabel = document.createElement('label'); activeLabel.className = 'active-toggle'; activeLabel.textContent = 'Active'; const active = Object.assign(document.createElement('input'), { type: 'checkbox', checked: student.active !== false }); active.addEventListener('change', () => { students.setActiveStatus(student.id, active.checked); render(); }); activeLabel.prepend(active);
  const title = document.createElement('div'); title.className = 'detail-heading'; title.innerHTML = '<h3>Attendance History</h3>';
  const history = document.createElement('div'); history.className = 'attendance-history'; renderHistory(history, student);
  const addArea = document.createElement('div'); addArea.className = 'attendance-add-area';
  const actions = document.createElement('div'); actions.className = 'detail-actions';
  const markInactive = () => { if (confirm(`Mark ${student.firstName} ${student.lastName} inactive?`)) { students.setActiveStatus(student.id, false); render(); } };
  const historyButton = makeButton('View Full History', 'history-full', () => { const full = history.classList.toggle('history-expanded'); historyButton.textContent = full ? 'Hide History' : 'View Full History'; if (!full) requestAnimationFrame(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' })); });
  actions.append(makeButton('Edit student', 'student-edit-action', () => editStudent(row, student)), makeButton('Mark inactive', 'student-inactive-action', markInactive), historyButton, makeButton('Add Attendance', 'attendance-add', () => addAttendanceForm(addArea, student)));
  details.append(info, activeLabel, title, history, actions, addArea); row.appendChild(details);
}

function render() {
  const date = datePicker.value || todayISO();
  dayStatus.textContent = attendance.isScheduledClassDate(date) ? 'Class day' : 'No scheduled class'; studentsList.replaceChildren();
  const list = students.getActiveStudents().sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`));
  if (!list.length) studentsList.appendChild(Object.assign(document.createElement('li'), { className: 'muted empty-state', textContent: 'No active adult students' }));
  list.forEach((student) => {
    const row = document.createElement('li'); row.className = `student-row ${beltClass(student.rank)}`; row.dataset.studentId = student.id;
    const main = document.createElement('div'); main.className = 'student-main';
    const name = document.createElement('button'); name.type = 'button'; name.className = 'student-name-button'; const stripe = document.createElement('span'); stripe.className = 'belt-stripe'; stripe.setAttribute('aria-hidden', 'true'); const nameText = document.createElement('span'); nameText.innerHTML = `<strong>${student.firstName} ${student.lastName}</strong><small>${student.rank || 'White'} belt</small>`; name.append(stripe, nameText); name.addEventListener('click', () => { const details = row.querySelector('.student-details'); details.hidden = !details.hidden; expandedStudentId = details.hidden ? null : student.id; });
    const record = attendance.getAttendance(student.id, date); const present = document.createElement('button'); present.type = 'button'; present.className = `attendance-toggle ${record?.present ? 'is-present' : ''}`; present.textContent = record?.present ? 'Present' : 'Absent'; present.disabled = !attendance.isScheduledClassDate(date); present.addEventListener('click', () => { if (!present.disabled) { expandedStudentId = student.id; attendance.markAttendance(student.id, date, !present.classList.contains('is-present')); render(); } });
    const inactive = () => { if (confirm(`Mark ${student.firstName} ${student.lastName} inactive?`)) { students.setActiveStatus(student.id, false); render(); } };
    main.append(name, present, makeButton('Edit', 'edit', () => editStudent(row, student)), makeButton('Mark inactive', 'inactive', inactive)); row.append(main); buildDetails(row, student); row.addEventListener('click', (event) => { if (event.target.closest('.student-details, button, input, select, label, a')) return; const details = row.querySelector('.student-details'); details.hidden = !details.hidden; expandedStudentId = details.hidden ? null : student.id; }); studentsList.appendChild(row);
  });
  renderInactive();
}

function renderInactive() { inactiveList.replaceChildren(); const list = students.getStudents().filter((student) => student.active === false); if (!list.length) { inactiveList.appendChild(Object.assign(document.createElement('li'), { className: 'muted', textContent: 'No inactive adults' })); return; } list.forEach((student) => { const row = document.createElement('li'); row.className = 'inactive-row'; const name = document.createElement('span'); name.textContent = `${student.firstName} ${student.lastName}`; row.append(name, makeButton('Reactivate', 'save', () => { students.setActiveStatus(student.id, true); render(); })); inactiveList.appendChild(row); }); }

datePicker.value = todayISO(); datePicker.addEventListener('change', render);
document.getElementById('adultAddStudentToggle').addEventListener('click', () => { const form = document.getElementById('adultAddStudentForm'); form.hidden = !form.hidden; if (!form.hidden) document.getElementById('adultFirstName').focus(); });
document.getElementById('adultAddStudentForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const first = document.getElementById('adultFirstName'); const last = document.getElementById('adultLastName'); if (!first.value.trim() || !last.value.trim()) return; const submit = form.querySelector('button[type="submit"]'); submit.disabled = true; try { await students.addStudentAndSync(first.value, last.value); first.value = ''; last.value = ''; form.hidden = true; render(); } catch (error) { console.error('Adult student create sync failed', error); alert(`Student could not be saved: ${error.message}`); } finally { submit.disabled = false; } });

await Promise.all([students.syncFromCloud(), attendance.syncFromCloud()]); render();
window.addEventListener('storage', (event) => { if (event.key === 'bjj_adult_students' || event.key === 'bjj_adult_attendance') render(); });
window.addEventListener('focus', async () => { await Promise.allSettled([students.syncFromCloud(), attendance.syncFromCloud()]); render(); });