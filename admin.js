import * as students from './students.js';
import * as attendance from './attendance.js?v=4';
import * as beltSizes from './shared-belt-sizes.js?v=1';
import * as adultAttendance from './adult-attendance.js?v=3';

const importJsonFile = document.getElementById('importJsonFile');
const csvImportFile = document.getElementById('csvImportFile');
const csvTypeSelect = document.getElementById('csvTypeSelect');
const csvImportContainer = document.getElementById('csvImportContainer');
const exportJsonBtn = document.getElementById('exportJson');
const exportCsvBtn = document.getElementById('exportCsv');
const exportFullBackupBtn = document.getElementById('exportFullBackup');
const undoBtn = document.getElementById('undoImport');
const classStartDateInput = document.getElementById('classStartDate');
const saveClassStartDateBtn = document.getElementById('saveClassStartDate');
const beltSizeForm = document.getElementById('beltSizeForm');
const beltSizeInput = document.getElementById('beltSizeInput');
const beltSizesList = document.getElementById('beltSizesList');
const resetBeltSizesBtn = document.getElementById('resetBeltSizes');
const adultScheduleSettings = document.getElementById('adultScheduleSettings');
const saveAdultSettingsBtn = document.getElementById('saveAdultSettings');
const resetAdultSettingsBtn = document.getElementById('resetAdultSettings');
const adultSettingsStatus = document.getElementById('adultSettingsStatus');
const adultClassStartDate = document.getElementById('adultClassStartDate');
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function download(filename, content, mime='application/json'){
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}

function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=='');
  if (lines.length === 0) return {headers:[], rows:[]};
  const parseLine = (line) => {
    const res = []; let cur=''; let inQuotes=false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"'){
        if (inQuotes && line[i+1] === '"'){ cur += '"'; i++; } else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes){ res.push(cur); cur=''; } else { cur += ch; }
    }
    res.push(cur); return res.map(s=>s.trim());
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return {headers, rows};
}

function parseMaybeJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
}

function buildFullBackupPayload() {
  const keys = Object.keys(localStorage)
    .filter(k => k.startsWith('bjj_'))
    .sort();

  const storageByKey = {};
  keys.forEach((k) => {
    storageByKey[k] = parseMaybeJson(localStorage.getItem(k));
  });

  return {
    meta: {
      app: 'KidsBJJApp',
      format: 'full-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
    },
    data: {
      students: parseMaybeJson(localStorage.getItem('bjj_students') || '[]'),
      adultStudents: parseMaybeJson(localStorage.getItem('bjj_adult_students') || '[]'),
      attendance: parseMaybeJson(localStorage.getItem('bjj_attendance') || '[]'),
      promotions: parseMaybeJson(localStorage.getItem('bjj_promotions') || '[]'),
      waivers: parseMaybeJson(localStorage.getItem('bjj_waivers') || '[]'),
      classNotes: parseMaybeJson(localStorage.getItem('bjj_class_notes') || '[]'),
      ideaNotebook: parseMaybeJson(localStorage.getItem('bjj_idea_notebook') || 'null'),
      studentInfoPreferences: parseMaybeJson(localStorage.getItem('bjj_student_info_preferences') || '{}'),
      classStartDate: localStorage.getItem('bjj_class_start_date') || attendance.getClassStartDate(),
      nextStudentId: localStorage.getItem('bjj_next_student_id') || null,
    },
    storageByKey,
  };
}

function renderBeltSizes() {
  if (!beltSizesList) return;
  const list = beltSizes.getBeltSizes();
  beltSizesList.innerHTML = '';
  if (list.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'No belt sizes configured';
    beltSizesList.appendChild(empty);
    return;
  }

  list.forEach((size) => {
    const li = document.createElement('li');
    li.className = 'admin-list-item';

    const label = document.createElement('span');
    label.className = 'admin-list-text';
    label.textContent = size;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn cancel';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      beltSizes.removeBeltSize(size);
      renderBeltSizes();
    });

    li.appendChild(label);
    li.appendChild(removeBtn);
    beltSizesList.appendChild(li);
  });
}

function renderAdultSchedule() {
  if (!adultScheduleSettings) return;
  if (adultClassStartDate) adultClassStartDate.value = adultAttendance.getSettings().startDate;
  adultScheduleSettings.innerHTML = '';
  const groups = new Map();
  adultAttendance.getSettings().sessions.forEach((session) => {
    if (!groups.has(session.day)) groups.set(session.day, []);
    groups.get(session.day).push(session);
  });
  groups.forEach((sessions, day) => {
    const group = document.createElement('section'); group.className = 'adult-schedule-day';
    const heading = document.createElement('h3'); heading.textContent = dayNames[day]; group.appendChild(heading);
    const labels = document.createElement('div'); labels.className = 'adult-schedule-labels'; labels.innerHTML = '<span>Session</span><span>Class name</span><span>Start</span><span>End</span>'; group.appendChild(labels);
    sessions.forEach((session) => {
      const row = document.createElement('div'); row.className = 'adult-schedule-row'; row.dataset.id = session.id;
      const title = document.createElement('strong'); title.textContent = session.slot;
      const label = document.createElement('input'); label.type = 'text'; label.value = session.label; label.dataset.field = 'label'; label.placeholder = 'Class name'; label.setAttribute('aria-label', `${dayNames[day]} ${session.slot} class name`);
      const start = document.createElement('input'); start.type = 'time'; start.value = session.start; start.dataset.field = 'start'; start.setAttribute('aria-label', `${dayNames[day]} ${session.slot} start time`);
      const end = document.createElement('input'); end.type = 'time'; end.value = session.end; end.dataset.field = 'end'; end.setAttribute('aria-label', `${dayNames[day]} ${session.slot} end time`);
      row.append(title, label, start, end); group.appendChild(row);
    });
    adultScheduleSettings.appendChild(group);
  });
}

function saveAdultSchedule() {
  const settings = adultAttendance.getSettings();
  if (adultClassStartDate && adultClassStartDate.value) settings.startDate = adultClassStartDate.value;
  settings.sessions.forEach((session) => {
    const row = adultScheduleSettings.querySelector(`[data-id="${session.id}"]`);
    session.label = row.querySelector('[data-field="label"]').value.trim() || session.label;
    session.start = row.querySelector('[data-field="start"]').value;
    session.end = row.querySelector('[data-field="end"]').value;
  });
  adultAttendance.saveSettings(settings);
  if (adultSettingsStatus) adultSettingsStatus.textContent = 'Saved';
}

function backupLocalStorage(){
  try{
    const payload = {
      students: JSON.parse(localStorage.getItem('bjj_students') || '[]'),
      attendance: JSON.parse(localStorage.getItem('bjj_attendance') || '[]'),
      classStartDate: localStorage.getItem('bjj_class_start_date') || attendance.getClassStartDate(),
      nextId: localStorage.getItem('bjj_next_student_id') || null,
      at: new Date().toISOString()
    };
    const key = `bjj_backup_${Date.now()}`;
    localStorage.setItem(key, JSON.stringify(payload));
    return key;
  } catch(e){ return null; }
}

function listBackups(){
  return Object.keys(localStorage).filter(k=>k.startsWith('bjj_backup_')).sort();
}

function restoreLatestBackup(){
  const backups = listBackups();
  if (backups.length === 0) return false;
  const latest = backups[backups.length-1];
  try{
    const data = JSON.parse(localStorage.getItem(latest));
    if (!data) return false;
    localStorage.setItem('bjj_students', JSON.stringify(data.students||[]));
    localStorage.setItem('bjj_attendance', JSON.stringify(data.attendance||[]));
    if (data.classStartDate) localStorage.setItem('bjj_class_start_date', String(data.classStartDate));
    if (data.nextId) localStorage.setItem('bjj_next_student_id', data.nextId);
    return true;
  } catch(e){ return false; }
}

function syncClassStartDateInput(){
  if (!classStartDateInput) return;
  classStartDateInput.value = attendance.getClassStartDate();
}

function showCsvMapping(parsed, type){
  csvImportContainer.innerHTML = '';
  csvImportContainer.style.display = 'block';
  const title = document.createElement('div'); title.textContent = `Import ${type} — map headers to fields`;
  csvImportContainer.appendChild(title);

  const mappingDiv = document.createElement('div'); mappingDiv.className = 'csv-mapping';
  const expected = type === 'students' ? ['id','firstName','lastName','active'] : ['studentId','date','present'];
  expected.forEach(field => {
    const col = document.createElement('div'); col.className='map-col';
    const lbl = document.createElement('label'); lbl.textContent = field;
    const sel = document.createElement('select'); sel.dataset.field = field;
    const emptyOpt = document.createElement('option'); emptyOpt.value='__ignore'; emptyOpt.textContent='(ignore)'; sel.appendChild(emptyOpt);
    parsed.headers.forEach(h=>{ const o=document.createElement('option'); o.value=h; o.textContent=h; sel.appendChild(o); });
    col.appendChild(lbl); col.appendChild(sel); mappingDiv.appendChild(col);
  });
  csvImportContainer.appendChild(mappingDiv);

  const preview = document.createElement('div'); preview.className='csv-preview';
  const table = document.createElement('table'); const headerRow = document.createElement('tr'); parsed.headers.forEach(h=>{const th=document.createElement('th');th.textContent=h;headerRow.appendChild(th)}); table.appendChild(headerRow);
  parsed.rows.slice(0,20).forEach(r=>{ const tr=document.createElement('tr'); r.forEach(c=>{ const td=document.createElement('td'); td.textContent=c; tr.appendChild(td); }); table.appendChild(tr); });
  preview.appendChild(table); csvImportContainer.appendChild(preview);

  const actions = document.createElement('div'); actions.className='csv-actions';
  const applyBtn = document.createElement('button'); applyBtn.className='btn save'; applyBtn.textContent='Apply Import';
  const cancelBtn = document.createElement('button'); cancelBtn.className='btn cancel'; cancelBtn.textContent='Cancel';
  actions.appendChild(applyBtn); actions.appendChild(cancelBtn); csvImportContainer.appendChild(actions);

  applyBtn.addEventListener('click', ()=>{
    const selects = mappingDiv.querySelectorAll('select'); const map = {}; selects.forEach(s=>{ if (s.value && s.value!=='__ignore') map[s.dataset.field]=s.value; });
    const mode = document.querySelector('input[name="csvMode"]:checked')?.value || 'merge';
    try{ applyCsvImport(parsed, map, type, mode); alert('Import applied'); csvImportContainer.innerHTML=''; } catch(err){ alert('Import failed: '+err.message); }
  });
  cancelBtn.addEventListener('click', ()=>{ csvImportContainer.innerHTML=''; });
}

function applyCsvImport(parsed, mapping, type, mode){
  const objs = parsed.rows.map(row=>{ const obj={}; Object.keys(mapping).forEach(field=>{ const header = mapping[field]; const idx = parsed.headers.indexOf(header); obj[field] = idx>=0 ? row[idx] : ''; }); return obj; });
  if (type === 'students'){
    const normalized = objs.map(o=>({ id: o.id ? Number(o.id) : null, firstName: (o.firstName||'').trim(), lastName: (o.lastName||'').trim(), active: String(o.active||'').toLowerCase()==='true' || o.active==='1' }));
    normalized.forEach(n=>{ if (!n.firstName || !n.lastName) throw new Error('Student must have first and last name'); });
    backupLocalStorage(); const key='bjj_students';
    if (mode==='overwrite') { localStorage.setItem(key, JSON.stringify(normalized)); }
    else { const existing=JSON.parse(localStorage.getItem(key)||'[]'); const mapById=new Map(existing.map(s=>[s.id,s])); normalized.forEach(n=>{ if (n.id!=null && mapById.has(n.id)){ mapById.set(n.id,Object.assign({}, mapById.get(n.id), n)); } else { if (n.id==null){ const next=Number(localStorage.getItem('bjj_next_student_id')||'1'); n.id=next; localStorage.setItem('bjj_next_student_id',String(next+1)); } mapById.set(n.id,n); } }); localStorage.setItem(key, JSON.stringify(Array.from(mapById.values()))); }
    return;
  }
  if (type === 'attendance'){
    const normalized = objs.map(o=>({ studentId: o.studentId ? Number(o.studentId) : null, date: (o.date||'').trim(), present: String(o.present||'').toLowerCase()==='true' || o.present==='1' }));
    normalized.forEach(n=>{ if (!n.studentId || !n.date) throw new Error('Attendance row needs studentId and date'); });
    backupLocalStorage(); const key='bjj_attendance';
    if (mode==='overwrite'){ localStorage.setItem(key, JSON.stringify(normalized)); }
    else { const existing=JSON.parse(localStorage.getItem(key)||'[]'); const indexMap=new Map(existing.map(r=>[`${r.studentId}::${r.date}`, r])); normalized.forEach(n=>{ const k=`${n.studentId}::${n.date}`; indexMap.set(k,n); }); localStorage.setItem(key, JSON.stringify(Array.from(indexMap.values()))); }
    return;
  }
  throw new Error('Unknown type');
}

// JSON import
importJsonFile && importJsonFile.addEventListener('change', (e)=>{
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const json = JSON.parse(ev.target.result);
      const isFullBackup = json && json.meta?.format === 'full-backup' && json.data;
      const data = isFullBackup ? json.data : json;
      if (!Array.isArray(data?.students) || !Array.isArray(data?.attendance)) {
        return alert('Invalid JSON format');
      }
      backupLocalStorage();
      if (isFullBackup && json.storageByKey && typeof json.storageByKey === 'object') {
        Object.entries(json.storageByKey).forEach(([key, value]) => {
          if (key.startsWith('bjj_') && !key.startsWith('bjj_backup_')) {
            localStorage.setItem(key, JSON.stringify(value));
          }
        });
      }
      localStorage.setItem('bjj_students', JSON.stringify(data.students));
      if (Array.isArray(data.adultStudents)) localStorage.setItem('bjj_adult_students', JSON.stringify(data.adultStudents));
      localStorage.setItem('bjj_attendance', JSON.stringify(data.attendance));
      if (Array.isArray(data.promotions)) localStorage.setItem('bjj_promotions', JSON.stringify(data.promotions));
      if (Array.isArray(data.waivers)) localStorage.setItem('bjj_waivers', JSON.stringify(data.waivers));
      if (Array.isArray(data.classNotes)) localStorage.setItem('bjj_class_notes', JSON.stringify(data.classNotes));
      if (data.ideaNotebook && Array.isArray(data.ideaNotebook.sections)) {
        localStorage.setItem('bjj_idea_notebook', JSON.stringify(data.ideaNotebook));
      }
      if (data.studentInfoPreferences && typeof data.studentInfoPreferences === 'object') {
        localStorage.setItem('bjj_student_info_preferences', JSON.stringify(data.studentInfoPreferences));
      }
      if (data.classStartDate) attendance.setClassStartDate(data.classStartDate);
      const nextStudentId = data.nextStudentId ?? data.nextId;
      if (nextStudentId) localStorage.setItem('bjj_next_student_id', String(nextStudentId));
      syncClassStartDateInput();
      alert('Import successful');
    } catch(err){
      alert('Failed to parse JSON file');
    }
  };
  reader.readAsText(f);
  e.target.value='';
});

// CSV import
csvImportFile && csvImportFile.addEventListener('change', (e)=>{ const f=e.target.files && e.target.files[0]; if (!f) return; const reader=new FileReader(); reader.onload=(ev)=>{ try{ const parsed=parseCSV(ev.target.result); const type = csvTypeSelect ? csvTypeSelect.value : 'students'; showCsvMapping(parsed, type); } catch(err){ alert('Failed to parse CSV: '+err.message); } }; reader.readAsText(f); });

exportJsonBtn && exportJsonBtn.addEventListener('click', ()=>{ const payload={ students: students.getStudents(), attendance: attendance.getAllAttendance(), beltSizes: beltSizes.getBeltSizes(), classStartDate: attendance.getClassStartDate(), exportedAt: new Date().toISOString() }; download('bjj-data.json', JSON.stringify(payload,null,2)); });
exportCsvBtn && exportCsvBtn.addEventListener('click', ()=>{ const srows=students.getStudents(); const sHeader=['id','firstName','lastName','active']; const sCsv=[sHeader.join(',')].concat(srows.map(s=>`${s.id},"${s.firstName}","${s.lastName}",${s.active}`)).join('\n'); download('students.csv', sCsv, 'text/csv'); const arows=attendance.getAllAttendance(); const aHeader=['studentId','date','present']; const aCsv=[aHeader.join(',')].concat(arows.map(r=>`${r.studentId},${r.date},${r.present}`)).join('\n'); download('attendance.csv', aCsv, 'text/csv'); });
exportFullBackupBtn && exportFullBackupBtn.addEventListener('click', ()=>{
  const payload = buildFullBackupPayload();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  download(`bjj-full-backup-${stamp}.json`, JSON.stringify(payload, null, 2));
});

undoBtn && undoBtn.addEventListener('click', ()=>{ if (confirm('Restore latest import backup?')){ const ok = restoreLatestBackup(); alert(ok ? 'Backup restored' : 'No backup found'); } });

saveClassStartDateBtn && saveClassStartDateBtn.addEventListener('click', ()=>{
  const value = classStartDateInput ? classStartDateInput.value : '';
  if (!value) return alert('Choose a valid start date');
  try {
    attendance.setClassStartDate(value);
    syncClassStartDateInput();
    alert('Class start date saved');
  } catch (err) {
    alert('Invalid start date');
  }
});

beltSizeForm && beltSizeForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = beltSizeInput ? beltSizeInput.value.trim() : '';
  if (!value) return;
  beltSizes.addBeltSize(value);
  if (beltSizeInput) beltSizeInput.value = '';
  renderBeltSizes();
});

resetBeltSizesBtn && resetBeltSizesBtn.addEventListener('click', () => {
  beltSizes.resetBeltSizes();
  renderBeltSizes();
});

saveAdultSettingsBtn && saveAdultSettingsBtn.addEventListener('click', saveAdultSchedule);
resetAdultSettingsBtn && resetAdultSettingsBtn.addEventListener('click', () => {
  adultAttendance.resetSettings();
  renderAdultSchedule();
  if (adultSettingsStatus) adultSettingsStatus.textContent = 'Defaults restored';
});

syncClassStartDateInput();
renderBeltSizes();
renderAdultSchedule();
