import * as unified from './unified-students.js?v=5';
import * as kidsStudents from './students.js?v=7';
import * as adultStudents from './adult-students.js?v=5';
import * as kidsAttendance from './attendance.js?v=8';
import * as adultAttendance from './adult-attendance.js?v=7';
import * as beltSizes from './shared-belt-sizes.js?v=1';
import * as kidsBeltSizes from './belt-sizes.js?v=1';
import * as adultBeltSizes from './adult-belt-sizes.js?v=1';
import { syncFromCloud, syncLocalPromotions, deleteStagedPromotion } from './promotion-cloud.js?v=3';

const KIDS_RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Grey/White', 'Grey/White 1', 'Grey/White 2', 'Grey/White 3', 'Grey/White 4', 'Grey', 'Grey 1', 'Grey 2', 'Grey 3', 'Grey 4', 'Grey/Black', 'Grey/Black 1', 'Grey/Black 2', 'Grey/Black 3', 'Grey/Black 4', 'Yellow/White', 'Yellow/White 1', 'Yellow/White 2', 'Yellow/White 3', 'Yellow/White 4', 'Yellow', 'Yellow 1', 'Yellow 2', 'Yellow 3', 'Yellow 4', 'Yellow/Black', 'Yellow/Black 1', 'Yellow/Black 2', 'Yellow/Black 3', 'Yellow/Black 4', 'Orange/White', 'Orange/White 1', 'Orange/White 2', 'Orange/White 3', 'Orange/White 4', 'Orange', 'Orange 1', 'Orange 2', 'Orange 3', 'Orange 4', 'Orange/Black', 'Orange/Black 1', 'Orange/Black 2', 'Orange/Black 3', 'Orange/Black 4', 'Green/White', 'Green/White 1', 'Green/White 2', 'Green/White 3', 'Green/White 4', 'Green', 'Green 1', 'Green 2', 'Green 3', 'Green 4', 'Green/Black', 'Green/Black 1', 'Green/Black 2', 'Green/Black 3', 'Green/Black 4'];
const ADULT_RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Blue', 'Blue 1', 'Blue 2', 'Blue 3', 'Blue 4', 'Purple', 'Purple 1', 'Purple 2', 'Purple 3', 'Purple 4', 'Brown', 'Brown 1', 'Brown 2', 'Brown 3', 'Brown 4', 'Black', 'Black 1', 'Black 2', 'Black 3', 'Black 4'];
const list = document.getElementById('promotionWorkflowList');
const controls = {
  search: document.getElementById('promotionSearch'), type: document.getElementById('promotionType'), rank: document.getElementById('promotionRank'), attendance: document.getElementById('promotionAttendance'), staged: document.getElementById('promotionStaged'), sort: document.getElementById('promotionSort'),
};
const filtersToggle = document.getElementById('promotionFiltersToggle');
filtersToggle?.addEventListener('click', () => {
  const open = document.body.classList.toggle('mobile-filters-open');
  filtersToggle.setAttribute('aria-expanded', String(open));
});
const filterBar = document.getElementById('promotionFilters');
function updateStickyOffset() { document.documentElement.style.setProperty('--promotion-controls-height', `${filterBar.offsetHeight}px`); }
if (typeof ResizeObserver === 'function') new ResizeObserver(updateStickyOffset).observe(filterBar);
window.addEventListener('resize', updateStickyOffset);
updateStickyOffset();
const status = document.getElementById('promotionStatus');
const expanded = new Set();
const pendingTargets = new Map();
const pendingDates = new Map();
const key = (student) => `${student.studentType}:${student.sourceId}`;
const storageKey = (student) => student.studentType === 'adult' ? 'bjj_adult_promotions' : 'bjj_promotions';
const program = (student) => student.studentType === 'adult' ? 'adult' : 'kids';
const attendanceApi = (student) => student.studentType === 'adult' ? adultAttendance : kidsAttendance;
const ranksFor = (student) => student.studentType === 'adult' ? ADULT_RANKS : KIDS_RANKS;
const rankFilterValue = (student) => `${student.studentType}:${student.rank || 'White'}`;
const today = () => new Date().toISOString();
const newPromotionKey = (student) => `promotion:${program(student)}:${student.sourceId}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
const formatDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const setStatus = (message) => { status.textContent = message; };
const dateOnly = (record) => String(record?.promotionDate || record?.createdAt || '').slice(0, 10);
const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
const isoFromDate = (date) => `${date}T12:00:00.000Z`;
const isValidDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00`)) && value <= localToday();
function readPromotions(studentType) { try { const value = JSON.parse(localStorage.getItem(studentType === 'adult' ? 'bjj_adult_promotions' : 'bjj_promotions') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function savePromotions(studentType, records) { const store = studentType === 'adult' ? 'bjj_adult_promotions' : 'bjj_promotions'; localStorage.setItem(store, JSON.stringify(records)); return syncLocalPromotions(studentType === 'adult' ? 'adult' : 'kids', records).then(() => true).catch((error) => { console.error('Promotion sync failed', error); setStatus('Promotion saved locally; cloud sync failed.'); return false; }); }
function stagedRecord(student) { return readPromotions(student.studentType).find((record) => Number(record.studentId) === Number(student.sourceId) && record.staged === true) || null; }
function matchesStage(record, stage) { if (!record || !stage || Number(record.studentId) !== Number(stage.studentId) || record.staged !== true) return false; if (record.legacyKey && stage.legacyKey) return record.legacyKey === stage.legacyKey; return String(record.createdAt || record.promotionDate || '') === String(stage.createdAt || stage.promotionDate || ''); }
function historyRecords(student) { return readPromotions(student.studentType).filter((record) => Number(record.studentId) === Number(student.sourceId) && !record.staged).sort((a, b) => String(b.promotionDate || b.createdAt || '').localeCompare(String(a.promotionDate || a.createdAt || ''))); }
function stats(student) { const api = attendanceApi(student); const total = api.getTotalClasses(student.sourceId); const attended = api.getTotalAttended(student.sourceId); return { attended, total, percent: total ? Math.round(attended * 100 / total) : 0 }; }
function sinceStats(student) { const last = historyRecords(student)[0]; return attendanceApi(student).getClassesSince(student.sourceId, last ? dateOnly(last) : ''); }
const sinceText = (value) => `${value.attended}/${value.total} · ${value.percent}%`;
function makeButton(label, className, handler) { const button = document.createElement('button'); button.type = 'button'; button.className = `btn ${className}`; button.textContent = label; button.addEventListener('click', handler); return button; }
function selectRank(student, initial = '') { const select = document.createElement('select'); select.appendChild(new Option('Select target rank', '')); ranksFor(student).forEach((rank) => select.appendChild(new Option(rank, rank))); select.value = initial; return select; }
function selectBelt(student, initial = student.beltSize || '') { const select = document.createElement('select'); select.className = 'promotion-belt-select'; select.appendChild(new Option('Select belt size', '')); const type = student.studentType === 'adult' ? 'adult' : 'kids'; const shared = beltSizes.getSizesForType(type); const options = shared.length ? shared : (type === 'adult' ? adultBeltSizes.getBeltSizes() : kidsBeltSizes.getBeltSizes()); options.forEach((size) => select.appendChild(new Option(size, size, false, size === initial))); if (initial && !options.includes(initial)) select.appendChild(new Option(`${initial} (current)`, initial, true, true)); return select; }
function sortStudents(a, b) {
  const direction = window.promotionSortDirection || 1; const field = controls.sort.value;
  if (field === 'current' || field === 'target') {
    const rankA = field === 'current' ? a.rank : (pendingTargets.get(key(a)) || stagedRecord(a)?.newRank || '');
    const rankB = field === 'current' ? b.rank : (pendingTargets.get(key(b)) || stagedRecord(b)?.newRank || '');
    const orderA = ranksFor(a).indexOf(rankA); const orderB = ranksFor(b).indexOf(rankB);
    if (orderA !== orderB) return ((orderA < 0 ? Infinity : orderA) - (orderB < 0 ? Infinity : orderB)) * direction;
    return String(rankA).localeCompare(String(rankB)) * direction;
  }
  if (field === 'since') { const left = sinceStats(a); const right = sinceStats(b); return (left.percent - right.percent || left.attended - right.attended) * direction; }
  if (field === 'first') return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`) * direction;
  if (field === 'date') { const dateA = historyRecords(a)[0]?.promotionDate || ''; const dateB = historyRecords(b)[0]?.promotionDate || ''; return String(dateA).localeCompare(String(dateB)) * direction; }
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`) * direction;
}

async function stagePromotion(student, target, notes) {
  if (!target) { setStatus('Choose a target rank before staging.'); return; }
  const store = readPromotions(student.studentType);
  let record = store.find((item) => Number(item.studentId) === Number(student.sourceId) && item.staged === true);
  if (record) {
    record.legacyKey ||= newPromotionKey(student); record.oldRank = student.rank || 'White'; record.newRank = target; record.notes = notes || ''; record.confirmed = false;
  } else {
    record = { studentId: Number(student.sourceId), oldRank: student.rank || 'White', newRank: target, beltSize: student.beltSize || '', inStock: false, confirmed: false, staged: true, notes: notes || '', createdAt: today(), promotionDate: today(), legacyKey: newPromotionKey(student) };
    store.push(record);
  }
  const synced = await savePromotions(student.studentType, store); pendingTargets.delete(key(student)); expanded.add(key(student)); if (synced) setStatus(`${student.firstName} ${student.lastName} promotion staged and synced.`); render();
}

async function clearStagedPromotion(student, stage, renderAfter = true) {
  const store = readPromotions(student.studentType).filter((record) => !matchesStage(record, stage)); pendingDates.delete(key(student));
  const saved = await savePromotions(student.studentType, store);
  try { await deleteStagedPromotion(program(student), student.sourceId, stage.promotionDate); }
  catch (error) { console.error('Staged promotion deletion failed', error); setStatus('Stage cleared locally; cloud deletion failed.'); }
  if (saved) setStatus(`${student.firstName} ${student.lastName} staged promotion cleared.`);
  if (renderAfter) render();
  return saved;
}

async function applyPromotion(student, stage, renderAfter = true, askFirst = false) {
  if (!stage) return false;
  if (askFirst && !confirm(`Apply ${student.firstName} ${student.lastName}'s promotion to ${stage.newRank}?`)) return false;
  const store = readPromotions(student.studentType);
  const record = store.find((item) => matchesStage(item, stage));
  if (!record) { setStatus('This staged promotion could not be found. Refresh and try again.'); return false; }
  record.legacyKey ||= newPromotionKey(student);
  const appliedAt = pendingDates.has(key(student)) ? isoFromDate(pendingDates.get(key(student))) : today();
  record.oldRank = student.rank || record.oldRank || 'White'; record.beltSize = student.beltSize || record.beltSize || ''; record.confirmed = true; record.staged = false; record.promotionDate = appliedAt; record.createdAt = appliedAt;
  if (!unified.updateRank(student, record.newRank)) { setStatus('Promotion could not update the student record.'); return false; }
  const studentSynced = await unified.flushStudentUpdates();
  const promotionSynced = await savePromotions(student.studentType, store);
  pendingTargets.delete(key(student)); pendingDates.delete(key(student)); expanded.add(key(student));
  setStatus(studentSynced && promotionSynced ? `${student.firstName} promoted to ${record.newRank}.` : `${student.firstName} promoted locally; cloud sync failed.`);
  if (renderAfter) render();
  return studentSynced && promotionSynced;
}

async function savePromotionDate(student, target, date) {
  if (!isValidDate(date)) { setStatus('Enter a valid promotion date that is not in the future.'); return; }
  const store = readPromotions(student.studentType);
  const record = store.find((item) => Number(item.studentId) === Number(student.sourceId) && !item.staged && (target.legacyKey ? item.legacyKey === target.legacyKey : String(item.createdAt || item.promotionDate) === String(target.createdAt || target.promotionDate)));
  if (!record) { setStatus('This promotion could not be found. Refresh and try again.'); return; }
  record.legacyKey ||= newPromotionKey(student);
  record.promotionDate = isoFromDate(date); record.createdAt = date;
  const synced = await savePromotions(student.studentType, store);
  expanded.add(key(student));
  if (synced) setStatus(`${student.firstName} ${student.lastName} promotion date updated to ${formatDate(date)}.`);
  render();
}

function historyRow(student, record) {
  const line = document.createElement('div'); line.className = 'promotion-history-row';
  const text = Object.assign(document.createElement('span'), { textContent: `${record.oldRank || 'White'} → ${record.newRank} · ${formatDate(dateOnly(record))}` });
  const edit = makeButton('Edit date', 'cancel promotion-history-edit', () => {
    const input = Object.assign(document.createElement('input'), { type: 'date', value: dateOnly(record), max: localToday() }); input.setAttribute('aria-label', 'Promotion date');
    line.replaceChildren(text, input, makeButton('Save', 'save', () => void savePromotionDate(student, record, input.value)), makeButton('Cancel', 'cancel', render));
    input.focus();
  });
  line.append(text, edit);
  return line;
}

function renderStudent(student) {
  const staged = stagedRecord(student); const savedTarget = pendingTargets.get(key(student)) || staged?.newRank || '';
  const row = document.createElement('article'); row.className = `student-row promotion-student-card belt-${String(student.rank || 'white').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const main = document.createElement('div'); main.className = 'student-main promotion-student-main';
  const name = document.createElement('button'); name.type = 'button'; name.className = 'student-name-button';
  const stripe = document.createElement('span'); stripe.className = 'belt-stripe'; const nameLabel = document.createElement('span'); const first = Object.assign(document.createElement('strong'), { textContent: student.firstName }); first.dataset.lastName = student.lastName; nameLabel.append(first, Object.assign(document.createElement('small'), { textContent: `${student.studentType === 'child' ? 'Child' : 'Adult'} · ${student.rank || 'White'}` })); name.append(stripe, nameLabel);
  const lastName = Object.assign(document.createElement('span'), { className: 'promotion-last-name', textContent: student.lastName });
  const since = sinceStats(student); const sinceCell = Object.assign(document.createElement('span'), { className: 'promotion-since', textContent: sinceText(since), title: 'Classes attended / total classes since last promotion' });
  const current = Object.assign(document.createElement('span'), { className: 'promotion-current-rank', textContent: student.rank || 'White' });
  const target = selectRank(student, savedTarget); target.className = 'promotion-target-select'; target.addEventListener('change', () => { pendingTargets.set(key(student), target.value); render(); });
  const state = Object.assign(document.createElement('span'), { className: `promotion-stage-state ${staged ? 'is-staged' : ''}`, textContent: staged ? 'Staged' : 'Not staged' });
  const stage = makeButton(staged ? 'Apply' : 'Stage', 'save', () => { if (staged) void applyPromotion(student, staged); else void stagePromotion(student, target.value || pendingTargets.get(key(student)), ''); });
  main.append(name, lastName, current, target, sinceCell, state, stage);
  const detail = document.createElement('div'); detail.className = 'student-details'; detail.hidden = !expanded.has(key(student));
  const studentStats = stats(student); const lastPromotion = historyRecords(student)[0];
  const detailMeta = document.createElement('div'); detailMeta.className = 'student-detail-info';
  [student.studentType === 'child' ? 'Child' : 'Adult', `${studentStats.attended}/${studentStats.total} attended · ${studentStats.percent}%`, `Since last promotion: ${sinceText(since)}`, `Belt size: ${student.beltSize || 'Not set'}`, `Last promoted: ${formatDate(lastPromotion?.promotionDate || lastPromotion?.createdAt)}`].forEach((value) => detailMeta.appendChild(Object.assign(document.createElement('span'), { textContent: value })));
  const belt = selectBelt(student, student.beltSize || ''); belt.id = `promotion-belt-${student.studentType}-${student.sourceId}`; belt.setAttribute('aria-label', 'Belt size');
  const beltField = document.createElement('div'); beltField.className = 'promotion-belt-field'; const beltLabel = document.createElement('label'); beltLabel.htmlFor = belt.id; beltLabel.textContent = 'Belt size';
  const saveBelt = makeButton('Save belt size', 'save-belt-size', async () => { unified.updateBeltSize(student, belt.value); const synced = await unified.flushStudentUpdates(); setStatus(synced ? `${student.firstName} belt size saved.` : 'Belt size saved locally; cloud sync failed.'); expanded.add(key(student)); render(); });
  beltField.append(beltLabel, belt, saveBelt);
  const notes = document.createElement('textarea'); notes.className = 'promotion-notes-field'; notes.rows = 3; notes.placeholder = 'Promotion notes'; notes.value = staged?.notes || ''; notes.setAttribute('aria-label', 'Promotion notes');
  const controlsRow = document.createElement('div'); controlsRow.className = 'detail-actions';
  if (staged) {
    const dateLabel = document.createElement('label'); dateLabel.className = 'promotion-date-field'; dateLabel.textContent = 'Promotion date';
    const dateInput = Object.assign(document.createElement('input'), { type: 'date', value: pendingDates.get(key(student)) || localToday(), max: localToday() });
    dateInput.addEventListener('change', () => { if (isValidDate(dateInput.value)) pendingDates.set(key(student), dateInput.value); else { pendingDates.delete(key(student)); dateInput.value = localToday(); } });
    dateLabel.appendChild(dateInput); controlsRow.appendChild(dateLabel);
  }
  controlsRow.append(makeButton(staged ? 'Update staged promotion' : 'Stage promotion', 'save', () => void stagePromotion(student, target.value || staged?.newRank, notes.value)), staged ? makeButton('Clear stage', 'cancel', () => void clearStagedPromotion(student, staged)) : document.createElement('span'));
  const recentHistory = document.createElement('div'); recentHistory.className = 'promotion-card-history';
  const title = document.createElement('strong'); title.textContent = 'Promotion history'; recentHistory.appendChild(title);
  const prior = historyRecords(student);
  if (!prior.length) recentHistory.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No previous promotions.' }));
  prior.forEach((record) => recentHistory.appendChild(historyRow(student, record)));
  detail.append(detailMeta, beltField, notes, controlsRow, recentHistory); row.append(main, detail);
  name.addEventListener('click', () => { if (expanded.has(key(student))) expanded.delete(key(student)); else expanded.add(key(student)); render(); });
  row.addEventListener('click', (event) => { if (event.target.closest('button,input,select,textarea,a,.student-details')) return; if (expanded.has(key(student))) expanded.delete(key(student)); else expanded.add(key(student)); render(); });
  return row;
}

function render() {
  const query = controls.search.value.trim().toLowerCase(); const type = controls.type.value; const rank = controls.rank.value; const attendanceFilter = controls.attendance.value; const stagedFilter = controls.staged.value;
  const students = unified.getStudents().filter((student) => student.active !== false).filter((student) => {
    const name = `${student.firstName} ${student.lastName}`.toLowerCase(); const studentStats = stats(student); const staged = Boolean(stagedRecord(student));
    if (query && !name.includes(query)) return false;
    if (type !== 'all' && student.studentType !== type) return false;
    if (rank && rank !== rankFilterValue(student)) return false;
    if (attendanceFilter === 'none' && studentStats.attended > 0) return false;
    if (attendanceFilter === 'high' && studentStats.percent < 75) return false;
    if (attendanceFilter === 'low' && studentStats.percent >= 50) return false;
    if (stagedFilter === 'staged' && !staged) return false;
    if (stagedFilter === 'unstaged' && staged) return false;
    return true;
  }).sort(sortStudents);
  list.replaceChildren();
  students.forEach((student) => list.appendChild(renderStudent(student)));
}

const rankOptions = new Map();
[['child', KIDS_RANKS], ['adult', ADULT_RANKS]].forEach(([type, ranks]) => ranks.forEach((rank) => { const value = `${type}:${rank}`; rankOptions.set(value, `${type === 'child' ? 'Child' : 'Adult'} · ${rank}`); }));
rankOptions.forEach((label, value) => controls.rank.appendChild(new Option(label, value)));
Object.values(controls).forEach((control) => control.addEventListener('input', render));
controls.sort.addEventListener('change', () => { window.promotionSortDirection = 1; render(); });
document.querySelectorAll('.promotion-workflow-header [data-sort]').forEach((header) => header.addEventListener('click', () => {
  const field = header.dataset.sort;
  window.promotionSortDirection = field === controls.sort.value ? -(window.promotionSortDirection || 1) : 1;
  controls.sort.value = field; render();
}));
document.getElementById('clearStaged').addEventListener('click', async () => {
  const staged = unified.getStudents().filter((student) => stagedRecord(student));
  if (!staged.length || !confirm(`Clear all ${staged.length} staged promotions?`)) return;
  for (const student of staged) { const record = stagedRecord(student); if (record) await clearStagedPromotion(student, record, false); }
  setStatus('All staged promotions cleared.'); render();
});

await Promise.allSettled([
  kidsStudents.syncFromCloud(), adultStudents.syncFromCloud(), kidsAttendance.syncFromCloud(), adultAttendance.syncFromCloud(),
  syncFromCloud('kids', 'bjj_promotions'), syncFromCloud('adult', 'bjj_adult_promotions'),
]);
render();
window.addEventListener('storage', (event) => { if (['bjj_students', 'bjj_adult_students', 'bjj_promotions', 'bjj_adult_promotions'].includes(event.key)) render(); });
window.addEventListener('focus', async () => {
  await Promise.allSettled([
    kidsStudents.syncFromCloud(), adultStudents.syncFromCloud(), kidsAttendance.syncFromCloud(), adultAttendance.syncFromCloud(),
    syncFromCloud('kids', 'bjj_promotions'), syncFromCloud('adult', 'bjj_adult_promotions'),
  ]);
  render();
});
