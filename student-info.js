import * as unified from './unified-students.js?v=1';
import * as belts from './shared-belt-sizes.js?v=1';
import * as waiverStore from './waiver-store.js?v=1';
import * as kidsAttendanceApi from './attendance.js?v=5';
import * as adultAttendanceApi from './adult-attendance.js?v=3';

const KIDS_RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Grey/White', 'Grey/White 1', 'Grey/White 2', 'Grey/White 3', 'Grey/White 4', 'Grey', 'Grey 1', 'Grey 2', 'Grey 3', 'Grey 4', 'Grey/Black', 'Grey/Black 1', 'Grey/Black 2', 'Grey/Black 3', 'Grey/Black 4', 'Yellow/White', 'Yellow/White 1', 'Yellow/White 2', 'Yellow/White 3', 'Yellow/White 4', 'Yellow', 'Yellow 1', 'Yellow 2', 'Yellow 3', 'Yellow 4', 'Yellow/Black', 'Yellow/Black 1', 'Yellow/Black 2', 'Yellow/Black 3', 'Yellow/Black 4', 'Orange/White', 'Orange/White 1', 'Orange/White 2', 'Orange/White 3', 'Orange/White 4', 'Orange', 'Orange 1', 'Orange 2', 'Orange 3', 'Orange 4', 'Orange/Black', 'Orange/Black 1', 'Orange/Black 2', 'Orange/Black 3', 'Orange/Black 4', 'Green/White', 'Green/White 1', 'Green/White 2', 'Green/White 3', 'Green/White 4', 'Green', 'Green 1', 'Green 2', 'Green 3', 'Green 4', 'Green/Black', 'Green/Black 1', 'Green/Black 2', 'Green/Black 3', 'Green/Black 4'];
const ADULT_RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Blue', 'Blue 1', 'Blue 2', 'Blue 3', 'Blue 4', 'Purple', 'Purple 1', 'Purple 2', 'Purple 3', 'Purple 4', 'Brown', 'Brown 1', 'Brown 2', 'Brown 3', 'Brown 4', 'Black', 'Black 1', 'Black 2', 'Black 3', 'Black 4'];
const kidsAttendance = () => read('bjj_attendance');
const adultAttendance = () => read('bjj_adult_attendance');
const read = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch (e) { return []; } };
const list = document.getElementById('studentInfoList');
const typeFilter = document.getElementById('typeFilter');
const nameSearch = document.getElementById('nameSearch');
const rankFilter = document.getElementById('rankFilter');
const attendanceFilter = document.getElementById('attendanceFilter');
const statusFilter = document.getElementById('statusFilter');
const promoteFilter = document.getElementById('promoteFilter');
const status = document.getElementById('studentInfoStatus');
const inactiveSection = document.getElementById('inactiveStudentsSection');
const inactiveToggle = document.getElementById('inactiveStudentsToggle');
const inactiveList = document.getElementById('inactiveStudentInfoList');
let sortField = 'lastName';
let sortDirection = 1;
const expanded = new Set();
const STUDENT_INFO_PREFERENCES_KEY = 'bjj_student_info_preferences';
function studentInfoPreferences() { try { const value = JSON.parse(localStorage.getItem(STUDENT_INFO_PREFERENCES_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch (e) { return {}; } }
function saveStudentInfoPreferences(patch) { localStorage.setItem(STUDENT_INFO_PREFERENCES_KEY, JSON.stringify({ ...studentInfoPreferences(), ...patch })); }
const savedStudentInfoPreferences = studentInfoPreferences();
const pendingTargets = new Map(Object.entries(savedStudentInfoPreferences.targets || {}));
const PROMOTE_KEY = 'bjj_student_promote_flags';
function promoteFlags() { try { const value = JSON.parse(localStorage.getItem(PROMOTE_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; } catch (e) { return {}; } }
function promoteKey(student) { return `${student.studentType}:${student.sourceId}`; }
function setPromoteFlag(student, value) { const flags = promoteFlags(); const key = promoteKey(student); if (value) flags[key] = true; else delete flags[key]; localStorage.setItem(PROMOTE_KEY, JSON.stringify(flags)); }

function setStatus(text) { status.textContent = text; }
function ranksFor(studentType) { return studentType === 'adult' ? ADULT_RANKS : KIDS_RANKS; }
function allRanks() { return [...new Set([...KIDS_RANKS, ...ADULT_RANKS])]; }
function recordsFor(student) { return student.studentType === 'adult' ? adultAttendance() : kidsAttendance(); }
function startDateInfo(student) { if (student.startDate) return { date: student.startDate, source: 'saved' }; const dates = recordsFor(student).filter((record) => Number(record.studentId) === Number(student.sourceId) && record.date).map((record) => String(record.date)).sort(); if (dates[0]) return { date: dates[0], source: 'attendance' }; const waiver = waiverStore.getLatestWaiverForStudent(student.studentType === 'child' ? 'kids' : 'adult', student.sourceId); return waiver?.signedAt ? { date: String(waiver.signedAt).slice(0, 10), source: 'waiver' } : { date: '', source: '' }; }
function isValidDateText(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00`)); }
function attendanceStats(student) {
  const records = recordsFor(student).filter((record) => Number(record.studentId) === Number(student.sourceId) && record.present);
  const dates = records.map((record) => String(record.date || '')).sort();
  const today = new Date(); const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 29); const cutoffText = cutoff.toISOString().slice(0, 10);
  const attended = student.studentType === 'adult' ? adultAttendanceApi.getTotalAttended(student.sourceId) : kidsAttendanceApi.getTotalAttended(student.sourceId);
  const total = student.studentType === 'adult' ? adultAttendanceApi.getTotalClasses() : kidsAttendanceApi.getTotalClasses(student.sourceId);
  return { count: attended, recent: records.filter((record) => String(record.date || '') >= cutoffText).length, last: dates.at(-1) || '', percent: total ? Math.round((attended / total) * 100) : 0 };
}
function formatPhone(value) { const digits = String(value || '').replace(/\D/g, ''); return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : value || '—'; }
function promotionKey(student) { return student.studentType === 'adult' ? 'bjj_adult_promotions' : 'bjj_promotions'; }
function promotionsFor(student) { return read(promotionKey(student)).filter((record) => Number(record.studentId) === Number(student.sourceId)).sort((a, b) => String(b.promotionDate || b.createdAt || '').localeCompare(String(a.promotionDate || a.createdAt || ''))); }
function rankStartDate(student) { if (student.rankStartDate) return student.rankStartDate; const dates = recordsFor(student).filter((record) => Number(record.studentId) === Number(student.sourceId)).map((record) => String(record.date || '')).filter(Boolean).sort(); return dates[0] || ''; }
function dayDifference(start, end) { if (!start || !end) return null; const startDate = new Date(`${start}T00:00:00`); const endDate = new Date(`${end}T00:00:00`); const days = Math.round((endDate - startDate) / 86400000); return Number.isFinite(days) && days >= 0 ? days : null; }
function promotionDuration(student, record, history) { const currentDate = String(record.promotionDate || record.createdAt || '').slice(0, 10); const index = history.indexOf(record); const previousDate = index === history.length - 1 ? rankStartDate(student) : String(history[index + 1].promotionDate || history[index + 1].createdAt || '').slice(0, 10); return dayDifference(previousDate, currentDate); }
function recalculatePromotionState(student, deletedRecord) { const records = read(promotionKey(student)).filter((entry) => !(entry.studentId === deletedRecord.studentId && entry.promotionDate === deletedRecord.promotionDate && entry.createdAt === deletedRecord.createdAt)); localStorage.setItem(promotionKey(student), JSON.stringify(records)); const chronological = records.slice().sort((a, b) => String(a.promotionDate || a.createdAt || '').localeCompare(String(b.promotionDate || b.createdAt || ''))); const current = chronological.at(-1); unified.updateRank(student, current ? current.newRank : (deletedRecord.oldRank || 'White')); if (current?.beltSize) unified.updateBeltSize(student, current.beltSize); }
function rankTint(rank) {
  const value = String(rank || '').toLowerCase();
  if (value.includes('yellow')) return ['rgba(250,204,21,.12)', 'rgba(250,204,21,.03)'];
  if (value.includes('orange')) return ['rgba(249,115,22,.12)', 'rgba(249,115,22,.03)'];
  if (value.includes('green')) return ['rgba(34,197,94,.12)', 'rgba(34,197,94,.03)'];
  if (value.includes('grey')) return ['rgba(156,163,175,.12)', 'rgba(156,163,175,.03)'];
  if (value.includes('blue')) return ['rgba(59,130,246,.12)', 'rgba(59,130,246,.03)'];
  if (value.includes('purple')) return ['rgba(168,85,247,.12)', 'rgba(168,85,247,.03)'];
  if (value.includes('brown')) return ['rgba(146,64,14,.14)', 'rgba(146,64,14,.04)'];
  if (value.includes('black')) return ['rgba(107,114,128,.18)', 'rgba(17,24,39,.08)'];
  return ['rgba(255,255,255,.06)', 'rgba(255,255,255,.025)'];
}
function populateRanks() { rankFilter.replaceChildren(new Option('All ranks', '')); allRanks().forEach((rank) => rankFilter.appendChild(new Option(rank, rank))); }
function beltSelect(student) { const select = document.createElement('select'); select.appendChild(new Option('', '')); belts.getSizesForType(student.studentType).forEach((size) => select.appendChild(new Option(size, size, false, size === student.beltSize))); select.value = student.beltSize || ''; select.addEventListener('change', () => { const beltSize = select.value; if (!unified.updateBeltSize(student, beltSize)) { setStatus(`${student.firstName} ${student.lastName} belt size could not be saved`); return; } student.beltSize = beltSize; setStatus(`${student.firstName} ${student.lastName} belt size saved`); }); return select; }
function targetSelect(student) { const select = document.createElement('select'); select.appendChild(new Option('Select rank', '')); ranksFor(student.studentType).forEach((rank) => select.appendChild(new Option(rank, rank))); const key = `${student.studentType}:${student.sourceId}`; select.value = student.targetRank || pendingTargets.get(key) || ''; select.addEventListener('change', () => { const targetRank = select.value; if (!unified.updateStudent(student, { targetRank })) { setStatus(`${student.firstName} ${student.lastName} target rank could not be saved`); return; } student.targetRank = targetRank; pendingTargets.set(key, targetRank); saveStudentInfoPreferences({ targets: Object.fromEntries(pendingTargets) }); setStatus(`${student.firstName} ${student.lastName} target rank saved`); }); return select; }
function appendDetail(row, student) {
  const detail = document.createElement('div'); detail.className = 'student-info-detail'; detail.hidden = !expanded.has(`${student.studentType}:${student.sourceId}`); detail.style.gridColumn = '1 / -1';
  const waiver = waiverStore.getLatestWaiverForStudent(student.studentType === 'child' ? 'kids' : 'adult', student.sourceId);
  const waiverRow = document.createElement('div'); waiverRow.className = 'student-info-detail-row'; const waiverLabel = document.createElement('strong'); waiverLabel.textContent = 'Waiver'; const waiverValue = document.createElement('span'); waiverValue.className = `promotion-status ${waiver ? 'confirmed' : 'unconfirmed'}`; waiverValue.textContent = waiver ? `Signed ${String(waiver.signedAt || '').slice(0, 10)}` : 'Not signed'; const contactValue = document.createElement('span'); contactValue.textContent = waiver ? `Phone: ${formatPhone(waiver.contact?.phone)} · Emergency: ${waiver.contact?.emergencyName || '—'} · ${formatPhone(waiver.contact?.emergencyPhone)}` : ''; contactValue.hidden = !waiver; const waiverLink = document.createElement('a'); waiverLink.className = 'btn'; waiverLink.href = `waiver.html?studentType=${student.studentType === 'child' ? 'kids' : 'adult'}&studentId=${student.sourceId}`; waiverLink.textContent = waiver ? 'View / Edit' : 'Create'; waiverRow.append(waiverLabel, waiverValue, contactValue, waiverLink);
    const studentStart = startDateInfo(student); const startDateRow = document.createElement('div'); startDateRow.className = 'student-info-detail-row student-info-start-date-row'; const studentStartLabel = document.createElement('strong'); studentStartLabel.textContent = 'Start date'; const studentStartValue = document.createElement('span'); studentStartValue.className = 'student-info-start-date-value'; studentStartValue.textContent = studentStart.date || 'No date recorded'; const studentStartHint = document.createElement('span'); studentStartHint.textContent = student.startDate ? 'Saved date' : studentStart.source ? `${studentStart.source} record` : ''; const editStartDate = document.createElement('button'); editStartDate.type = 'button'; editStartDate.className = 'btn edit'; editStartDate.textContent = 'Edit'; editStartDate.addEventListener('click', () => { const studentStartInput = document.createElement('input'); studentStartInput.type = 'text'; studentStartInput.inputMode = 'numeric'; studentStartInput.placeholder = 'YYYY-MM-DD'; studentStartInput.maxLength = 10; studentStartInput.value = student.startDate || ''; const saveStartDate = document.createElement('button'); saveStartDate.type = 'button'; saveStartDate.className = 'btn save'; saveStartDate.textContent = 'Save'; const cancelStartDate = document.createElement('button'); cancelStartDate.type = 'button'; cancelStartDate.className = 'btn cancel'; cancelStartDate.textContent = 'Cancel'; saveStartDate.addEventListener('click', () => { const nextDate = studentStartInput.value.trim(); if (nextDate && !isValidDateText(nextDate)) { setStatus('Enter the start date as YYYY-MM-DD'); studentStartInput.focus(); return; } unified.updateStudent(student, { startDate: nextDate }); setStatus('Student start date saved'); expanded.add(`${student.studentType}:${student.sourceId}`); render(); }); cancelStartDate.addEventListener('click', () => { expanded.add(`${student.studentType}:${student.sourceId}`); render(); }); startDateRow.replaceChildren(studentStartLabel, studentStartInput, saveStartDate, cancelStartDate); studentStartInput.focus(); }); startDateRow.append(studentStartLabel, studentStartValue, studentStartHint, editStartDate);
  const activeDetailRow = document.createElement('div'); activeDetailRow.className = 'student-info-detail-row'; const activeDetailLabel = document.createElement('strong'); activeDetailLabel.textContent = 'Status'; const activeDetail = document.createElement('select'); activeDetail.append(new Option('Active', 'active'), new Option('Inactive', 'inactive')); activeDetail.value = student.active === false ? 'inactive' : 'active'; activeDetail.addEventListener('change', () => { unified.updateStudent(student, { active: activeDetail.value === 'active', inactiveSince: activeDetail.value === 'inactive' ? new Date().toISOString().slice(0, 10) : '' }); setStatus(`${student.firstName} ${student.lastName} marked ${activeDetail.value}`); render(); }); activeDetailRow.append(activeDetailLabel, activeDetail);
  const typeDetailRow = document.createElement('div'); typeDetailRow.className = 'student-info-detail-row'; const typeDetailLabel = document.createElement('strong'); typeDetailLabel.textContent = 'Type'; const typeDetail = document.createElement('select'); typeDetail.append(new Option('Child', 'child'), new Option('Adult', 'adult')); typeDetail.value = student.studentType; typeDetail.addEventListener('change', () => { const moved = unified.changeStudentType(student, typeDetail.value); if (moved) { setStatus(`${student.firstName} ${student.lastName} moved to ${typeDetail.value}`); render(); } }); typeDetailRow.append(typeDetailLabel, typeDetail);
  const history = promotionsFor(student); const historyRow = document.createElement('div'); historyRow.className = 'student-info-detail-row student-info-promotion-row'; const historyHeader = document.createElement('div'); historyHeader.className = 'student-info-promotion-header'; const historyToggle = document.createElement('button'); historyToggle.type = 'button'; historyToggle.className = 'student-info-promotion-main-toggle'; historyToggle.textContent = '>'; const historyLabel = document.createElement('strong'); historyLabel.textContent = 'Promotions'; const currentRank = document.createElement('span'); currentRank.className = 'student-info-current-rank'; currentRank.textContent = `Current rank: ${student.rank || 'White'}`; const historyList = document.createElement('div'); historyList.className = 'student-info-promotion-list'; const startRow = document.createElement('div'); startRow.className = 'student-info-rank-start'; const startLabel = document.createElement('label'); startLabel.textContent = 'Rank start date'; const startInput = document.createElement('input'); startInput.type = 'date'; startInput.value = rankStartDate(student); startInput.addEventListener('change', () => { unified.updateStudent(student, { rankStartDate: startInput.value }); setStatus('Rank start date saved'); }); startRow.append(startLabel, startInput); historyHeader.append(historyToggle, historyLabel, startRow, currentRank);
  if (!history.length) { const empty = document.createElement('span'); empty.textContent = 'No promotion history'; historyList.appendChild(empty); }
  const promotionItems = [];
  history.forEach((record, index) => {
    const item = document.createElement('div'); item.className = 'student-info-promotion-item';
    const duration = promotionDuration(student, record, history); const summary = document.createElement('span'); summary.textContent = `${record.oldRank || 'White'} -> ${record.newRank || 'Unknown'} · ${String(record.promotionDate || record.createdAt || '').slice(0, 10)}${record.beltSize ? ` · ${record.beltSize}` : ''}${duration == null ? ' · Set rank start date' : ` · ${duration} days at ${record.oldRank || 'previous rank'}`}`;
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn edit'; edit.textContent = 'Edit';
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn cancel'; remove.textContent = 'Delete'; remove.addEventListener('click', () => { recalculatePromotionState(student, record); setStatus('Promotion deleted and rank restored'); expanded.add(`${student.studentType}:${student.sourceId}`); render(); });
    edit.addEventListener('click', () => {
      const oldRank = document.createElement('input'); oldRank.value = record.oldRank || 'White'; oldRank.setAttribute('aria-label', 'Previous rank');
      const newRank = document.createElement('select'); ranksFor(student.studentType).forEach((rank) => newRank.appendChild(new Option(rank, rank, false, rank === record.newRank)));
      const date = document.createElement('input'); date.type = 'date'; date.value = String(record.promotionDate || record.createdAt || '').slice(0, 10); date.setAttribute('aria-label', 'Promotion date');
      const belt = document.createElement('select'); belt.appendChild(new Option('', '')); belts.getSizesForType(student.studentType).forEach((size) => belt.appendChild(new Option(size, size, false, size === record.beltSize)));
      const confirmed = document.createElement('input'); confirmed.type = 'checkbox'; confirmed.checked = Boolean(record.confirmed); confirmed.setAttribute('aria-label', 'Promotion confirmed');
      const confirmedField = document.createElement('label'); confirmedField.className = 'student-info-confirmed-field'; confirmedField.append(confirmed, document.createTextNode(' Confirmed'));
      const save = document.createElement('button'); save.type = 'button'; save.className = 'btn save'; save.textContent = 'Save';
      const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn cancel'; cancel.textContent = 'Cancel';
      save.addEventListener('click', () => { const records = read(promotionKey(student)); const target = records.find((entry) => entry === record || (entry.studentId === record.studentId && entry.promotionDate === record.promotionDate && entry.createdAt === record.createdAt)); if (!target) return; target.oldRank = oldRank.value.trim() || target.oldRank; target.newRank = newRank.value; target.beltSize = belt.value; target.confirmed = confirmed.checked; target.promotionDate = date.value ? `${date.value}T12:00:00.000Z` : target.promotionDate; localStorage.setItem(promotionKey(student), JSON.stringify(records)); setStatus('Promotion history updated'); expanded.add(`${student.studentType}:${student.sourceId}`); render(); });
      cancel.addEventListener('click', () => { expanded.add(`${student.studentType}:${student.sourceId}`); render(); });
      const editor = document.createElement('div'); editor.className = 'student-info-promotion-editor'; editor.append(oldRank, newRank, date, belt, confirmedField, save, cancel); item.classList.add('is-editing'); item.replaceChildren(editor);
      oldRank.focus();
    });
    item.append(summary, edit, remove); promotionItems.push(item);
  });
  if (promotionItems.length) {
    const latest = promotionItems[0]; historyList.appendChild(latest);
    historyToggle.addEventListener('click', () => { historyRow.classList.toggle('is-open'); historyToggle.textContent = historyRow.classList.contains('is-open') ? 'v' : '>'; });
    if (promotionItems.length > 1) {
      const older = document.createElement('div'); older.className = 'student-info-older-promotions'; older.hidden = true;
      promotionItems.slice(1).forEach((item) => older.appendChild(item)); historyList.appendChild(older); historyToggle.addEventListener('click', () => { older.hidden = !older.hidden; historyToggle.textContent = older.hidden ? '>' : 'v'; });
    }
  } else historyToggle.disabled = true;
  historyRow.append(historyHeader, historyList);
  const notesRow = document.createElement('div'); notesRow.className = 'student-info-detail-row'; const notesLabel = document.createElement('strong'); notesLabel.textContent = 'Notes'; const notesValue = document.createElement('span'); notesValue.textContent = student.notes || 'No student notes'; const editNotes = document.createElement('button'); editNotes.type = 'button'; editNotes.className = 'btn edit'; editNotes.textContent = 'Edit notes'; editNotes.addEventListener('click', () => {
    const editor = document.createElement('textarea'); editor.className = 'student-info-notes-editor'; editor.value = student.notes || ''; editor.setAttribute('aria-label', `Notes for ${student.firstName} ${student.lastName}`);
    const saveNotes = document.createElement('button'); saveNotes.type = 'button'; saveNotes.className = 'btn save'; saveNotes.textContent = 'Save notes';
    const cancelNotes = document.createElement('button'); cancelNotes.type = 'button'; cancelNotes.className = 'btn cancel'; cancelNotes.textContent = 'Cancel';
    saveNotes.addEventListener('click', () => { unified.updateNotes(student, editor.value.trim()); expanded.add(`${student.studentType}:${student.sourceId}`); setStatus(`${student.firstName} ${student.lastName} notes saved`); render(); });
    cancelNotes.addEventListener('click', () => { expanded.add(`${student.studentType}:${student.sourceId}`); render(); });
    notesRow.replaceChildren(notesLabel, editor, saveNotes, cancelNotes);
    editor.focus();
  }); notesRow.append(notesLabel, notesValue, editNotes); detail.append(typeDetailRow, activeDetailRow, startDateRow, waiverRow, notesRow, historyRow); row.appendChild(detail);
}
function render() {
  const query = nameSearch.value.trim().toLowerCase(); const type = typeFilter.value; const rank = rankFilter.value; const attendance = attendanceFilter.value; const selectedStatus = statusFilter.value; const selectedPromote = promoteFilter.value; const flags = promoteFlags();
  list.replaceChildren();
  const students = unified.getStudents().filter((student) => {
    const name = `${student.firstName} ${student.lastName}`.toLowerCase(); const stats = attendanceStats(student);
    if (type !== 'all' && student.studentType !== type) return false;
    if (query && !name.includes(query)) return false;
    if (rank && student.rank !== rank) return false;
    if (attendance === 'none' && stats.count > 0) return false;
    if (attendance === 'recent' && stats.recent === 0) return false;
    if (attendance === 'high' && stats.percent < 75) return false;
    if (attendance === 'low' && stats.percent >= 50) return false;
    if (selectedStatus !== 'all' && (student.active === false ? 'inactive' : 'active') !== selectedStatus) return false;
    if (selectedPromote === 'marked' && !flags[promoteKey(student)]) return false;
    if (selectedPromote === 'unmarked' && flags[promoteKey(student)]) return false;
    return true;
  }).sort((a, b) => { const left = sortField === 'firstName' ? a.firstName : sortField === 'attendance' ? attendanceStats(a).count : a.lastName; const right = sortField === 'firstName' ? b.firstName : sortField === 'attendance' ? attendanceStats(b).count : b.lastName; const result = typeof left === 'number' ? left - right : String(left || '').localeCompare(String(right || '')); if (result !== 0) return result * sortDirection; return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`); });
  const activeStudents = students.filter((student) => student.active !== false); const inactiveStudents = students.filter((student) => student.active === false);
  if (!activeStudents.length) list.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No active students match these filters' }));
  const renderStudent = (student, targetList, inactive = false) => {
    const row = document.createElement('div'); row.className = 'student-info-row'; const stats = attendanceStats(student); const key = `${student.studentType}:${student.sourceId}`;
    const nameCell = document.createElement('div'); nameCell.className = 'student-info-name-cell';
    const expand = document.createElement('button'); expand.type = 'button'; expand.className = 'student-info-expand'; expand.textContent = expanded.has(key) ? 'v' : '>'; expand.setAttribute('aria-label', `${expanded.has(key) ? 'Collapse' : 'Expand'} details for ${student.firstName} ${student.lastName}`);
    const name = document.createElement('button'); name.className = 'student-info-name'; name.textContent = `${student.firstName} ${student.lastName}`; name.title = `${student.firstName} ${student.lastName}`;
    const toggleDetails = () => { if (expanded.has(key)) expanded.delete(key); else expanded.add(key); render(); };
    const mobileAttendance = document.createElement('small'); mobileAttendance.className = 'student-info-mobile-attendance'; mobileAttendance.textContent = `${stats.count} attended${stats.last ? ` · last ${stats.last}` : ''}`; expand.addEventListener('click', toggleDetails); name.addEventListener('click', toggleDetails); nameCell.append(expand, name, mobileAttendance);
    const type = document.createElement('select'); type.append(new Option('Child', 'child'), new Option('Adult', 'adult')); type.value = student.studentType; type.addEventListener('change', () => { const moved = unified.changeStudentType(student, type.value); if (moved) { setStatus(`${student.firstName} ${student.lastName} moved to ${type.value}`); render(); } });
    const startInfo = startDateInfo(student); const rank = document.createElement('span'); rank.textContent = student.rank || 'White'; const attendanceCell = document.createElement('span'); attendanceCell.className = 'student-info-attendance'; attendanceCell.textContent = `${stats.count} attended${stats.last ? ` · last ${stats.last}` : ''}`; const belt = beltSelect(student); const target = targetSelect(student); const promote = document.createElement('input'); promote.type = 'checkbox'; promote.checked = Boolean(flags[promoteKey(student)]); promote.setAttribute('aria-label', `Mark ${student.firstName} ${student.lastName} for promotion`); promote.addEventListener('change', () => { setPromoteFlag(student, promote.checked); setStatus(`${student.firstName} ${student.lastName} ${promote.checked ? 'marked for promotion' : 'removed from promotion list'}`); }); const confirmed = document.createElement('input'); confirmed.type = 'checkbox'; confirmed.addEventListener('change', () => { if (!confirmed.checked) return; const key = `${student.studentType}:${student.sourceId}`; const nextRank = student.targetRank || pendingTargets.get(key); if (!nextRank) { confirmed.checked = false; setStatus('Choose a target rank before confirming'); return; } const records = read(promotionKey(student)); records.push({ studentId: student.sourceId, oldRank: student.rank || 'White', newRank: nextRank, beltSize: student.beltSize || '', confirmed: true, promotionDate: new Date().toISOString(), notes: '' }); localStorage.setItem(promotionKey(student), JSON.stringify(records)); setPromoteFlag(student, false); unified.updateStudent(student, { rank: nextRank, targetRank: '' }); student.targetRank = ''; unified.updateRank(student, nextRank); pendingTargets.delete(key); saveStudentInfoPreferences({ targets: Object.fromEntries(pendingTargets) }); setStatus(`${student.firstName} ${student.lastName} promoted to ${nextRank}`); render(); });
    const startDate = document.createElement('span'); startDate.textContent = startInfo.date ? `${startInfo.date}${startInfo.source === 'attendance' ? '*' : ''}` : '—'; startDate.title = startInfo.source === 'attendance' ? 'Derived from earliest attendance record' : startInfo.source === 'waiver' ? 'Derived from waiver signed date' : '';
    const active = document.createElement('select'); active.append(new Option('Active', 'active'), new Option('Inactive', 'inactive')); active.value = inactive ? 'inactive' : 'active'; active.addEventListener('change', () => { unified.updateStudent(student, { active: active.value === 'active', inactiveSince: active.value === 'inactive' ? new Date().toISOString().slice(0, 10) : '' }); setStatus(`${student.firstName} ${student.lastName} marked ${active.value}`); render(); });
    const [tint, base] = rankTint(student.rank); row.style.backgroundImage = `linear-gradient(90deg, ${tint}, transparent)`; row.style.backgroundColor = base;
    const lastName = document.createElement('span'); lastName.className = 'student-info-last-name'; lastName.textContent = student.lastName;
    const fieldCell = (label, control, className = '') => { const cell = document.createElement('div'); cell.className = `student-info-field ${className}`.trim(); cell.dataset.label = label; cell.append(control); return cell; };
    const typeReadOnly = document.createElement('span'); typeReadOnly.className = 'student-info-mobile-readonly'; typeReadOnly.textContent = student.studentType === 'child' ? 'Child' : 'Adult'; const typeCell = fieldCell('Type', type); typeCell.append(typeReadOnly); const beltCell = fieldCell('Belt size', belt); const targetCell = fieldCell('Target rank', target); const promoteCell = fieldCell('Promote', promote, 'student-info-checkbox-field'); const confirmedCell = fieldCell('Confirmed', confirmed, 'student-info-checkbox-field'); const activeCell = fieldCell('Active', active); const startDateCell = fieldCell('Start date', startDate, 'student-info-start-date-cell');
    nameCell.dataset.label = 'Name'; lastName.dataset.label = 'Last name'; attendanceCell.dataset.label = 'Attendance'; rank.dataset.label = 'Rank';
    if (inactive) row.classList.add('student-info-inactive-row'); row.append(nameCell, lastName, attendanceCell, typeCell, rank, beltCell, targetCell, promoteCell, confirmedCell, startDateCell, activeCell); appendDetail(row, student); targetList.appendChild(row);
  };
  activeStudents.forEach((student) => renderStudent(student, list));
  if (inactiveStudents.length) { inactiveSection.hidden = false; inactiveList.replaceChildren(); inactiveStudents.forEach((student) => renderStudent(student, inactiveList, true)); } else { inactiveSection.hidden = true; inactiveList.replaceChildren(); }
}
[typeFilter, nameSearch, rankFilter, attendanceFilter, statusFilter, promoteFilter].forEach((control) => control.addEventListener('input', () => { saveStudentInfoPreferences({ [control.id]: control.value }); render(); }));
inactiveToggle.addEventListener('click', () => { inactiveList.hidden = !inactiveList.hidden; inactiveToggle.textContent = `${inactiveList.hidden ? '>' : 'v'} Inactive`; });
document.querySelectorAll('.student-info-header [data-sort]').forEach((header) => header.addEventListener('click', () => { const nextField = header.dataset.sort; sortDirection = sortField === nextField ? -sortDirection : 1; sortField = nextField; render(); }));
document.getElementById('printStudents').addEventListener('click', () => window.print());
populateRanks();
[typeFilter, nameSearch, rankFilter, attendanceFilter, statusFilter, promoteFilter].forEach((control) => { if (savedStudentInfoPreferences[control.id] != null) control.value = savedStudentInfoPreferences[control.id]; });
render();
