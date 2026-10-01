import * as students from './adult-students.js?v=4';
import * as attendance from './adult-attendance.js?v=5';
import * as unified from './unified-students.js?v=5';
import { syncFromCloud as syncPromotionRecordsFromCloud } from './promotion-cloud.js?v=3';

const datePicker = document.getElementById('adultDatePicker');
const studentsList = document.getElementById('adultStudentsList');
const inactiveList = document.getElementById('adultInactiveList');
const dayStatus = document.getElementById('adultDayStatus');
let sortField = 'lastName';
let sortDirection = 1;

function todayISO() { return new Date().toISOString().slice(0, 10); }
function beltClass(rank) { return `belt-${String(rank || 'white').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; }
function makeButton(text, className, handler) { const button = document.createElement('button'); button.type = 'button'; button.className = `btn ${className}`; button.textContent = text; button.addEventListener('click', handler); return button; }
function openStudentInfo(studentId) { const query = new URLSearchParams({ studentType: 'adult', studentId: String(studentId), expand: 'true' }); window.location.href = `student-info.html?${query}`; }
function stagedPromotion(studentId) { try { const records = JSON.parse(localStorage.getItem('bjj_adult_promotions') || '[]'); return Array.isArray(records) ? records.find((record) => Number(record.studentId) === Number(studentId) && record.staged === true) || null : null; } catch { return null; } }
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
  unified.updateStudent({ studentType: 'adult', sourceId: student.id }, { active, inactiveSince: active ? '' : new Date().toISOString().slice(0, 10) });
  await unified.flushStudentUpdates();
  render();
}
function render() {
  const date = datePicker.value || todayISO();
  dayStatus.textContent = attendance.isScheduledClassDate(date) ? 'Class day' : 'No scheduled class'; studentsList.replaceChildren();
  const list = students.getActiveStudents().sort(compareStudents);
  if (!list.length) studentsList.appendChild(Object.assign(document.createElement('li'), { className: 'muted empty-state', textContent: 'No active adult students' }));
  list.forEach((student) => {
    const stage = stagedPromotion(student.id);
    const row = document.createElement('li'); row.className = `student-row ${beltClass(student.rank)}${stage ? ' has-staged-promotion' : ''}`; row.dataset.studentId = student.id;
    const main = document.createElement('div'); main.className = 'student-main';
    const name = document.createElement('div'); name.className = 'student-name-button'; const stripe = document.createElement('span'); stripe.className = 'belt-stripe'; stripe.setAttribute('aria-hidden', 'true'); const nameText = document.createElement('span'); nameText.innerHTML = `<strong data-last-name="${student.lastName}">${student.firstName}</strong><small>${student.rank || 'White'} belt</small>`; name.append(stripe, nameText); const lastName = Object.assign(document.createElement('span'), { className: 'student-last-name', textContent: student.lastName }); if (stage) nameText.appendChild(Object.assign(document.createElement('small'), { className: 'promotion-notice', textContent: `Staged · ${stage.newRank || 'Target rank not set'}` }));
    const record = attendance.getAttendance(student.id, date); const present = document.createElement('button'); present.type = 'button'; present.className = `attendance-toggle ${record?.present ? 'is-present' : ''}`; present.textContent = record?.present ? 'Present' : 'Absent'; present.disabled = !attendance.isScheduledClassDate(date); present.addEventListener('click', () => { if (!present.disabled) { attendance.markAttendance(student.id, date, !present.classList.contains('is-present')); render(); } });
    const deactivate = () => { if (confirm(`Deactivate ${student.firstName} ${student.lastName}?`)) void syncActiveStatus(student, false); };
    main.append(name, lastName, present, makeButton('Edit', 'edit', () => openStudentInfo(student.id)), makeButton('Deactivate', 'inactive', deactivate)); row.append(main); studentsList.appendChild(row);
  });
  updateSortIndicators();
  renderInactive();
}

function renderInactive() { inactiveList.replaceChildren(); const list = students.getStudents().filter((student) => student.active === false); if (!list.length) { inactiveList.appendChild(Object.assign(document.createElement('li'), { className: 'muted', textContent: 'No inactive adults' })); return; } list.forEach((student) => { const row = document.createElement('li'); row.className = 'inactive-row'; const name = document.createElement('span'); name.textContent = `${student.firstName} ${student.lastName}`; row.append(name, makeButton('Active', 'save', () => { void syncActiveStatus(student, true); })); inactiveList.appendChild(row); }); }

datePicker.value = todayISO(); datePicker.addEventListener('change', render);
document.getElementById('adultAddStudentToggle').addEventListener('click', () => { const form = document.getElementById('adultAddStudentForm'); form.hidden = !form.hidden; if (!form.hidden) document.getElementById('adultFirstName').focus(); });
document.getElementById('adultAddStudentForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const first = document.getElementById('adultFirstName'); const last = document.getElementById('adultLastName'); if (!first.value.trim() || !last.value.trim()) return; const submit = form.querySelector('button[type="submit"]'); submit.disabled = true; try { await students.addStudentAndSync(first.value, last.value); first.value = ''; last.value = ''; form.hidden = true; render(); } catch (error) { console.error('Adult student create sync failed', error); alert(`Student could not be saved: ${error.message}`); } finally { submit.disabled = false; } });

await Promise.allSettled([students.syncFromCloud(), attendance.syncFromCloud(), syncPromotionRecordsFromCloud('adult', 'bjj_adult_promotions')]); render();
window.addEventListener('storage', (event) => { if (['bjj_adult_students', 'bjj_adult_attendance', 'bjj_adult_promotions'].includes(event.key)) render(); });
window.addEventListener('focus', async () => { await Promise.allSettled([students.syncFromCloud(), attendance.syncFromCloud(), syncPromotionRecordsFromCloud('adult', 'bjj_adult_promotions')]); render(); });