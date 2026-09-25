import * as students from './adult-students.js?v=1';
import * as attendance from './adult-attendance.js?v=3';
import * as beltSizes from './adult-belt-sizes.js?v=1';
import * as waiverStore from './waiver-store.js?v=1';
import { syncFromCloud, syncLocalPromotions } from './promotion-cloud.js';

const RANKS = ['White', 'White 1', 'White 2', 'White 3', 'White 4', 'Blue', 'Blue 1', 'Blue 2', 'Blue 3', 'Blue 4', 'Purple', 'Purple 1', 'Purple 2', 'Purple 3', 'Purple 4', 'Brown', 'Brown 1', 'Brown 2', 'Brown 3', 'Brown 4', 'Black', 'Black 1', 'Black 2', 'Black 3', 'Black 4'];
const list = document.getElementById('adultPromoList');
const history = document.getElementById('adultPromotionHistory');
const filter = document.getElementById('adultRankFilter');
const promoKey = 'bjj_adult_promotions';
let sortField = 'name';
let sortDirection = 1;
const expandedStudents = new Set();
const loadPromotions = () => { try { const value = JSON.parse(localStorage.getItem(promoKey) || '[]'); return Array.isArray(value) ? value : []; } catch (e) { return []; } };
const savePromotions = (value) => { localStorage.setItem(promoKey, JSON.stringify(value)); void syncLocalPromotions('adult', value).catch((error) => console.error('Cloud adult promotion save failed', error)); };
function lastPromotion(studentId) { return loadPromotions().filter((promotion) => promotion.studentId === studentId).sort((a, b) => String(b.promotionDate || b.createdAt).localeCompare(String(a.promotionDate || a.createdAt)))[0]; }
function beltSelect(value) { const select = document.createElement('select'); select.className = 'belt-size'; select.appendChild(new Option('', '')); beltSizes.getBeltSizes().forEach((size) => { const option = new Option(size, size); option.selected = size === value; select.appendChild(option); }); return select; }
function rankIndex(rank) { const index = RANKS.indexOf(String(rank || 'White')); return index === -1 ? RANKS.length : index; }
function compareStudents(a, b) {
  if (sortField === 'current') return (rankIndex(a.rank) - rankIndex(b.rank)) * sortDirection;
  if (sortField === 'attendance') return (attendance.getTotalAttended(a.id) - attendance.getTotalAttended(b.id)) * sortDirection;
  if (sortField === 'belt') return (beltSizes.getBeltSizes().indexOf(a.beltSize || '') - beltSizes.getBeltSizes().indexOf(b.beltSize || '')) * sortDirection;
  return (a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)) * sortDirection;
}
function appendStudentNotes(detail, student) {
  const section = document.createElement('div'); section.className = 'student-notes-section';
  const title = document.createElement('strong'); title.textContent = 'Student Notes';
  const preview = document.createElement('div'); preview.className = 'promotion-notes-preview'; preview.innerHTML = student.notes || '<span class="muted">No student notes</span>';
  const edit = document.createElement('button'); edit.className = 'btn edit'; edit.textContent = 'Edit Notes';
  edit.addEventListener('click', () => {
    const editor = document.createElement('div'); editor.className = 'promotion-notes-editor'; editor.contentEditable = 'true'; editor.innerHTML = student.notes || '<p></p>';
    const toolbar = document.createElement('div'); toolbar.className = 'promotion-notes-toolbar'; [['bold','B'],['italic','I'],['underline','U'],['insertUnorderedList','Bullets'],['insertOrderedList','Numbered']].forEach(([command,label]) => { const button = document.createElement('button'); button.type='button'; button.className='btn'; button.textContent=label; button.addEventListener('mousedown',(event)=>event.preventDefault()); button.addEventListener('click',()=>{ editor.focus(); document.execCommand(command); }); toolbar.appendChild(button); });
    const format = document.createElement('select'); format.className='promotion-block-format'; format.append(new Option('Paragraph','p'),new Option('H3','h3')); format.addEventListener('change',()=>{ editor.focus(); document.execCommand('formatBlock',false,format.value); }); toolbar.appendChild(format);
    const save = document.createElement('button'); save.className='btn save'; save.textContent='Save Notes'; save.addEventListener('click',()=>{ students.setNotes(student.id, editor.innerHTML); expandedStudents.add(student.id); render(); });
    const cancel = document.createElement('button'); cancel.className='btn cancel'; cancel.textContent='Cancel'; cancel.addEventListener('click',()=>{ render(); });
    section.replaceChildren(title, toolbar, editor, save, cancel);
  });
  section.append(title, preview, edit); detail.appendChild(section);
}
function appendWaiverSummary(detail, student) {
  const waiver = waiverStore.getLatestWaiverForStudent('adult', student.id);
  const section = document.createElement('div'); section.className = 'student-notes-section';
  const title = document.createElement('strong'); title.textContent = 'Waiver';
  const summary = document.createElement('span'); summary.className = waiver ? 'promotion-status confirmed' : 'promotion-status unconfirmed';
  if (waiver) {
    const contact = waiver.contact || {};
    summary.textContent = `Signed ${String(waiver.signedAt || '').slice(0, 10)}`;
    const phone = document.createElement('span'); phone.className = 'waiver-contact-summary'; phone.textContent = `Phone: ${formatPhone(contact.phone)}`;
    const emergency = document.createElement('span'); emergency.className = 'waiver-contact-summary'; emergency.textContent = `Emergency: ${contact.emergencyName || '—'} · ${formatPhone(contact.emergencyPhone)}`;
    section.append(title, summary, phone, emergency);
  } else {
    summary.textContent = 'Not signed';
    section.append(title, summary);
  }
  const link = document.createElement('a'); link.className = 'btn'; link.href = `waiver.html?studentType=adult&studentId=${student.id}`; link.textContent = waiver ? 'View / Edit details' : 'Create waiver';
  section.append(link); detail.appendChild(section);
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value || '—';
}
function appendStudentHistory(row, student) {
  const records = loadPromotions().filter((promotion) => promotion.studentId === student.id).sort((a, b) => String(b.promotionDate || b.createdAt).localeCompare(String(a.promotionDate || a.createdAt)));
  const waiver = waiverStore.getLatestWaiverForStudent('adult', student.id);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'promotion-expand'; toggle.textContent = '>'; toggle.setAttribute('aria-label', `Show promotion history for ${student.firstName} ${student.lastName}`);
  const nameCell = row.querySelector('.name'); nameCell.prepend(toggle); toggle.addEventListener('click', (event) => { event.stopPropagation(); detail.hidden = !detail.hidden; if (detail.hidden) expandedStudents.delete(student.id); else expandedStudents.add(student.id); toggle.textContent = detail.hidden ? '>' : 'v'; });
  const detail = document.createElement('div'); detail.className = 'promotion-inline-history'; detail.hidden = true; detail.style.gridColumn = '1 / -1';
  if (expandedStudents.has(student.id)) { detail.hidden = false; toggle.textContent = 'v'; }
  const heading = document.createElement('strong'); heading.textContent = `Promotion history · ${records.length} record${records.length === 1 ? '' : 's'}`; if (records.length) detail.appendChild(heading);
  appendStudentNotes(detail, student);
  appendWaiverSummary(detail, student);
  records.forEach((promotion) => {
    const item = document.createElement('div'); item.className = 'promotion-inline-item';
    const text = document.createElement('span'); text.textContent = `${promotion.oldRank || 'White'} → ${promotion.newRank || 'Unknown'} · ${String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10)}${promotion.beltSize ? ` · ${promotion.beltSize}` : ''}`;
    const status = document.createElement('span'); status.className = `promotion-status ${promotion.confirmed ? 'confirmed' : 'unconfirmed'}`; status.textContent = promotion.confirmed ? 'Confirmed' : 'Unconfirmed';
    const edit = document.createElement('button'); edit.className = 'btn edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => {
      const oldInput = document.createElement('input'); oldInput.value = promotion.oldRank || 'White'; oldInput.setAttribute('aria-label', 'Old rank');
      const newSelect = document.createElement('select'); RANKS.forEach((rank) => newSelect.appendChild(new Option(rank, rank, false, rank === promotion.newRank)));
      const dateInput = document.createElement('input'); dateInput.type = 'date'; dateInput.value = String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10); dateInput.setAttribute('aria-label', 'Promotion date');
      const beltInput = beltSelect(promotion.beltSize); beltInput.setAttribute('aria-label', 'Belt size');
      const notes = document.createElement('div'); notes.className = 'promotion-notes-editor'; notes.contentEditable = 'true'; notes.innerHTML = promotion.notes || '<p></p>'; notes.setAttribute('aria-label', 'Promotion notes');
      const toolbar = document.createElement('div'); toolbar.className = 'promotion-notes-toolbar'; ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].forEach((command) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = command === 'bold' ? 'B' : command === 'italic' ? 'I' : command === 'underline' ? 'U' : command === 'insertUnorderedList' ? 'Bullets' : 'Numbered'; button.addEventListener('mousedown', (event) => event.preventDefault()); button.addEventListener('click', () => { notes.focus(); document.execCommand(command); }); toolbar.appendChild(button); });
      const block = document.createElement('select'); block.className = 'promotion-block-format'; ['p', 'h3'].forEach((tag) => block.appendChild(new Option(tag === 'p' ? 'Paragraph' : 'H3', tag))); block.addEventListener('change', () => { notes.focus(); document.execCommand('formatBlock', false, block.value); }); toolbar.appendChild(block);
      const save = document.createElement('button'); save.className = 'btn save'; save.textContent = 'Save Changes'; save.addEventListener('click', () => { const data = loadPromotions(); const itemData = data.find((item) => item.studentId === promotion.studentId && item.promotionDate === promotion.promotionDate); if (!itemData) return; itemData.oldRank = oldInput.value.trim() || itemData.oldRank; itemData.newRank = newSelect.value; itemData.beltSize = beltInput.value; itemData.notes = notes.innerHTML; if (dateInput.value) itemData.promotionDate = `${dateInput.value}T12:00:00.000Z`; savePromotions(data); expandedStudents.add(student.id); render(); });
      item.replaceChildren(oldInput, newSelect, dateInput, beltInput, toolbar, notes, save);
    });
    const confirm = document.createElement('button'); confirm.className = 'btn save'; confirm.textContent = promotion.confirmed ? 'Confirmed' : 'Confirm'; confirm.disabled = promotion.confirmed; confirm.addEventListener('click', () => { const data = loadPromotions(); const itemData = data.find((item) => item.studentId === promotion.studentId && item.promotionDate === promotion.promotionDate); if (itemData) { itemData.confirmed = true; savePromotions(data); render(); } });
    const remove = document.createElement('button'); remove.className = 'btn cancel'; remove.textContent = 'Delete'; remove.addEventListener('click', () => { savePromotions(loadPromotions().filter((item) => !(item.studentId === promotion.studentId && item.promotionDate === promotion.promotionDate))); expandedStudents.add(student.id); render(); });
    const notePreview = document.createElement('div'); notePreview.className = 'promotion-notes-preview'; notePreview.innerHTML = promotion.notes || '<span class="muted">No promotion notes</span>'; item.append(text, status, notePreview, edit, confirm, remove); detail.appendChild(item);
  });
  row.appendChild(detail);
}
function setSort(field) { sortDirection = sortField === field ? -sortDirection : 1; sortField = field; render(); updateSortIndicators(); }
function render() {
  list.innerHTML = '';
  students.getStudents().filter((student) => !filter.value || student.rank === filter.value).sort(compareStudents).forEach((student) => {
    const row = document.createElement('div'); row.className = 'promo-row';
    const name = document.createElement('div'); name.className = 'col name'; name.textContent = `${student.firstName} ${student.lastName}`;
    const current = document.createElement('div'); current.className = 'col current'; current.textContent = student.rank || 'White';
    const last = lastPromotion(student.id); const lastText = last ? `Last promoted: ${String(last.promotionDate || last.createdAt).slice(0, 10)}` : 'No promotion recorded';
    const stats = document.createElement('div'); stats.className = 'col stats'; stats.textContent = `${attendance.getTotalAttended(student.id)} attended; ${attendance.getRecentAttended(student.id)} in last 30 days; ${lastText}`;
    const breakdown = document.createElement('small'); breakdown.className = 'adult-class-breakdown'; const entries = Object.entries(attendance.getClassBreakdown(student.id)); breakdown.textContent = entries.length ? entries.map(([label, count]) => `${label}: ${count}`).join(' • ') : 'No class breakdown yet'; stats.appendChild(breakdown);
    const belt = beltSelect(student.beltSize); belt.addEventListener('change', () => students.setBeltSize(student.id, belt.value)); const beltWrap = document.createElement('div'); beltWrap.className = 'col belt'; beltWrap.appendChild(belt);
    const target = document.createElement('select'); target.className = 'col target'; target.appendChild(new Option('Select rank', '')); RANKS.forEach((rank) => target.appendChild(new Option(rank, rank))); const targetWrap = document.createElement('div'); targetWrap.className = 'col target'; targetWrap.appendChild(target);
    const stock = document.createElement('input'); stock.type = 'checkbox'; const stockWrap = document.createElement('div'); stockWrap.className = 'col stock'; stockWrap.appendChild(stock);
    const confirmed = document.createElement('input'); confirmed.type = 'checkbox'; const confirmedWrap = document.createElement('div'); confirmedWrap.className = 'col confirmed'; confirmedWrap.appendChild(confirmed);
    confirmed.addEventListener('change', () => { if (!confirmed.checked) return; if (!target.value) { confirmed.checked = false; return alert('Choose a target rank before confirming'); } const promotions = loadPromotions(); promotions.push({ studentId: student.id, oldRank: student.rank || 'White', newRank: target.value, beltSize: belt.value, inStock: stock.checked, confirmed: true, promotionDate: new Date().toISOString(), notes: '' }); savePromotions(promotions); students.setRank(student.id, target.value); render(); });
    const actionWrap = document.createElement('div'); actionWrap.className = 'col action'; actionWrap.textContent = 'Check Confirmed to Apply';
    [[name, 'Name'], [current, 'Current Rank'], [stats, 'Attendance'], [beltWrap, 'Belt Size'], [targetWrap, 'Target Rank'], [stockWrap, 'In Stock'], [confirmedWrap, 'Confirmed'], [actionWrap, 'Action']].forEach(([element, label]) => { element.dataset.label = label; row.appendChild(element); }); list.appendChild(row);
    appendStudentHistory(row, student);
    const color = rankColor(target.value || student.rank);
    if (color) { row.style.backgroundImage = color.gradient; row.style.backgroundColor = color.background; }
    target.addEventListener('change', () => { const selectedColor = rankColor(target.value || student.rank); row.style.backgroundImage = selectedColor ? selectedColor.gradient : ''; row.style.backgroundColor = selectedColor ? selectedColor.background : ''; });
  });
  renderHistory();
}
function renderHistory() {
  if (!history) return;
  history.innerHTML = '';
  const groups = new Map();
  loadPromotions().sort((a, b) => String(b.promotionDate || b.createdAt).localeCompare(String(a.promotionDate || a.createdAt))).forEach((promotion) => {
    if (!groups.has(promotion.studentId)) groups.set(promotion.studentId, []);
    groups.get(promotion.studentId).push(promotion);
  });
  groups.forEach((promotions, studentId) => {
    const student = students.getStudentById(studentId); const group = document.createElement('section'); group.className = 'promotion-student-group';
    const groupTitle = document.createElement('h3'); groupTitle.textContent = `${student ? `${student.firstName} ${student.lastName}` : 'Unknown adult'} · ${promotions.length} promotion${promotions.length === 1 ? '' : 's'}`; group.appendChild(groupTitle);
    promotions.forEach((promotion) => {
      const card = document.createElement('article'); card.className = 'promotion-history-item';
      const summary = document.createElement('div'); summary.className = 'promotion-history-summary';
      const details = document.createElement('span'); details.textContent = `${promotion.oldRank || 'White'} → ${promotion.newRank || 'Unknown'} · ${String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10)}${promotion.beltSize ? ` · ${promotion.beltSize}` : ''}`;
      const badge = document.createElement('span'); badge.className = `promotion-status ${promotion.confirmed ? 'confirmed' : 'unconfirmed'}`; badge.textContent = promotion.confirmed ? 'Confirmed' : 'Unconfirmed';
      const actions = document.createElement('div'); actions.className = 'promotion-history-actions';
    const editor = document.createElement('div'); editor.className = 'promotion-history-editor'; editor.hidden = true;
    const oldRank = document.createElement('input'); oldRank.value = promotion.oldRank || 'White'; oldRank.setAttribute('aria-label', 'Old rank'); oldRank.placeholder = 'Old rank';
    const newRank = document.createElement('select'); newRank.setAttribute('aria-label', 'New rank'); RANKS.forEach((rank) => newRank.appendChild(new Option(rank, rank, false, rank === promotion.newRank)));
    const date = document.createElement('input'); date.type = 'date'; date.value = String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10); date.setAttribute('aria-label', 'Promotion date');
    const belt = document.createElement('select'); belt.setAttribute('aria-label', 'Belt size'); belt.appendChild(new Option('', '')); beltSizes.getBeltSizes().forEach((size) => belt.appendChild(new Option(size, size, false, size === promotion.beltSize)));
    const confirmed = document.createElement('input'); confirmed.type = 'checkbox'; confirmed.checked = Boolean(promotion.confirmed); const confirmedLabel = document.createElement('label'); confirmedLabel.append(confirmed, document.createTextNode(' Confirmed'));
    const matches = (item) => item.studentId === promotion.studentId && item.promotionDate === promotion.promotionDate && item.createdAt === promotion.createdAt;
    const edit = document.createElement('button'); edit.className = 'btn edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => { editor.hidden = !editor.hidden; });
    const confirmButton = document.createElement('button'); confirmButton.className = 'btn save'; confirmButton.textContent = promotion.confirmed ? 'Confirmed' : 'Confirm'; confirmButton.addEventListener('click', () => { const promotions = loadPromotions(); const item = promotions.find(matches); if (!item) return; item.confirmed = true; savePromotions(promotions); render(); });
    const save = document.createElement('button'); save.className = 'btn save'; save.textContent = 'Save Changes'; save.addEventListener('click', () => { const promotions = loadPromotions(); const item = promotions.find(matches); if (!item) return; item.oldRank = oldRank.value.trim() || item.oldRank; item.newRank = newRank.value; item.beltSize = belt.value; item.promotionDate = date.value ? `${date.value}T12:00:00.000Z` : item.promotionDate; item.confirmed = confirmed.checked; savePromotions(promotions); render(); });
    const cancel = document.createElement('button'); cancel.className = 'btn cancel'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => { editor.hidden = true; });
    const remove = document.createElement('button'); remove.className = 'btn cancel'; remove.textContent = 'Delete'; remove.addEventListener('click', () => { savePromotions(loadPromotions().filter((item) => !matches(item))); render(); });
      summary.append(details, badge); actions.append(edit); if (!promotion.confirmed) actions.append(confirmButton); actions.append(remove); editor.append(oldRank, newRank, date, belt, confirmedLabel, save, cancel); card.append(summary, actions, editor); group.appendChild(card);
    });
    history.appendChild(group);
  });
}
function rankColor(rank) {
  const value = String(rank || '').toLowerCase();
  if (value.includes('blue')) return { gradient: 'linear-gradient(90deg, rgba(59,130,246,0.08), transparent)', background: 'rgba(59,130,246,0.04)' };
  if (value.includes('purple')) return { gradient: 'linear-gradient(90deg, rgba(168,85,247,0.08), transparent)', background: 'rgba(168,85,247,0.04)' };
  if (value.includes('brown')) return { gradient: 'linear-gradient(90deg, rgba(146,64,14,0.10), transparent)', background: 'rgba(146,64,14,0.05)' };
  if (value.includes('black')) return { gradient: 'linear-gradient(90deg, rgba(17,24,39,0.14), transparent)', background: 'rgba(17,24,39,0.07)' };
  return { gradient: 'linear-gradient(90deg, rgba(255,255,255,0.03), transparent)', background: 'rgba(255,255,255,0.01)' };
}
function updateSortIndicators() {
  const header = document.querySelector('.promo-row.header');
  if (!header) return;
  ['name', 'current', 'attendance', 'belt'].forEach((field) => {
    const column = header.querySelector(`.col.${field === 'attendance' ? 'stats' : field}`);
    if (!column) return;
    let indicator = column.querySelector('.sort-indicator');
    if (!indicator) { indicator = document.createElement('span'); indicator.className = 'sort-indicator'; column.appendChild(indicator); }
    indicator.textContent = sortField === field ? (sortDirection === 1 ? '▲' : '▼') : '';
  });
}
RANKS.forEach((rank) => filter.appendChild(new Option(rank, rank)));
filter.addEventListener('change', render);
const header = document.querySelector('.promo-row.header');
if (header) {
  header.querySelector('.col.name')?.addEventListener('click', () => setSort('name'));
  header.querySelector('.col.current')?.addEventListener('click', () => setSort('current'));
  header.querySelector('.col.stats')?.addEventListener('click', () => setSort('attendance'));
  header.querySelector('.col.belt')?.addEventListener('click', () => setSort('belt'));
  header.querySelectorAll('.col.name, .col.current, .col.stats, .col.belt').forEach((column) => { column.style.cursor = 'pointer'; });
}
document.getElementById('adultPrintBtn').addEventListener('click', () => window.print());
document.getElementById('adultExportJson').addEventListener('click', () => { const blob = new Blob([JSON.stringify(loadPromotions(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'adult-promotions.json'; link.click(); URL.revokeObjectURL(url); });
document.getElementById('adultExportCsv').addEventListener('click', () => { const rows = [['studentId', 'oldRank', 'newRank', 'beltSize', 'inStock', 'promotionDate'], ...loadPromotions().map((item) => [item.studentId, item.oldRank, item.newRank, item.beltSize, item.inStock, item.promotionDate])]; const blob = new Blob([rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'adult-promotions.csv'; link.click(); URL.revokeObjectURL(url); });
function attachPromotionNotesEditor(item, studentId, promotionDate) {
  if (item.querySelector('.promotion-notes-editor')) return;
  const notes = document.createElement('div'); notes.className = 'promotion-notes-editor'; notes.contentEditable = 'true'; notes.innerHTML = '';
  const toolbar = document.createElement('div'); toolbar.className = 'promotion-notes-toolbar';
  [['bold', 'B'], ['italic', 'I'], ['underline', 'U'], ['insertUnorderedList', 'Bullets'], ['insertOrderedList', 'Numbered']].forEach(([command, label]) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'btn'; button.textContent = label; button.addEventListener('mousedown', (event) => event.preventDefault()); button.addEventListener('click', () => { notes.focus(); document.execCommand(command); }); toolbar.appendChild(button); });
  const format = document.createElement('select'); format.className = 'promotion-block-format'; format.append(new Option('Paragraph', 'p'), new Option('H3', 'h3')); format.addEventListener('change', () => { notes.focus(); document.execCommand('formatBlock', false, format.value); }); toolbar.appendChild(format);
  const data = loadPromotions().find((record) => record.studentId === studentId && record.promotionDate === promotionDate); notes.innerHTML = data?.notes || '<p></p>';
  const save = item.querySelector('.btn.save'); if (save) save.addEventListener('click', () => { const records = loadPromotions(); const record = records.find((entry) => entry.studentId === studentId && entry.promotionDate === promotionDate); if (record) { record.notes = notes.innerHTML; savePromotions(records); } });
  item.append(toolbar, notes);
}

document.addEventListener('click', (event) => {
  const edit = event.target.closest('.promotion-inline-item .btn.edit');
  if (!edit) return;
  setTimeout(() => { const item = edit.closest('.promotion-inline-item'); const row = edit.closest('.promo-row'); const name = row?.querySelector('.name')?.textContent.replace(/^>\s*/, '').trim(); const student = students.getStudents().find((entry) => `${entry.firstName} ${entry.lastName}` === name); const date = item?.querySelector('input[type="date"]')?.value; if (item && student && date) attachPromotionNotesEditor(item, student.id, `${date}T12:00:00.000Z`); }, 0);
});

await syncFromCloud('adult', promoKey);
render();
updateSortIndicators();
