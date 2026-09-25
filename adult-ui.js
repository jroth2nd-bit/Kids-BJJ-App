import * as students from './adult-students.js?v=1';
import * as attendance from './adult-attendance.js?v=3';

const datePicker = document.getElementById('adultDatePicker');
const sessionSelect = document.getElementById('adultSessionSelect');
const studentsList = document.getElementById('adultStudentsList');
const inactiveList = document.getElementById('adultInactiveList');
const classHeading = document.getElementById('adultSelectedClass');
const todayISO = () => new Date().toISOString().split('T')[0];
let sortDirection = -1;

function download(name, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }
function csvCell(value) { const text = String(value ?? ''); return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
function selectedSession() { return attendance.getSessionById(sessionSelect.value); }
function refreshSessions() {
  const date = datePicker.value || todayISO();
  const sessions = attendance.getSessionsForDate(date);
  sessionSelect.innerHTML = '';
  sessions.forEach((session) => { const option = document.createElement('option'); option.value = session.id; option.textContent = `${session.label} — ${session.slot} (${session.start}–${session.end})`; sessionSelect.appendChild(option); });
  if (!sessions.length) { const option = document.createElement('option'); option.textContent = 'No class scheduled'; sessionSelect.appendChild(option); }
  render();
}
function render() {
  const session = selectedSession();
  classHeading.textContent = session ? `${session.label} — ${session.slot} (${session.start}–${session.end})` : 'No class scheduled';
  studentsList.innerHTML = '';
  const list = students.getActiveStudents().sort((a, b) => {
    const aLast = session ? attendance.getLastAttendedForSession(a.id, session.id) : '';
    const bLast = session ? attendance.getLastAttendedForSession(b.id, session.id) : '';
    if (aLast === bLast) return a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName);
    if (!aLast) return 1;
    if (!bLast) return -1;
    return aLast.localeCompare(bLast) * sortDirection;
  });
  if (!list.length) { studentsList.innerHTML = '<li class="muted">No active adult students</li>'; };
  list.forEach((student) => {
    const row = document.createElement('li'); row.className = 'student-row';
    const left = document.createElement('div'); left.className = 'left'; left.dataset.label = 'Name';
    const label = document.createElement('label'); label.className = 'student-label';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'attendance-checkbox'; checkbox.checked = session ? !!attendance.getAttendance(student.id, datePicker.value, session.id)?.present : false; checkbox.disabled = !session;
    checkbox.addEventListener('change', () => { if (session) attendance.markAttendance(student.id, datePicker.value, session.id, checkbox.checked); updateSummary(row, student.id); });
    const name = document.createElement('span'); name.className = 'student-name'; name.textContent = student.firstName; const mobileName = document.createElement('span'); mobileName.className = 'mobile-student-name'; mobileName.textContent = `${student.firstName} ${student.lastName}`; label.append(checkbox, name, mobileName); left.appendChild(label);
    const last = document.createElement('div'); last.className = 'last-name-col'; last.dataset.label = 'Last Name'; last.textContent = student.lastName;
    const classes = document.createElement('div'); classes.className = 'classes'; classes.dataset.label = 'Classes';
    const percent = document.createElement('div'); percent.className = 'percent'; percent.dataset.label = 'Last 30 Days';
    const lastAttended = document.createElement('div'); lastAttended.className = 'last'; lastAttended.dataset.label = 'Last Attended';
    const actions = document.createElement('div'); actions.className = 'actions'; actions.dataset.label = 'Actions';
    const edit = document.createElement('button'); edit.className = 'btn edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => editStudent(row, student));
    const inactive = document.createElement('button'); inactive.className = 'btn inactive'; inactive.textContent = 'Mark inactive'; inactive.addEventListener('click', () => { if (confirm(`Mark ${student.firstName} ${student.lastName} inactive?`)) { students.setActiveStatus(student.id, false); render(); renderInactive(); } });
    actions.append(edit, inactive); row.append(left, last, classes, percent, lastAttended, actions); studentsList.appendChild(row); updateSummary(row, student.id);
  });
  renderInactive();
}
function updateSummary(row, id) {
  const classes = row.querySelector('.classes');
  classes.textContent = `${attendance.getTotalAttended(id)} attended`;
  const breakdown = document.createElement('small');
  breakdown.className = 'adult-class-breakdown';
  const entries = Object.entries(attendance.getClassBreakdown(id));
  breakdown.textContent = entries.length ? entries.map(([label, count]) => `${label}: ${count}`).join(' • ') : 'No class breakdown yet';
  classes.appendChild(breakdown);
  row.querySelector('.percent').textContent = `${attendance.getRecentAttended(id)} attended`;
  row.querySelector('.last').textContent = attendance.getLastClass(id) || '—';
}
function renderInactive() { inactiveList.innerHTML = ''; const list = students.getStudents().filter((student) => student.active === false); if (!list.length) { inactiveList.innerHTML = '<li class="muted">No inactive adults</li>'; return; } list.forEach((student) => { const row = document.createElement('li'); row.className = 'inactive-row'; row.textContent = `${student.firstName} ${student.lastName}`; const button = document.createElement('button'); button.textContent = 'Reactivate'; button.addEventListener('click', () => { students.setActiveStatus(student.id, true); render(); }); row.appendChild(button); inactiveList.appendChild(row); }); }
function fillSessionOptions(select, date, selectedId = '') {
  select.innerHTML = '';
  attendance.getSessionsForDate(date).forEach((session) => {
    const option = new Option(`${session.label} — ${session.slot} (${session.start}–${session.end})`, session.id);
    option.selected = session.id === selectedId;
    select.appendChild(option);
  });
}

function editStudent(row, student) {
  row.innerHTML = '';
  row.classList.add('editing');
  const nameRow = document.createElement('div');
  nameRow.className = 'edit-row';
  const first = document.createElement('input'); first.value = student.firstName; first.placeholder = 'First name';
  const last = document.createElement('input'); last.value = student.lastName; last.placeholder = 'Last name';
  nameRow.append(first, last);

  const actions = document.createElement('div'); actions.className = 'edit-actions';
  const save = document.createElement('button'); save.className = 'btn save'; save.textContent = 'Save Name';
  const cancel = document.createElement('button'); cancel.className = 'btn cancel'; cancel.textContent = 'Cancel';
  save.addEventListener('click', () => { if (first.value.trim() && last.value.trim()) { students.updateStudent(student.id, first.value, last.value); render(); } });
  cancel.addEventListener('click', render);
  actions.append(save, cancel);

  const history = document.createElement('div'); history.className = 'edit-attendance';
  const historyTitle = document.createElement('h3'); historyTitle.textContent = 'Attendance History'; history.appendChild(historyTitle);
  const recordsList = document.createElement('ul'); recordsList.className = 'att-list'; history.appendChild(recordsList);

  function renderHistory() {
    recordsList.innerHTML = '';
    const records = attendance.getAllAttendanceForStudent(student.id);
    if (!records.length) { recordsList.innerHTML = '<li class="muted">No attendance recorded</li>'; }
    records.forEach((record) => {
      const item = document.createElement('li'); item.className = 'att-row';
      const date = document.createElement('input'); date.type = 'date'; date.value = record.date;
      const session = document.createElement('select'); fillSessionOptions(session, record.date, record.sessionId);
      const present = document.createElement('input'); present.type = 'checkbox'; present.checked = record.present;
      const presentLabel = document.createElement('label'); presentLabel.textContent = ' Present';
      const saveRecord = document.createElement('button'); saveRecord.className = 'btn save small'; saveRecord.textContent = 'Save';
      const deleteRecord = document.createElement('button'); deleteRecord.className = 'btn cancel small'; deleteRecord.textContent = 'Delete';
      date.addEventListener('change', () => fillSessionOptions(session, date.value));
      saveRecord.addEventListener('click', () => {
        if (!date.value || !session.value) return alert('Choose a scheduled date and class');
        attendance.updateAttendance(student.id, record.date, record.sessionId, date.value, session.value, present.checked);
        renderHistory(); render();
      });
      deleteRecord.addEventListener('click', () => { attendance.deleteAttendance(student.id, record.date, record.sessionId); renderHistory(); render(); });
      item.append(date, session, present, presentLabel, saveRecord, deleteRecord);
      recordsList.appendChild(item);
    });
  }

  const addTitle = document.createElement('h3'); addTitle.textContent = 'Add Past Attendance'; history.appendChild(addTitle);
  const addRow = document.createElement('div'); addRow.className = 'att-add';
  const addDate = document.createElement('input'); addDate.type = 'date'; addDate.value = todayISO();
  const addSession = document.createElement('select'); fillSessionOptions(addSession, addDate.value);
  const addPresent = document.createElement('input'); addPresent.type = 'checkbox'; addPresent.checked = true;
  const addPresentLabel = document.createElement('label'); addPresentLabel.textContent = ' Present';
  const addButton = document.createElement('button'); addButton.className = 'btn add-att'; addButton.textContent = 'Add Attendance';
  addDate.addEventListener('change', () => fillSessionOptions(addSession, addDate.value));
  addButton.addEventListener('click', () => { if (!addDate.value || !addSession.value) return alert('Choose a scheduled date and class'); attendance.markAttendance(student.id, addDate.value, addSession.value, addPresent.checked); renderHistory(); render(); });
  addRow.append(addDate, addSession, addPresent, addPresentLabel, addButton); history.appendChild(addRow);
  row.append(nameRow, actions, history);
  renderHistory();
}
datePicker.value = todayISO();
datePicker.addEventListener('change', refreshSessions);
sessionSelect.addEventListener('change', render);
await students.syncFromCloud();
await attendance.syncFromCloud();
refreshSessions();
document.getElementById('adultAddStudentForm').addEventListener('submit', (event) => { event.preventDefault(); const first = document.getElementById('adultFirstName'); const last = document.getElementById('adultLastName'); if (first.value.trim() && last.value.trim()) { students.addStudent(first.value, last.value); first.value = ''; last.value = ''; render(); } });
document.getElementById('adultExportJson').addEventListener('click', () => download('adult-attendance.json', JSON.stringify({ students: students.getStudents(), attendance: attendance.getAllAttendance(), settings: attendance.getSettings() }, null, 2), 'application/json'));
document.getElementById('adultExportCsv').addEventListener('click', () => { const rows = [['studentId', 'date', 'sessionId', 'sessionLabel', 'present']]; attendance.getAllAttendance().forEach((record) => rows.push([record.studentId, record.date, record.sessionId, attendance.getSessionById(record.sessionId)?.label || '', record.present])); download('adult-attendance.csv', rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv'); });
