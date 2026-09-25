import * as students from './students.js?v=3';
import * as attendance from './attendance.js?v=5';

const datePicker = document.getElementById('datePicker');
const studentsList = document.getElementById('studentsList');
const inactiveList = document.getElementById('inactiveList');
const addStudentForm = document.getElementById('addStudentForm');
const exportJsonBtn = document.getElementById('exportJson');
const exportCsvBtn = document.getElementById('exportCsv');
const importFileInput = document.getElementById('importFile');
const csvImportFile = document.getElementById('csvImportFile');
const csvTypeSelect = document.getElementById('csvTypeSelect');
const csvImportContainer = document.getElementById('csvImportContainer');

const attendanceMobileMql = window.matchMedia('(max-width: 640px)');

function syncAttendanceResponsiveMode() {
  document.body.classList.toggle('attendance-mobile', attendanceMobileMql.matches);
}

if (typeof attendanceMobileMql.addEventListener === 'function') {
  attendanceMobileMql.addEventListener('change', syncAttendanceResponsiveMode);
} else if (typeof attendanceMobileMql.addListener === 'function') {
  attendanceMobileMql.addListener(syncAttendanceResponsiveMode);
}

syncAttendanceResponsiveMode();

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function setDatePickerToToday() {
  const today = todayISO();
  if (!datePicker.value) datePicker.value = today;
}

function download(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function render() {
  const date = datePicker.value || todayISO();
  renderActiveStudents(date);
  renderInactiveStudents();
  // Ensure action buttons exist (repair for any render hiccups)
  attachMissingActions();
}

let sortField = 'last';
let sortDir = -1; // 1 asc, -1 desc

function setSort(field){
  if (sortField === field) sortDir = -sortDir; else { sortField = field; sortDir = 1; }
  render();
}

function renderActiveStudents(date) {
  studentsList.innerHTML = '';
  const list = students.getActiveStudents();
  if (list.length === 0) {
    studentsList.innerHTML = '<li class="muted">No active students</li>';
    return;
  }

  list.sort((a,b)=>{
    if (sortField === 'lastName') return (a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)) * sortDir;
    if (sortField === 'firstName') return (a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)) * sortDir;
    if (sortField === 'classes') {
      const attendedDiff = attendance.getTotalAttended(a.id) - attendance.getTotalAttended(b.id);
      if (attendedDiff !== 0) return attendedDiff * sortDir;
      return (attendance.getTotalClasses(a.id) - attendance.getTotalClasses(b.id)) * sortDir;
    }
    if (sortField === 'percent') return (attendance.getPercent(a.id) - attendance.getPercent(b.id)) * sortDir;
    if (sortField === 'last') {
      const la = attendance.getLastAttended(a.id) || '';
      const lb = attendance.getLastAttended(b.id) || '';
      if (la === lb) return (a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName));
      return la.localeCompare(lb) * sortDir;
    }
    return (a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)) * sortDir;
  });

  list.forEach(s => {
    const li = document.createElement('li');
    li.className = 'student-row';

    const left = document.createElement('div');
    left.className = 'left';
    left.dataset.label = 'Name';

    const label = document.createElement('label');
    label.className = 'student-label';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.id = s.id;
    checkbox.className = 'attendance-checkbox';

    const rec = attendance.getAttendance(s.id, date);
    checkbox.checked = rec ? !!rec.present : false;
    const isClassDay = attendance.isScheduledClassDate(date);
    if (!isClassDay) {
      checkbox.disabled = true;
      checkbox.title = 'Attendance is counted on Tuesdays and Thursdays only';
    }

    checkbox.addEventListener('change', (e) => {
      const checked = e.target.checked;
      const selectedDate = datePicker.value || todayISO();
      if (!attendance.isScheduledClassDate(selectedDate)) return;
      if (checked) {
        // Checkbox means present for the currently selected date.
        attendance.markAttendance(s.id, selectedDate, true);
      } else {
        // Unchecking clears attendance for that selected date.
        attendance.deleteAttendance(s.id, selectedDate);
      }

      const classesCell = li.querySelector('.classes');
      const percentCell = li.querySelector('.percent');
      const lastCell = li.querySelector('.last');
      if (classesCell) classesCell.textContent = `${attendance.getTotalAttended(s.id)}/${attendance.getTotalClasses(s.id)}`;
      if (percentCell) percentCell.textContent = `${attendance.getPercent(s.id)}%`;
      if (lastCell) lastCell.textContent = attendance.getLastClass(s.id) || '—';

      const summary = li.querySelector('.summary');
      if (summary) summary.textContent = summaryText(s.id);
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'student-name';
    nameSpan.textContent = s.firstName;
    const mobileName = document.createElement('span');
    mobileName.className = 'mobile-student-name';
    mobileName.textContent = `${s.firstName} ${s.lastName}`;

    label.appendChild(checkbox);
    label.appendChild(nameSpan);
    label.appendChild(mobileName);
    left.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn edit';
    btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', () => enterEditMode(li, s));

    const btnInactive = document.createElement('button');
    btnInactive.className = 'btn inactive';
    btnInactive.textContent = 'Mark inactive';
    btnInactive.addEventListener('click', () => {
      if (confirm(`Mark ${s.firstName} ${s.lastName} inactive?`)) {
        students.setActiveStatus(s.id, false);
        render();
      }
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnInactive);

    const lastNameDiv = document.createElement('div');
    lastNameDiv.className = 'last-name-col';
    lastNameDiv.textContent = s.lastName;
    lastNameDiv.dataset.label = 'Last Name';

    const classesDiv = document.createElement('div');
    classesDiv.className = 'classes';
    classesDiv.textContent = `${attendance.getTotalAttended(s.id)}/${attendance.getTotalClasses(s.id)}`;
    classesDiv.dataset.label = 'Classes';
    const pctDiv = document.createElement('div'); pctDiv.className = 'percent'; pctDiv.textContent = attendance.getPercent(s.id) + '%';
    pctDiv.dataset.label = 'Percent';
    const lastDiv = document.createElement('div'); lastDiv.className = 'last'; lastDiv.textContent = attendance.getLastClass(s.id) || '—';
    lastDiv.dataset.label = 'Last Attended';
    actions.dataset.label = 'Actions';

    li.appendChild(left);
    li.appendChild(lastNameDiv);
    li.appendChild(classesDiv);
    li.appendChild(pctDiv);
    li.appendChild(lastDiv);
    li.appendChild(actions);
    studentsList.appendChild(li);
  });
}

// Add click handlers to header columns for sorting
const headers = document.querySelector('.attendance-headers');
if (headers) {
  const firstH = headers.querySelector('.col.first');
  const lastNameH = headers.querySelector('.col.last-name');
  const classesH = headers.querySelector('.col.classes');
  const percentH = headers.querySelector('.col.percent');
  const lastH = headers.querySelector('.col.last');
  if (firstH) firstH.style.cursor = 'pointer';
  if (lastNameH) lastNameH.style.cursor = 'pointer';
  if (classesH) classesH.style.cursor = 'pointer';
  if (percentH) percentH.style.cursor = 'pointer';
  if (lastH) lastH.style.cursor = 'pointer';
  firstH && firstH.addEventListener('click', ()=> setSort('firstName'));
  lastNameH && lastNameH.addEventListener('click', ()=> setSort('lastName'));
  classesH && classesH.addEventListener('click', ()=> setSort('classes'));
  percentH && percentH.addEventListener('click', ()=> setSort('percent'));
  lastH && lastH.addEventListener('click', ()=> setSort('last'));
}

function createInput(value, cls){
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  if (cls) input.className = cls;
  return input;
}

function enterEditMode(li, student) {
  li.innerHTML = '';
  li.classList.add('editing');

  const nameRow = document.createElement('div');
  nameRow.className = 'edit-row';

  const firstInput = createInput(student.firstName, 'edit-first');
  const lastInput = createInput(student.lastName, 'edit-last');

  nameRow.appendChild(firstInput);
  nameRow.appendChild(lastInput);

  const btnSave = document.createElement('button');
  btnSave.className = 'btn save';
  btnSave.textContent = 'Save';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn cancel';
  btnCancel.textContent = 'Cancel';

  const actions = document.createElement('div');
  actions.className = 'edit-actions';
  actions.appendChild(btnSave);
  actions.appendChild(btnCancel);
  const btnDeleteStudent = document.createElement('button');
  btnDeleteStudent.className = 'btn cancel';
  btnDeleteStudent.textContent = 'Delete Student';
  actions.appendChild(btnDeleteStudent);

  // Attendance history and add form
  const attSection = document.createElement('div');
  attSection.className = 'edit-attendance';

  const attList = document.createElement('ul');
  attList.className = 'att-list';

  function refreshAttendanceList(){
    attList.innerHTML = '';
    const records = attendance.getAllAttendanceForStudent(student.id);
    if (records.length === 0) {
      const liEmpty = document.createElement('li');
      liEmpty.className = 'muted';
      liEmpty.textContent = 'No attendance recorded';
      attList.appendChild(liEmpty);
    } else {
      records.forEach(r => {
        const liRec = document.createElement('li');
        liRec.className = 'att-row';

        const view = document.createElement('div');
        view.className = 'att-view';
        const txt = document.createElement('span');
        txt.textContent = `${r.date} — ${r.present ? 'Present' : 'Absent'}`;
        const btnEditRow = document.createElement('button');
        btnEditRow.className = 'btn edit small';
        btnEditRow.textContent = 'Edit';
        const del = document.createElement('button');
        del.className = 'btn cancel small';
        del.textContent = 'Delete';

        view.appendChild(txt);
        view.appendChild(btnEditRow);
        view.appendChild(del);

        const editor = document.createElement('div');
        editor.className = 'att-edit';
        editor.style.display = 'none';
        const dateInp = document.createElement('input'); dateInp.type = 'date'; dateInp.value = r.date;
        const presentInp = document.createElement('input'); presentInp.type = 'checkbox'; presentInp.checked = r.present;
        const presentLbl = document.createElement('label'); presentLbl.textContent = ' Present';
        const saveBtn = document.createElement('button'); saveBtn.className = 'btn save small'; saveBtn.textContent = 'Save';
        const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn cancel small'; cancelBtn.textContent = 'Cancel';
        editor.appendChild(dateInp); editor.appendChild(presentInp); editor.appendChild(presentLbl); editor.appendChild(saveBtn); editor.appendChild(cancelBtn);

        btnEditRow.addEventListener('click', () => {
          view.style.display = 'none';
          editor.style.display = 'flex';
          dateInp.focus();
        });

        del.addEventListener('click', () => {
          if (!confirm(`Delete attendance on ${r.date}?`)) return;
          attendance.deleteAttendance(student.id, r.date);
          refreshAttendanceList();
          const globalSummary = document.querySelector(`.student-row .summary`);
          if (globalSummary) globalSummary.textContent = summaryText(student.id);
        });

        cancelBtn.addEventListener('click', () => {
          editor.style.display = 'none';
          view.style.display = '';
        });

        saveBtn.addEventListener('click', () => {
          const newDate = dateInp.value;
          const newPresent = presentInp.checked;
          if (!newDate) return alert('Choose a date');
          attendance.updateAttendance(student.id, r.date, newDate, newPresent);
          refreshAttendanceList();
          const globalSummary = document.querySelector(`.student-row .summary`);
          if (globalSummary) globalSummary.textContent = summaryText(student.id);
        });

        liRec.appendChild(view);
        liRec.appendChild(editor);
        attList.appendChild(liRec);
      });
    }
  }

  const addForm = document.createElement('div');
  addForm.className = 'att-add';
  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = todayISO();
  const presentCheckbox = document.createElement('input');
  presentCheckbox.type = 'checkbox';
  presentCheckbox.id = `present-${student.id}`;
  const presentLabel = document.createElement('label');
  presentLabel.htmlFor = presentCheckbox.id;
  presentLabel.textContent = 'Present';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn add-att';
  addBtn.textContent = 'Add Attendance';

  addBtn.addEventListener('click', () => {
    const d = dateInput.value;
    const p = presentCheckbox.checked;
    if (!d) return alert('Choose a date');
    attendance.markAttendance(student.id, d, p);
    refreshAttendanceList();
    // update summary visible elsewhere
    const globalSummary = document.querySelector(`.student-row .summary`);
    if (globalSummary) globalSummary.textContent = summaryText(student.id);
  });

  addForm.appendChild(dateInput);
  addForm.appendChild(presentCheckbox);
  addForm.appendChild(presentLabel);
  addForm.appendChild(addBtn);

  attSection.appendChild(attList);
  attSection.appendChild(addForm);

  btnSave.addEventListener('click', () => {
    const first = firstInput.value.trim();
    const last = lastInput.value.trim();
    if (!first || !last) return alert('First and last name required');
    // show saved state briefly
    btnSave.disabled = true;
    btnSave.textContent = 'Saved';
    students.updateStudent(student.id, first, last);
    setTimeout(() => {
      render();
    }, 300);
  });

  btnCancel.addEventListener('click', () => {
    render();
  });

  btnDeleteStudent.addEventListener('click', async () => {
    if (!confirm(`Delete student ${student.firstName} ${student.lastName}? This will remove all attendance for this student.`)) return;
    // dynamically import attendance to ensure up-to-date module
    const mod = await import('./attendance.js?v=3');
    if (mod && typeof mod.deleteAttendanceForStudent === 'function') {
      mod.deleteAttendanceForStudent(student.id);
    }
    students.removeStudent(student.id);
    render();
  });

  li.appendChild(nameRow);
  li.appendChild(actions);
  li.appendChild(attSection);

  refreshAttendanceList();
}

function summaryText(studentId) {
  const attended = attendance.getTotalAttended(studentId);
  const total = attendance.getTotalClasses(studentId);
  const pct = attendance.getPercent(studentId);
  const last = attendance.getLastClass(studentId) || '—';
  return `${attended}/${total} (${pct}%) • last: ${last}`;
}

function attachMissingActions(){
  const rows = Array.from(document.querySelectorAll('.student-row'));
  rows.forEach(li => {
    if (li.querySelector('.actions')) return; // already present
    const checkbox = li.querySelector('.attendance-checkbox');
    const id = checkbox ? Number(checkbox.dataset.id) : null;
    if (!id) return;
    const student = students.getStudentById(id);
    if (!student) return;

    // create or update the classes/percent/last columns
    let classesDiv = li.querySelector('.classes');
    if (!classesDiv) { classesDiv = document.createElement('div'); classesDiv.className = 'classes'; li.appendChild(classesDiv); }
    classesDiv.textContent = `${attendance.getTotalAttended(id)}/${attendance.getTotalClasses(id)}`;
    classesDiv.dataset.label = 'Classes';

    let pctDiv = li.querySelector('.percent');
    if (!pctDiv) { pctDiv = document.createElement('div'); pctDiv.className = 'percent'; li.appendChild(pctDiv); }
    pctDiv.textContent = attendance.getPercent(id) + '%';
    pctDiv.dataset.label = 'Percent';

    let lastDiv = li.querySelector('.last');
    if (!lastDiv) { lastDiv = document.createElement('div'); lastDiv.className = 'last'; li.appendChild(lastDiv); }
    lastDiv.textContent = attendance.getLastClass(id) || '—';
    lastDiv.dataset.label = 'Last Attended';

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.dataset.label = 'Actions';

    const btnEdit = document.createElement('button');
    btnEdit.className = 'btn edit';
    btnEdit.textContent = 'Edit';
    btnEdit.addEventListener('click', () => enterEditMode(li, student));

    const btnInactive = document.createElement('button');
    btnInactive.className = 'btn inactive';
    btnInactive.textContent = 'Mark inactive';
    btnInactive.addEventListener('click', () => {
      if (confirm(`Mark ${student.firstName} ${student.lastName} inactive?`)){
        students.setActiveStatus(student.id, false);
        render();
      }
    });

    actions.appendChild(btnEdit);
    actions.appendChild(btnInactive);

    li.appendChild(actions);
  });
}

function renderInactiveStudents() {
  inactiveList.innerHTML = '';
  const list = students.getStudents().filter(s => !s.active);
  if (list.length === 0) {
    inactiveList.innerHTML = '<li class="muted">No inactive students</li>';
    return;
  }

  list.forEach(s => {
    const li = document.createElement('li');
    li.className = 'inactive-row';

    const name = document.createElement('span');
    name.textContent = `${s.firstName} ${s.lastName}`;

    const btnActivate = document.createElement('button');
    btnActivate.textContent = 'Activate';
    btnActivate.addEventListener('click', () => {
      students.setActiveStatus(s.id, true);
      render();
    });

    const btnRemove = document.createElement('button');
    btnRemove.textContent = 'Remove';
    btnRemove.addEventListener('click', () => {
      if (confirm(`Remove ${s.firstName} ${s.lastName}?`)) {
        students.removeStudent(s.id);
        render();
      }
    });

    li.appendChild(name);
    li.appendChild(btnActivate);
    li.appendChild(btnRemove);
    inactiveList.appendChild(li);
  });
}

addStudentForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const first = (document.getElementById('firstName').value || '').trim();
  const last = (document.getElementById('lastName').value || '').trim();
  if (!first || !last) return;
  students.addStudent(first, last);
  addStudentForm.reset();
  render();
});

exportJsonBtn && exportJsonBtn.addEventListener('click', () => {
  const payload = {
    students: students.getStudents(),
    attendance: attendance.getAllAttendance(),
    classStartDate: attendance.getClassStartDate(),
    exportedAt: new Date().toISOString(),
  };
  download('bjj-data.json', JSON.stringify(payload, null, 2));
});

exportCsvBtn && exportCsvBtn.addEventListener('click', () => {
  const srows = students.getStudents();
  const sHeader = ['id', 'firstName', 'lastName', 'active'];
  const sCsv = [sHeader.join(',')]
    .concat(srows.map(s => [s.id, csvCell(s.firstName), csvCell(s.lastName), s.active].join(',')))
    .join('\n');
  download('students.csv', sCsv, 'text/csv');

  const arows = attendance.getAllAttendance();
  const aHeader = ['studentId', 'date', 'present'];
  const aCsv = [aHeader.join(',')]
    .concat(arows.map(r => [r.studentId, r.date, r.present].join(',')))
    .join('\n');
  download('attendance.csv', aCsv, 'text/csv');
});

datePicker.addEventListener('change', () => {
  render();
});

// Allow quick long-press or double-click to mark inactive from active list
studentsList.addEventListener('dblclick', (e) => {
  const target = e.target.closest('.attendance-checkbox');
  if (!target) return;
  const id = Number(target.dataset.id);
  if (!id) return;
  if (confirm('Mark student inactive?')) {
    students.setActiveStatus(id, false);
    render();
  }
});

// Initialize
await students.syncFromCloud();
await attendance.syncFromCloud();
setDatePickerToToday();
render();

// Expose render for debugging
export function refresh() {
  render();
}

export default {
  refresh,
};
