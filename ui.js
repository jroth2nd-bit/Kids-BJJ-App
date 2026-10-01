import * as students from './students.js?v=6';
import * as attendance from './attendance.js?v=6';
import * as unified from './unified-students.js?v=5';
import { syncFromCloud as syncPromotionRecordsFromCloud } from './promotion-cloud.js?v=3';

const datePicker = document.getElementById('datePicker');
const studentsList = document.getElementById('studentsList');
const inactiveList = document.getElementById('inactiveList');
const addStudentForm = document.getElementById('addStudentForm');
const addStudentToggle = document.getElementById('addStudentToggle');
const attendanceDayStatus = document.getElementById('attendanceDayStatus');
let sortField = 'lastName';
let sortDirection = 1;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function beltClass(rank) { return `belt-${String(rank || 'white').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
function makeButton(text, className, handler) { const button = document.createElement('button'); button.type = 'button'; button.className = `btn ${className}`; button.textContent = text; button.addEventListener('click', handler); return button; }
function openStudentInfo(studentType, studentId) { const query = new URLSearchParams({ studentType, studentId: String(studentId), expand: 'true' }); window.location.href = `student-info.html?${query}`; }
function stagedPromotion(studentId) { try { const records = JSON.parse(localStorage.getItem('bjj_promotions') || '[]'); return Array.isArray(records) ? records.find((record) => Number(record.studentId) === Number(studentId) && record.staged === true) || null : null; } catch { return null; } }
function compareStudents(a, b) {
  const primary = String(a[sortField] || '').localeCompare(String(b[sortField] || ''));
  const secondaryField = sortField === 'firstName' ? 'lastName' : 'firstName';
  const secondary = String(a[secondaryField] || '').localeCompare(String(b[secondaryField] || ''));
  return (primary || secondary) * sortDirection;
}
function updateSortIndicators() {
  document.querySelectorAll('.attendance-headers [data-sort]').forEach((header) => {
    header.dataset.direction = header.dataset.sort === sortField ? (sortDirection === 1 ? 'asc' : 'desc') : '';
  });
}
document.querySelectorAll('.attendance-headers [data-sort]').forEach((header) => header.addEventListener('click', () => {
  const field = header.dataset.sort;
  sortDirection = field === sortField ? -sortDirection : 1;
  sortField = field;
  render();
}));
async function syncActiveStatus(student, active) {
  unified.updateStudent({ studentType: 'child', sourceId: student.id }, { active, inactiveSince: active ? '' : new Date().toISOString().slice(0, 10) });
  await unified.flushStudentUpdates();
  render();
}

function render() {
  const date = datePicker.value || todayISO();
  attendanceDayStatus.textContent = attendance.isScheduledClassDate(date) ? 'Class day' : 'No scheduled class';
  renderActiveStudents(date); renderInactiveStudents();
}

function renderActiveStudents(date) {
  studentsList.replaceChildren();
  const list = students.getActiveStudents().sort(compareStudents);
  if (!list.length) { studentsList.appendChild(Object.assign(document.createElement('li'), { className: 'muted empty-state', textContent: 'No active students' })); return; }
  list.forEach((student) => {
    const stage = stagedPromotion(student.id);
    const row = document.createElement('li'); row.className = `student-row ${beltClass(student.rank)}${stage ? ' has-staged-promotion' : ''}`; row.dataset.studentId = student.id;
    const main = document.createElement('div'); main.className = 'student-main';
    const name = document.createElement('div'); name.className = 'student-name-button';
    const stripe = document.createElement('span'); stripe.className = 'belt-stripe'; stripe.setAttribute('aria-hidden', 'true');
    const nameText = document.createElement('span'); nameText.innerHTML = `<strong data-last-name="${student.lastName}">${student.firstName}</strong><small>${student.rank || 'White'} belt</small>`; name.append(stripe, nameText);
    const lastName = Object.assign(document.createElement('span'), { className: 'student-last-name', textContent: student.lastName });
    if (stage) nameText.appendChild(Object.assign(document.createElement('small'), { className: 'promotion-notice', textContent: `Staged · ${stage.newRank || 'Target rank not set'}` }));
    const record = attendance.getAttendance(student.id, date);
    const present = document.createElement('button'); present.type = 'button'; present.className = `attendance-toggle ${record?.present ? 'is-present' : ''}`; present.textContent = record?.present ? 'Present' : 'Absent'; present.title = attendance.isScheduledClassDate(date) ? 'Toggle attendance' : 'Attendance is recorded on Tuesdays and Thursdays';
    present.addEventListener('click', () => { attendance.markAttendance(student.id, date, !present.classList.contains('is-present')); render(); });
    const deactivate = () => { if (confirm(`Deactivate ${student.firstName} ${student.lastName}?`)) void syncActiveStatus(student, false); };
    main.append(name, lastName, present, makeButton('Edit', 'edit', () => openStudentInfo('child', student.id)), makeButton('Deactivate', 'inactive', deactivate));
    row.append(main);
    studentsList.appendChild(row);
  });
  updateSortIndicators();
}

function renderInactiveStudents() {
  inactiveList.replaceChildren();
  const list = students.getStudents().filter((student) => !student.active);
  if (!list.length) { inactiveList.appendChild(Object.assign(document.createElement('li'), { className: 'muted', textContent: 'No inactive students' })); return; }
  list.forEach((student) => { const row = document.createElement('li'); row.className = 'inactive-row'; const name = document.createElement('span'); name.textContent = `${student.firstName} ${student.lastName}`; row.append(name, makeButton('Active', 'save', () => { void syncActiveStatus(student, true); })); inactiveList.appendChild(row); });
}

addStudentToggle.addEventListener('click', () => { addStudentForm.hidden = !addStudentForm.hidden; if (!addStudentForm.hidden) document.getElementById('firstName').focus(); });
addStudentForm.addEventListener('submit', async (event) => { event.preventDefault(); const button = addStudentForm.querySelector('button[type="submit"]'); button.disabled = true; try { await students.addStudentAndSync(document.getElementById('firstName').value, document.getElementById('lastName').value); addStudentForm.reset(); addStudentForm.hidden = true; render(); } catch (error) { console.error('Student create sync failed', error); alert(`Student could not be saved: ${error.message}`); } finally { button.disabled = false; } });
datePicker.addEventListener('change', render);

if (!datePicker.value) datePicker.value = todayISO();
await Promise.allSettled([students.syncFromCloud(), attendance.syncFromCloud(), syncPromotionRecordsFromCloud('kids', 'bjj_promotions')]);
render();
window.addEventListener('storage', (event) => { if (['bjj_students', 'bjj_attendance', 'bjj_promotions'].includes(event.key)) render(); });
window.addEventListener('focus', async () => { await Promise.allSettled([students.syncFromCloud(), attendance.syncFromCloud(), syncPromotionRecordsFromCloud('kids', 'bjj_promotions')]); render(); });

export function refresh() { render(); }
export default { refresh };