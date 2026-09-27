import * as unified from './unified-students.js?v=4';
import * as kidsStudents from './students.js?v=5';
import * as adultStudents from './adult-students.js?v=3';
import * as kidsAttendance from './attendance.js?v=6';
import * as adultAttendance from './adult-attendance.js?v=5';
import * as beltSizes from './shared-belt-sizes.js?v=1';
import * as kidsBeltSizes from './belt-sizes.js?v=1';
import * as adultBeltSizes from './adult-belt-sizes.js?v=1';
import { syncFromCloud, syncLocalPromotions, deleteStagedPromotion } from './promotion-cloud.js?v=3';

const KIDS_RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Grey/White', 'Grey/White 1', 'Grey/White 2', 'Grey/White 3', 'Grey/White 4', 'Grey', 'Grey 1', 'Grey 2', 'Grey 3', 'Grey 4', 'Grey/Black', 'Grey/Black 1', 'Grey/Black 2', 'Grey/Black 3', 'Grey/Black 4', 'Yellow/White', 'Yellow/White 1', 'Yellow/White 2', 'Yellow/White 3', 'Yellow/White 4', 'Yellow', 'Yellow 1', 'Yellow 2', 'Yellow 3', 'Yellow 4', 'Yellow/Black', 'Yellow/Black 1', 'Yellow/Black 2', 'Yellow/Black 3', 'Yellow/Black 4', 'Orange/White', 'Orange/White 1', 'Orange/White 2', 'Orange/White 3', 'Orange/White 4', 'Orange', 'Orange 1', 'Orange 2', 'Orange 3', 'Orange 4', 'Orange/Black', 'Orange/Black 1', 'Orange/Black 2', 'Orange/Black 3', 'Orange/Black 4', 'Green/White', 'Green/White 1', 'Green/White 2', 'Green/White 3', 'Green/White 4', 'Green', 'Green 1', 'Green 2', 'Green 3', 'Green 4', 'Green/Black', 'Green/Black 1', 'Green/Black 2', 'Green/Black 3', 'Green/Black 4'];
const ADULT_RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Blue', 'Blue 1', 'Blue 2', 'Blue 3', 'Blue 4', 'Purple', 'Purple 1', 'Purple 2', 'Purple 3', 'Purple 4', 'Brown', 'Brown 1', 'Brown 2', 'Brown 3', 'Brown 4', 'Black', 'Black 1', 'Black 2', 'Black 3', 'Black 4'];
const list = document.getElementById('promotionWorkflowList');
const history = document.getElementById('promotionHistory');
const controls = {
  search: document.getElementById('promotionSearch'), type: document.getElementById('promotionType'), rank: document.getElementById('promotionRank'), attendance: document.getElementById('promotionAttendance'), staged: document.getElementById('promotionStaged'), sort: document.getElementById('promotionSort'),
};
const filtersToggle = document.getElementById('promotionFiltersToggle');
filtersToggle?.addEventListener('click', () => {
  const open = document.body.classList.toggle('mobile-filters-open');
  filtersToggle.setAttribute('aria-expanded', String(open));
});
const status = document.getElementById('promotionStatus');
const expanded = new Set();
const pendingTargets = new Map();
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
function readPromotions(studentType) { try { const value = JSON.parse(localStorage.getItem(studentType === 'adult' ? 'bjj_adult_promotions' : 'bjj_promotions') || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function savePromotions(studentType, records) { const store = studentType === 'adult' ? 'bjj_adult_promotions' : 'bjj_promotions'; localStorage.setItem(store, JSON.stringify(records)); return syncLocalPromotions(studentType === 'adult' ? 'adult' : 'kids', records).then(() => true).catch((error) => { console.error('Promotion sync failed', error); setStatus('Promotion saved locally; cloud sync failed.'); return false; }); }
function stagedRecord(student) { return readPromotions(student.studentType).find((record) => Number(record.studentId) === Number(student.sourceId) && record.staged === true) || null; }
function matchesStage(record, stage) { if (!record || !stage || Number(record.studentId) !== Number(stage.studentId) || record.staged !== true) return false; if (record.legacyKey && stage.legacyKey) return record.legacyKey === stage.legacyKey; return String(record.createdAt || record.promotionDate || '') === String(stage.createdAt || stage.promotionDate || ''); }
function historyRecords(student) { return readPromotions(student.studentType).filter((record) => Number(record.studentId) === Number(student.sourceId) && !record.staged).sort((a, b) => String(b.promotionDate || b.createdAt || '').localeCompare(String(a.promotionDate || a.createdAt || ''))); }
function stats(student) { const api = attendanceApi(student); const total = student.studentType === 'adult' ? api.getTotalClasses() : api.getTotalClasses(student.sourceId); const attended = api.getTotalAttended(student.sourceId); return { attended, total, percent: total ? Math.round(attended * 100 / total) : 0 }; }
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
  if (field === 'date') { const dateA = historyRecords(a)[0]?.promotionDate || ''; const dateB = historyRecords(b)[0]?.promotionDate || ''; return String(dateA).localeCompare(String(dateB)) * direction; }
  return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`) * direction;
}

function renderHistory() {
  history.replaceChildren();
  const records = unified.getStudents().flatMap((student) => historyRecords(student).map((record) => ({ student, record }))).sort((a, b) => String(b.record.promotionDate || b.record.createdAt || '').localeCompare(String(a.record.promotionDate || a.record.createdAt || '')));
  if (!records.length) { history.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No promotions recorded yet.' })); return; }
  records.forEach(({ student, record }) => {
    const item = document.createElement('article'); item.className = 'promotion-history-item';
    const summary = document.createElement('div'); summary.className = 'promotion-history-summary';
    const name = document.createElement('strong'); name.textContent = `${student.firstName} ${student.lastName}`;
    const detail = document.createElement('span'); detail.textContent = `${record.oldRank || 'White'} → ${record.newRank} · ${formatDate(record.promotionDate || record.createdAt)}${record.beltSize ? ` · ${record.beltSize}` : ''}`;
    const notes = document.createElement('span'); notes.textContent = record.notes || '';
    summary.append(name, detail, notes); item.appendChild(summary); history.appendChild(item);
  });
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
  const store = readPromotions(student.studentType).filter((record) => !matchesStage(record, stage));
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
  const appliedAt = today();
  record.oldRank = student.rank || record.oldRank || 'White'; record.beltSize = student.beltSize || record.beltSize || ''; record.confirmed = true; record.staged = false; record.promotionDate = appliedAt; record.createdAt = appliedAt;
  if (!unified.updateRank(student, record.newRank)) { setStatus('Promotion could not update the student record.'); return false; }
  const studentSynced = await unified.flushStudentUpdates();
  const promotionSynced = await savePromotions(student.studentType, store);
  pendingTargets.delete(key(student)); expanded.add(key(student));
  setStatus(studentSynced && promotionSynced ? `${student.firstName} promoted to ${record.newRank}.` : `${student.firstName} promoted locally; cloud sync failed.`);
  if (renderAfter) render();
  return studentSynced && promotionSynced;
}

function renderStudent(student) {
  const staged = stagedRecord(student); const savedTarget = pendingTargets.get(key(student)) || staged?.newRank || '';
  const row = document.createElement('article'); row.className = `student-row promotion-student-card belt-${String(student.rank || 'white').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const main = document.createElement('div'); main.className = 'student-main promotion-student-main';
  const name = document.createElement('button'); name.type = 'button'; name.className = 'student-name-button';
  const stripe = document.createElement('span'); stripe.className = 'belt-stripe'; const nameLabel = document.createElement('span'); nameLabel.innerHTML = `<strong>${student.firstName} ${student.lastName}</strong><small>${student.studentType === 'child' ? 'Child' : 'Adult'} · ${student.rank || 'White'}</small>`; name.append(stripe, nameLabel);
  const current = Object.assign(document.createElement('span'), { className: 'promotion-current-rank', textContent: student.rank || 'White' });
  const target = selectRank(student, savedTarget); target.className = 'promotion-target-select'; target.addEventListener('change', () => { pendingTargets.set(key(student), target.value); render(); });
  const state = Object.assign(document.createElement('span'), { className: `promotion-stage-state ${staged ? 'is-staged' : ''}`, textContent: staged ? 'Staged' : 'Not staged' });
  const stage = makeButton(staged ? 'Apply' : 'Stage', 'save', () => { if (staged) void applyPromotion(student, staged); else void stagePromotion(student, target.value || pendingTargets.get(key(student)), ''); });
  main.append(name, current, target, state, stage);
  const detail = document.createElement('div'); detail.className = 'student-details'; detail.hidden = !expanded.has(key(student));
  const studentStats = stats(student); const lastPromotion = historyRecords(student)[0];
  const detailMeta = document.createElement('div'); detailMeta.className = 'student-detail-info';
  [student.studentType === 'child' ? 'Child' : 'Adult', `${studentStats.attended}/${studentStats.total} attended · ${studentStats.percent}%`, `Belt size: ${student.beltSize || 'Not set'}`, `Last promoted: ${formatDate(lastPromotion?.promotionDate || lastPromotion?.createdAt)}`].forEach((value) => detailMeta.appendChild(Object.assign(document.createElement('span'), { textContent: value })));
  const belt = selectBelt(student, student.beltSize || ''); belt.id = `promotion-belt-${student.studentType}-${student.sourceId}`; belt.setAttribute('aria-label', 'Belt size');
  const beltField = document.createElement('div'); beltField.className = 'promotion-belt-field'; const beltLabel = document.createElement('label'); beltLabel.htmlFor = belt.id; beltLabel.textContent = 'Belt size';
  const saveBelt = makeButton('Save belt size', 'save-belt-size', async () => { unified.updateBeltSize(student, belt.value); const synced = await unified.flushStudentUpdates(); setStatus(synced ? `${student.firstName} belt size saved.` : 'Belt size saved locally; cloud sync failed.'); expanded.add(key(student)); render(); });
  beltField.append(beltLabel, belt, saveBelt);
  const notes = document.createElement('textarea'); notes.className = 'promotion-notes-field'; notes.rows = 3; notes.placeholder = 'Promotion notes'; notes.value = staged?.notes || ''; notes.setAttribute('aria-label', 'Promotion notes');
  const controlsRow = document.createElement('div'); controlsRow.className = 'detail-actions';
  controlsRow.append(makeButton(staged ? 'Update staged promotion' : 'Stage promotion', 'save', () => void stagePromotion(student, target.value || staged?.newRank, notes.value)), staged ? makeButton('Clear stage', 'cancel', () => void clearStagedPromotion(student, staged)) : document.createElement('span'));
  const recentHistory = document.createElement('div'); recentHistory.className = 'promotion-card-history';
  const title = document.createElement('strong'); title.textContent = 'Promotion history'; recentHistory.appendChild(title);
  const prior = historyRecords(student).slice(0, 3);
  if (!prior.length) recentHistory.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No previous promotions.' }));
  prior.forEach((record) => { const line = document.createElement('p'); line.textContent = `${record.oldRank || 'White'} → ${record.newRank} · ${formatDate(record.promotionDate || record.createdAt)}`; recentHistory.appendChild(line); });
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
  renderHistory();
}

const rankOptions = new Map();
[['child', KIDS_RANKS], ['adult', ADULT_RANKS]].forEach(([type, ranks]) => ranks.forEach((rank) => { const value = `${type}:${rank}`; rankOptions.set(value, `${type === 'child' ? 'Child' : 'Adult'} · ${rank}`); }));
rankOptions.forEach((label, value) => controls.rank.appendChild(new Option(label, value)));
Object.values(controls).forEach((control) => control.addEventListener('input', render));
controls.sort.addEventListener('change', render);
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
