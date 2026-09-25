import * as students from './students.js?v=3';
import * as attendance from './attendance.js?v=5';
import * as beltSizes from './belt-sizes.js?v=1';
import * as waiverStore from './waiver-store.js?v=1';
import { syncFromCloud, syncLocalPromotions } from './promotion-cloud.js';

const RANKS = [
  'White', 'White 1', 'White 2', 'White 3', 'White 4',
  'Grey/White', 'Grey/White 1','Grey/White 2','Grey/White 3','Grey/White 4',
  'Grey','Grey 1','Grey 2','Grey 3','Grey 4',
  'Grey/Black','Grey/Black 1','Grey/Black 2','Grey/Black 3','Grey/Black 4',
  'Yellow/White','Yellow/White 1','Yellow/White 2','Yellow/White 3','Yellow/White 4',
  'Yellow','Yellow 1','Yellow 2','Yellow 3','Yellow 4',
  'Yellow/Black','Yellow/Black 1','Yellow/Black 2','Yellow/Black 3','Yellow/Black 4',
  'Orange/White','Orange/White 1','Orange/White 2','Orange/White 3','Orange/White 4',
  'Orange','Orange 1','Orange 2','Orange 3','Orange 4',
  'Orange/Black','Orange/Black 1','Orange/Black 2','Orange/Black 3','Orange/Black 4',
  'Green/White','Green/White 1','Green/White 2','Green/White 3','Green/White 4',
  'Green','Green 1','Green 2','Green 3','Green 4',
  'Green/Black','Green/Black 1','Green/Black 2','Green/Black 3','Green/Black 4'
];

const promoList = document.getElementById('promoList');
const rankFilter = document.getElementById('rankFilter');
const exportJsonBtn = document.getElementById('exportJson');
const exportCsvBtn = document.getElementById('exportCsv');
const printBtn = document.getElementById('printBtn');
const promotionHistory = document.getElementById('promotionHistory');

const promoMobileMql = window.matchMedia('(max-width: 640px)');

function syncPromoResponsiveMode() {
  document.body.classList.toggle('promo-mobile', promoMobileMql.matches);
}

if (typeof promoMobileMql.addEventListener === 'function') {
  promoMobileMql.addEventListener('change', syncPromoResponsiveMode);
} else if (typeof promoMobileMql.addListener === 'function') {
  promoMobileMql.addListener(syncPromoResponsiveMode);
}

syncPromoResponsiveMode();

const PROMO_KEY = 'bjj_promotions';
const PROMO_GRID_COLS = 'minmax(150px, 1.1fr) minmax(110px,.8fr) minmax(190px,1.3fr) minmax(70px,.5fr) minmax(160px,1.1fr) minmax(60px,.45fr) minmax(70px,.5fr) minmax(150px,1fr)';

// Prevent browser from restoring horizontal scroll position
try{ if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; }catch(e){}
try{ document.documentElement.style.overflowX = 'hidden'; document.body.style.overflowX = 'hidden'; }catch(e){}
window.addEventListener('pageshow', ()=>{ try{ window.scrollTo(0,0); }catch(e){} });

function loadPromotions(){
  try{ return JSON.parse(localStorage.getItem(PROMO_KEY)) || []; }catch(e){return []}
}
function savePromotions(list){ localStorage.setItem(PROMO_KEY, JSON.stringify(list)); void syncLocalPromotions('kids', list).catch((error) => console.error('Cloud kids promotion save failed', error)); }
function addPromotion(rec){ const list = loadPromotions(); list.push(rec); savePromotions(list); }

function populateRankFilter(){
  RANKS.forEach(r => {
    const opt = document.createElement('option'); opt.value = r; opt.textContent = r; rankFilter.appendChild(opt);
  });
}

function enforceGridLayout(){
  if (promoMobileMql.matches) return;
  const hdr = document.querySelector('.promo-row.header');
  if (hdr) {
    hdr.style.display = 'grid';
    hdr.style.gridTemplateColumns = PROMO_GRID_COLS;
    hdr.style.boxSizing = 'border-box';
    // ensure header contrast in case CSS rules are overridden
    hdr.style.background = 'linear-gradient(90deg,var(--brand-bg), #071026)';
    hdr.style.color = getComputedStyle(document.documentElement).getPropertyValue('--text') || '#e6eef8';
  }
  const rows = document.querySelectorAll('.promo-row');
  rows.forEach(r => {
    // remove any leftover complete checkbox from older renders inside each row
    const stray = r.querySelectorAll('.col.complete');
    stray.forEach(s => s.remove());
    r.style.display = 'grid';
    r.style.gridTemplateColumns = PROMO_GRID_COLS;
    r.style.boxSizing = 'border-box';
  });
}

// Sorting state for promotions list
let promoSortField = 'attendance'; // name, current, attendance, belt
let promoSortDir = -1;
const expandedStudents = new Set();
function appendStudentNotes(detail, student) {
  const section = document.createElement('div'); section.className = 'student-notes-section'; const title = document.createElement('strong'); title.textContent = 'Student Notes'; const preview = document.createElement('div'); preview.className = 'promotion-notes-preview'; preview.innerHTML = student.notes || '<span class="muted">No student notes</span>'; const edit = document.createElement('button'); edit.className = 'btn edit'; edit.textContent = 'Edit Notes';
  edit.addEventListener('click', () => { const editor = document.createElement('div'); editor.className = 'promotion-notes-editor'; editor.contentEditable = 'true'; editor.innerHTML = student.notes || '<p></p>'; const toolbar = document.createElement('div'); toolbar.className = 'promotion-notes-toolbar'; [['bold','B'],['italic','I'],['underline','U'],['insertUnorderedList','Bullets'],['insertOrderedList','Numbered']].forEach(([command,label]) => { const button=document.createElement('button'); button.type='button'; button.className='btn'; button.textContent=label; button.addEventListener('mousedown',(event)=>event.preventDefault()); button.addEventListener('click',()=>{ editor.focus(); document.execCommand(command); }); toolbar.appendChild(button); }); const format=document.createElement('select'); format.className='promotion-block-format'; format.append(new Option('Paragraph','p'),new Option('H3','h3')); format.addEventListener('change',()=>{ editor.focus(); document.execCommand('formatBlock',false,format.value); }); toolbar.appendChild(format); const save=document.createElement('button'); save.className='btn save'; save.textContent='Save Notes'; save.addEventListener('click',()=>{ students.setNotes(student.id,editor.innerHTML); expandedStudents.add(student.id); render(); }); const cancel=document.createElement('button'); cancel.className='btn cancel'; cancel.textContent='Cancel'; cancel.addEventListener('click',()=>render()); section.replaceChildren(title,toolbar,editor,save,cancel); });
  section.append(title, preview, edit); detail.appendChild(section);
}
function appendWaiverSummary(detail, student) {
  const waiver = waiverStore.getLatestWaiverForStudent('kids', student.id);
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
  const link = document.createElement('a'); link.className = 'btn'; link.href = `waiver.html?studentType=kids&studentId=${student.id}`; link.textContent = waiver ? 'View / Edit details' : 'Create waiver';
  section.append(link); detail.appendChild(section);
}

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return value || '—';
}
function setPromoSort(field){
  if (promoSortField === field) promoSortDir = -promoSortDir; else { promoSortField = field; promoSortDir = 1; }
  render();
  updatePromoHeaderIndicators();
}

function ensureTargetsFull(){
  const filterElem = document.getElementById('rankFilter');
  if (!filterElem) return;
  const template = Array.from(filterElem.options).map(o => ({v:o.value,t:o.textContent})).filter(x=>x.v);
  document.querySelectorAll('.promo-row').forEach(r=>{
    const sel = r.querySelector('select.col.target');
    if (!sel) return;
    // if already complete, skip
    if (sel.options.length >= template.length) return;
    const cur = sel.value;
    sel.innerHTML = '';
    const empty = document.createElement('option'); empty.value=''; empty.textContent='Select rank'; sel.appendChild(empty);
    template.forEach(o=>{ const opt = document.createElement('option'); opt.value = o.v; opt.textContent = o.t; sel.appendChild(opt); });
    sel.value = cur || '';
  });
}

function makeBeltSizeSelect(value){
  const sel = document.createElement('select');
  sel.className = 'belt-size';
  const options = beltSizes.getBeltSizes();
  const empty = document.createElement('option'); empty.value=''; empty.textContent=''; sel.appendChild(empty);
  options.forEach(s => {
    // derive short code (e.g., 'Y0' from 'Y0 / 000 / ...')
    const codeMatch = String(s).trim().match(/^(Y\d+)/i);
    const code = codeMatch ? codeMatch[1] : (String(s).split(' ')[0] || s);
    const o = document.createElement('option');
    o.value = s; // store full label in value for export
    o.textContent = code; // show short code in collapsed select
    o.title = s; // full label on hover
    if (s === value) o.selected = true;
    sel.appendChild(o);
  });
  if (value && !options.includes(value)) {
    const custom = document.createElement('option');
    custom.value = value;
    custom.textContent = 'Custom';
    custom.title = value;
    custom.selected = true;
    sel.appendChild(custom);
  }
  // set select title to selected full label
  sel.addEventListener('change', () => {
    const opt = sel.options[sel.selectedIndex];
    sel.title = opt ? opt.title : '';
  });
  return sel;
}

function render(){
  promoList.innerHTML = '';
  const filter = rankFilter.value;
  const studentsList = students.getStudents().slice();

  // sort according to state
  studentsList.sort((a,b)=>{
    if (promoSortField === 'name') return (a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName)) * promoSortDir;
    if (promoSortField === 'current') {
      const ia = RANKS.indexOf((a.rank||'').toString())
      const ib = RANKS.indexOf((b.rank||'').toString())
      const na = ia === -1 ? Number.POSITIVE_INFINITY : ia;
      const nb = ib === -1 ? Number.POSITIVE_INFINITY : ib;
      if (na === nb) return (String(a.rank||'').localeCompare(String(b.rank||''))) * promoSortDir;
      return (na - nb) * promoSortDir;
    }
    if (promoSortField === 'attendance') {
      const pa = attendance.getLastAttended(a.id) || ''; const pb = attendance.getLastAttended(b.id) || '';
      if (pa === pb) return a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName);
      return pa.localeCompare(pb) * promoSortDir;
    }
    if (promoSortField === 'belt') {
      const options = beltSizes.getBeltSizes();
      const ia = options.indexOf((a.beltSize||'').toString());
      const ib = options.indexOf((b.beltSize||'').toString());
      const na = ia === -1 ? Number.POSITIVE_INFINITY : ia;
      const nb = ib === -1 ? Number.POSITIVE_INFINITY : ib;
      if (na === nb) return (String(a.beltSize||'').localeCompare(String(b.beltSize||''))) * promoSortDir;
      return (na - nb) * promoSortDir;
    }
    return (a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)) * promoSortDir;
  });

  studentsList.forEach(s => {
    if (filter && s.rank !== filter) return;
    const row = document.createElement('div'); row.className = 'promo-row';

    const name = document.createElement('div'); name.className='col name'; name.textContent = `${s.firstName} ${s.lastName}`;
    const curr = document.createElement('div'); curr.className='col current'; curr.textContent = s.rank || 'White';

    const attended = attendance.getTotalAttended(s.id);
    const total = attendance.getTotalClasses(s.id);
    const pct = attendance.getPercent(s.id);
    const stats = document.createElement('div'); stats.className='col stats'; stats.textContent = `${attended}/${total} (${pct}%)`;

    const beltSel = makeBeltSizeSelect(s.beltSize);
    beltSel.addEventListener('change', ()=> { students.setBeltSize(s.id, beltSel.value); });
    // show only short code in the collapsed select and keep it narrow
    beltSel.style.width = '64px';
    beltSel.style.maxWidth = '64px';
    const beltWrap = document.createElement('div'); beltWrap.className='col belt'; beltWrap.appendChild(beltSel);

    // target rank selector: show all ranks (allow corrections to lower ranks)
    const target = document.createElement('select'); target.className='col target';
    const defaultOpt = document.createElement('option'); defaultOpt.value=''; defaultOpt.textContent='Select rank'; target.appendChild(defaultOpt);
    // clone options from the header rankFilter to ensure consistent ordering
    const filterElem = document.getElementById('rankFilter');
    if (filterElem) {
      Array.from(filterElem.options).forEach(opt => {
        if (!opt.value) return; // skip empty
        const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.textContent; target.appendChild(o);
      });
    } else {
      // fallback to RANKS array
      RANKS.forEach(rk => { const o = document.createElement('option'); o.value = rk; o.textContent = rk; target.appendChild(o); });
    }
    // restore previously selected target for this student, if any
    const savedKey = `bjj_promo_target_${s.id}`;
    const saved = localStorage.getItem(savedKey);
    if (saved) target.value = saved;
    target.addEventListener('change', () => {
      localStorage.setItem(savedKey, target.value);
      // update row tint immediately
      const hr = (target.value||'').trim() || (curr.textContent||'').trim();
      const c = getBeltColor(hr);
      if (c) { if (c.grad) row.style.backgroundImage = c.grad; if (c.base) row.style.backgroundColor = c.base; }
      else { row.style.backgroundImage = ''; row.style.backgroundColor = ''; }
    });

    const inStock = document.createElement('input'); inStock.type='checkbox'; inStock.className='col stock';
    const confirmed = document.createElement('input'); confirmed.type='checkbox'; confirmed.className='col confirmed';
    confirmed.addEventListener('change', () => { if (!confirmed.checked) return; const newRank = target.value; if (!newRank) { confirmed.checked = false; return alert('Choose a target rank before confirming'); } addPromotion({ studentId: s.id, oldRank: s.rank || 'White', newRank, beltSize: beltSel.value || '', inStock: !!inStock.checked, notes: '', createdAt: new Date().toISOString(), promotionDate: new Date().toISOString(), confirmed: true }); students.setRank(s.id, newRank); localStorage.removeItem(savedKey); render(); });

    row.appendChild(name);
    row.appendChild(curr);
    row.appendChild(stats);
    row.appendChild(beltWrap);
    const targetWrap = document.createElement('div'); targetWrap.className = 'col target'; targetWrap.appendChild(target);
    row.appendChild(targetWrap);
    const stockWrap = document.createElement('div'); stockWrap.className = 'col stock'; stockWrap.appendChild(inStock);
    row.appendChild(stockWrap);
    const confirmedWrap = document.createElement('div'); confirmedWrap.className = 'col confirmed'; confirmedWrap.appendChild(confirmed);
    const actionWrap = document.createElement('div'); actionWrap.className = 'col action'; actionWrap.textContent = 'Check Confirmed to Apply';
    row.appendChild(confirmedWrap);
    row.appendChild(actionWrap);

    name.dataset.label = 'Name';
    curr.dataset.label = 'Current Rank';
    stats.dataset.label = 'Attendance';
    beltWrap.dataset.label = 'Belt Size';
    targetWrap.dataset.label = 'Target Rank';
    stockWrap.dataset.label = 'In Stock';
    confirmedWrap.dataset.label = 'Confirmed';
    actionWrap.dataset.label = 'Action';

    // remove any leftover complete checkbox from older renders
    const stray = row.querySelector('.col.complete'); if (stray) stray.remove();
    appendStudentHistory(row, s);
    promoList.appendChild(row);
    // ensure this row uses the grid layout on desktop even if CSS is overridden
    if (!promoMobileMql.matches) {
      row.style.display = 'grid';
      row.style.gridTemplateColumns = PROMO_GRID_COLS;
    } else {
      row.style.display = 'flex';
      row.style.flexDirection = 'column';
      row.style.alignItems = 'stretch';
      row.style.gap = '0';
    }

    // highlight row subtly based on selected target or current rank
    const highlightRank = (target.value || '').trim() || (curr.textContent || '').trim();
    try{ row.dataset._rank = highlightRank; }catch(e){}
    const color = getBeltColor(highlightRank);
    if (color) {
      if (color.grad) row.style.backgroundImage = color.grad;
      if (color.base) row.style.backgroundColor = color.base;
      try{ row.dataset._tint = JSON.stringify(color); }catch(e){}
    }
  });
  renderPromotionHistory();
}
function appendStudentHistory(row, student) {
  const records = loadPromotions().filter((promotion) => promotion.studentId === student.id).sort((a, b) => String(b.promotionDate || b.createdAt).localeCompare(String(a.promotionDate || a.createdAt)));
  const waiver = waiverStore.getLatestWaiverForStudent('kids', student.id);
  const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'promotion-expand'; toggle.textContent = '>'; const nameCell = row.querySelector('.name'); nameCell.prepend(toggle);
  const detail = document.createElement('div'); detail.className = 'promotion-inline-history'; detail.hidden = true; detail.style.gridColumn = '1 / -1'; const heading = document.createElement('strong'); heading.textContent = `Promotion history · ${records.length} record${records.length === 1 ? '' : 's'}`; if (records.length) detail.appendChild(heading);
  toggle.addEventListener('click', (event) => { event.stopPropagation(); detail.hidden = !detail.hidden; if (detail.hidden) expandedStudents.delete(student.id); else expandedStudents.add(student.id); toggle.textContent = detail.hidden ? '>' : 'v'; });
  if (expandedStudents.has(student.id)) { detail.hidden = false; toggle.textContent = 'v'; }
  appendStudentNotes(detail, student);
  appendWaiverSummary(detail, student);
    records.forEach((promotion) => { const item = document.createElement('div'); item.className = 'promotion-inline-item'; const text = document.createElement('span'); text.textContent = `${promotion.oldRank || 'White'} → ${promotion.newRank || 'Unknown'} · ${String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10)}`; const status = document.createElement('span'); status.className = `promotion-status ${promotion.confirmed ? 'confirmed' : 'unconfirmed'}`; status.textContent = promotion.confirmed ? 'Confirmed' : 'Unconfirmed'; const edit = document.createElement('button'); edit.className = 'btn edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => { const oldInput = document.createElement('input'); oldInput.value = promotion.oldRank || 'White'; const newSelect = document.createElement('select'); RANKS.forEach((rank) => newSelect.appendChild(new Option(rank, rank, false, rank === promotion.newRank))); const dateInput = document.createElement('input'); dateInput.type = 'date'; dateInput.value = String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10); const save = document.createElement('button'); save.className = 'btn save'; save.textContent = 'Save'; save.addEventListener('click', () => { const data = loadPromotions(); const target = data.find((record) => record.studentId === promotion.studentId && record.promotionDate === promotion.promotionDate); if (!target) return; target.oldRank = oldInput.value.trim() || target.oldRank; target.newRank = newSelect.value; if (dateInput.value) target.promotionDate = `${dateInput.value}T12:00:00.000Z`; savePromotions(data); render(); }); item.replaceChildren(oldInput, newSelect, dateInput, save); }); const confirm = document.createElement('button'); confirm.className = 'btn save'; confirm.textContent = promotion.confirmed ? 'Confirmed' : 'Confirm'; confirm.disabled = promotion.confirmed; confirm.addEventListener('click', () => { const data = loadPromotions(); const target = data.find((record) => record.studentId === promotion.studentId && record.promotionDate === promotion.promotionDate); if (target) { target.confirmed = true; savePromotions(data); render(); } }); const remove = document.createElement('button'); remove.className = 'btn cancel'; remove.textContent = 'Delete'; remove.addEventListener('click', () => { savePromotions(loadPromotions().filter((record) => !(record.studentId === promotion.studentId && record.promotionDate === promotion.promotionDate))); render(); }); const notePreview = document.createElement('div'); notePreview.className = 'promotion-notes-preview'; notePreview.innerHTML = promotion.notes || '<span class="muted">No promotion notes</span>'; item.append(text, status, notePreview, edit, confirm, remove); detail.appendChild(item); });
  row.appendChild(detail);
}

function renderPromotionHistory() {
  if (!promotionHistory) return;
  promotionHistory.innerHTML = '';
  const groups = new Map();
  loadPromotions().sort((a, b) => String(b.promotionDate || b.createdAt).localeCompare(String(a.promotionDate || a.createdAt))).forEach((promotion) => {
    if (!groups.has(promotion.studentId)) groups.set(promotion.studentId, []);
    groups.get(promotion.studentId).push(promotion);
  });
  groups.forEach((promotions, studentId) => {
    const student = students.getStudentById(studentId); const group = document.createElement('section'); group.className = 'promotion-student-group';
    const groupTitle = document.createElement('h3'); groupTitle.textContent = `${student ? `${student.firstName} ${student.lastName}` : 'Unknown student'} · ${promotions.length} promotion${promotions.length === 1 ? '' : 's'}`; group.appendChild(groupTitle);
    promotions.forEach((promotion) => {
      const card = document.createElement('article'); card.className = 'promotion-history-item';
      const summary = document.createElement('div'); summary.className = 'promotion-history-summary';
      const details = document.createElement('span'); details.textContent = `${promotion.oldRank || 'White'} → ${promotion.newRank || 'Unknown'} · ${String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10)}${promotion.beltSize ? ` · ${promotion.beltSize}` : ''}`;
      const badge = document.createElement('span'); badge.className = `promotion-status ${promotion.confirmed ? 'confirmed' : 'unconfirmed'}`; badge.textContent = promotion.confirmed ? 'Confirmed' : 'Unconfirmed';
      const actions = document.createElement('div'); actions.className = 'promotion-history-actions';
    const editor = document.createElement('div'); editor.className = 'promotion-history-editor'; editor.hidden = true;
    const oldRank = document.createElement('input'); oldRank.value = promotion.oldRank || 'White'; oldRank.setAttribute('aria-label', 'Old rank');
    const nextRank = document.createElement('select'); nextRank.setAttribute('aria-label', 'New rank'); RANKS.forEach((rank) => nextRank.appendChild(new Option(rank, rank, false, rank === promotion.newRank)));
    const date = document.createElement('input'); date.type = 'date'; date.value = String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10); date.setAttribute('aria-label', 'Promotion date');
    const confirmed = document.createElement('input'); confirmed.type = 'checkbox'; confirmed.checked = Boolean(promotion.confirmed); const confirmedLabel = document.createElement('label'); confirmedLabel.append(confirmed, document.createTextNode(' Confirmed'));
    const matches = (item) => item.studentId === promotion.studentId && item.promotionDate === promotion.promotionDate && item.createdAt === promotion.createdAt;
    const edit = document.createElement('button'); edit.className = 'btn edit'; edit.textContent = 'Edit'; edit.addEventListener('click', () => { editor.hidden = !editor.hidden; });
    const confirmButton = document.createElement('button'); confirmButton.className = 'btn save'; confirmButton.textContent = promotion.confirmed ? 'Confirmed' : 'Confirm'; confirmButton.addEventListener('click', () => { const data = loadPromotions(); const item = data.find(matches); if (!item) return; item.confirmed = true; savePromotions(data); render(); });
    const save = document.createElement('button'); save.className = 'btn save'; save.textContent = 'Save Changes'; save.addEventListener('click', () => { const data = loadPromotions(); const item = data.find(matches); if (!item) return; item.oldRank = oldRank.value.trim() || item.oldRank; item.newRank = nextRank.value; item.promotionDate = date.value ? `${date.value}T12:00:00.000Z` : item.promotionDate; item.confirmed = confirmed.checked; savePromotions(data); render(); });
    const cancel = document.createElement('button'); cancel.className = 'btn cancel'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => { editor.hidden = true; });
    const remove = document.createElement('button'); remove.className = 'btn cancel'; remove.textContent = 'Delete'; remove.addEventListener('click', () => { savePromotions(loadPromotions().filter((item) => !matches(item))); render(); });
      summary.append(details, badge); actions.append(edit); if (!promotion.confirmed) actions.append(confirmButton); actions.append(remove); editor.append(oldRank, nextRank, date, confirmedLabel, save, cancel); card.append(summary, actions, editor); group.appendChild(card);
    });
    promotionHistory.appendChild(group);
  });
}

function getBeltColor(rank){
  if (!rank) return '';
  const r = String(rank).toLowerCase();
  if (r.includes('yellow')) return {grad:'linear-gradient(90deg, rgba(250,204,21,0.06), transparent)', base:'rgba(250,204,21,0.04)'};
  if (r.includes('orange')) return {grad:'linear-gradient(90deg, rgba(249,115,22,0.06), transparent)', base:'rgba(249,115,22,0.04)'};
  if (r.includes('green')) return {grad:'linear-gradient(90deg, rgba(34,197,94,0.06), transparent)', base:'rgba(34,197,94,0.03)'};
  if (r.includes('grey')) return {grad:'linear-gradient(90deg, rgba(107,114,128,0.06), transparent)', base:'rgba(107,114,128,0.03)'};
  if (r.includes('white')) return {grad:'linear-gradient(90deg, rgba(255,255,255,0.02), transparent)', base:'rgba(255,255,255,0.01)'};
  return '';
}

// attach header click handlers to allow sorting
function attachPromoHeaderSorting(){
  const hdr = document.querySelector('.promo-row.header');
  if (!hdr) return;
  const nameCol = hdr.querySelector('.col.name');
  const currCol = hdr.querySelector('.col.current');
  const statsCol = hdr.querySelector('.col.stats');
  const beltCol = hdr.querySelector('.col.belt');
  if (nameCol) { nameCol.style.cursor = 'pointer'; nameCol.addEventListener('click', ()=> setPromoSort('name')); }
  if (currCol) { currCol.style.cursor = 'pointer'; currCol.addEventListener('click', ()=> setPromoSort('current')); }
  if (statsCol) { statsCol.style.cursor = 'pointer'; statsCol.addEventListener('click', ()=> setPromoSort('attendance')); }
  if (beltCol) { beltCol.style.cursor = 'pointer'; beltCol.addEventListener('click', ()=> setPromoSort('belt')); }
}

function updatePromoHeaderIndicators(){
  const hdr = document.querySelector('.promo-row.header');
  if (!hdr) return;
  ['name','current','attendance','belt'].forEach(key => {
    const col = hdr.querySelector(`.col.${key==='attendance'?'stats': key}`);
    if (!col) return;
    let ind = col.querySelector('.sort-indicator');
    if (!ind){ ind = document.createElement('span'); ind.className = 'sort-indicator'; col.appendChild(ind); }
    if (promoSortField === (key==='attendance'?'attendance': key)) {
      ind.textContent = promoSortDir === 1 ? '▲' : '▼';
      ind.style.opacity = '0.95';
    } else {
      ind.textContent = '';
      ind.style.opacity = '0.3';
    }
  });
}

function exportJson(){
  const data = loadPromotions();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'promotions.json'; a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(){
  const data = loadPromotions();
  const hdr = ['studentId','oldRank','newRank','beltSize','inStock','promotionDate','createdAt','notes'];
  const rows = [hdr.join(',')];
  data.forEach(r=>{
    const vals = hdr.map(k=> '"'+String(r[k]||'').replace(/"/g,'""')+'"');
    rows.push(vals.join(','));
  });
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'promotions.csv'; a.click();
  URL.revokeObjectURL(url);
}

exportJsonBtn.addEventListener('click', exportJson);
exportCsvBtn.addEventListener('click', exportCsv);
printBtn.addEventListener('click', ()=> window.print());
rankFilter.addEventListener('change', render);

populateRankFilter();
function attachPromotionNotesEditor(item, studentId, promotionDate) {
  if (item.querySelector('.promotion-notes-editor')) return;
  const notes = document.createElement('div'); notes.className = 'promotion-notes-editor'; notes.contentEditable = 'true';
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

await syncFromCloud('kids', PROMO_KEY);
render();
attachPromoHeaderSorting();
updatePromoHeaderIndicators();
// enforce layout after initial render
enforceGridLayout();
// ensure target selects contain full rank lists
ensureTargetsFull();
// try again shortly to handle load ordering and allow inline styles to take effect
setTimeout(enforceGridLayout, 100);
setTimeout(ensureTargetsFull, 150);
window.addEventListener('resize', enforceGridLayout);

// reset horizontal scroll after initial layout passes
setTimeout(()=>{ try{ window.scrollTo(0,0); }catch(e){} }, 200);
const _clearScroll = setInterval(()=>{ try{ window.scrollTo(0,0); }catch(e){} }, 50);
setTimeout(()=>{ clearInterval(_clearScroll); }, 1200);

// final pass to ensure overflow is hidden after other scripts/layout settle
setTimeout(()=>{ try{ document.documentElement.style.overflowX='hidden'; document.body.style.overflowX='hidden'; window.scrollTo(0,0);}catch(e){} }, 500);
// also ensure the main container clips horizontal overflow
setTimeout(()=>{ try{ const c=document.querySelector('main.container'); if(c) c.style.overflowX='hidden'; }catch(e){} }, 600);

export default { render };
