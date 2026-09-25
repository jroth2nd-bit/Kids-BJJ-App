import * as kidsStudents from './students.js?v=4';
import * as adultStudents from './adult-students.js?v=2';
import * as waiverStore from './waiver-store.js?v=1';

const fields = ['participantName', 'dateOfBirth', 'phone', 'email', 'emergencyName', 'emergencyRelationship', 'emergencyPhone', 'parentGuardianName'];
const participantType = document.getElementById('participantType');
const studentRecord = document.getElementById('studentRecord');
const recordsEl = document.getElementById('waiverRecords');
const statusEl = document.getElementById('waiverStatus');
let selectedRecordId = null;

function el(id) { return document.getElementById(id); }
function setStatus(text) { if (statusEl) statusEl.textContent = text; }
function value(id) { return el(id)?.value.trim() || ''; }
function today() { return new Date().toISOString().slice(0, 10); }
function getStudentType() { return participantType.value === 'child' ? 'kids' : 'adult'; }
function getStudents() { return getStudentType() === 'kids' ? kidsStudents.getStudents() : adultStudents.getStudents(); }
function signatureCanvas(id) { return el(id); }
function canvasHasInk(canvas) { return canvas && canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((channel, index) => index % 4 === 3 && channel > 0); }
function clearCanvas(id) { const canvas = signatureCanvas(id); if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); }

function setupCanvas(id) {
  const canvas = signatureCanvas(id);
  if (!canvas) return;
  const context = canvas.getContext('2d');
  context.strokeStyle = '#111827'; context.lineWidth = 2; context.lineCap = 'round';
  let drawing = false;
  const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
  canvas.addEventListener('pointerdown', (event) => { drawing = true; canvas.setPointerCapture(event.pointerId); const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); });
  canvas.addEventListener('pointermove', (event) => { if (!drawing) return; const p = point(event); context.lineTo(p.x, p.y); context.stroke(); });
  canvas.addEventListener('pointerup', () => { drawing = false; });
  canvas.addEventListener('pointercancel', () => { drawing = false; });
}

function populateStudents() {
  const current = studentRecord.value;
  studentRecord.replaceChildren(new Option('Create or select a record', ''));
  getStudents().sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)).forEach((student) => {
    studentRecord.appendChild(new Option(`${student.firstName} ${student.lastName}`, String(student.id)));
  });
  if (current) studentRecord.value = current;
}

function syncType() {
  const isChild = participantType.value === 'child';
  el('guardianFields').hidden = !isChild;
  el('guardianSignatureFields').hidden = !isChild;
  el('minorGuardianDocument').hidden = !isChild;
  el('guardianTypedSignature').required = isChild;
  el('participantTypedSignature').required = !isChild;
  populateStudents();
  updatePreview();
}

function loadSelectedStudent() {
  const student = getStudents().find((item) => String(item.id) === studentRecord.value);
  if (!student) return;
  el('participantName').value = `${student.firstName} ${student.lastName}`;
  const record = waiverStore.getLatestWaiverForStudent(getStudentType(), student.id);
  if (!record) return;
  const contact = record.contact || {};
  fields.forEach((field) => { if (field !== 'participantName' && el(field)) el(field).value = contact[field] || (field === 'parentGuardianName' ? record.parentGuardianName || '' : ''); });
  updatePreview();
}

function updatePreview() {
  el('participantPrintPreview').textContent = value('participantName') || ' ';
  el('participantDatePreview').textContent = value('participantDate') || today();
  el('participantSignaturePreview').textContent = value('participantTypedSignature') || ' ';
  el('guardianPrintPreview').textContent = value('parentGuardianName') || ' ';
  el('guardianDatePreview').textContent = value('guardianDate') || today();
  el('guardianSignaturePreview').textContent = value('guardianTypedSignature') || ' ';
}

function resetForm(message = 'Ready') {
  fields.forEach((field) => { if (el(field)) el(field).value = ''; });
  el('studentRecord').value = '';
  el('participantTypedSignature').value = '';
  el('guardianTypedSignature').value = '';
  el('agreement').checked = false;
  clearCanvas('participantSignature'); clearCanvas('guardianSignature');
  setStatus(message); updatePreview();
}

function ensureStudent() {
  const selected = studentRecord.value;
  if (selected) return { id: Number(selected), type: getStudentType() };
  const parts = value('participantName').split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  const first = parts.shift(); const last = parts.join(' ');
  const student = getStudentType() === 'kids' ? kidsStudents.addStudent(first, last) : adultStudents.addStudent(first, last);
  return { id: student.id, type: getStudentType() };
}

function buildRecord() {
  const student = ensureStudent();
  if (!student) return null;
  const isChild = getStudentType() === 'kids';
  const contact = { dateOfBirth: value('dateOfBirth'), phone: value('phone'), email: value('email'), emergencyName: value('emergencyName'), emergencyRelationship: value('emergencyRelationship'), emergencyPhone: value('emergencyPhone'), parentGuardianName: isChild ? value('parentGuardianName') : '' };
  const typedSignature = isChild ? value('guardianTypedSignature') : value('participantTypedSignature');
  const drawnCanvas = isChild ? signatureCanvas('guardianSignature') : signatureCanvas('participantSignature');
  if (!value('participantName') || !contact.dateOfBirth || !contact.phone || !contact.email || !contact.emergencyName || !contact.emergencyRelationship || !contact.emergencyPhone || (isChild && !contact.parentGuardianName) || !typedSignature || !canvasHasInk(drawnCanvas) || !el('agreement').checked) return null;
  return {
    studentType: student.type,
    studentId: student.id,
    participantName: value('participantName'),
    parentGuardianName: contact.parentGuardianName,
    contact,
    signature: { typed: typedSignature, drawnDataUrl: drawnCanvas.toDataURL('image/png') },
    snapshot: { participantName: value('participantName'), parentGuardianName: contact.parentGuardianName, contact: { ...contact }, signature: { ...{ typed: typedSignature, drawnDataUrl: drawnCanvas.toDataURL('image/png') } } },
  };
}

function saveWaiver() {
  const record = buildRecord();
  if (!record) { setStatus('Complete all fields, draw the required signature, and accept the waiver'); return; }
  const saved = waiverStore.createWaiver(record);
  selectedRecordId = saved.id;
  setStatus('Saved and locked');
  renderRecords();
  resetForm('Saved and locked. Ready for a new waiver.');
}

function makeInput(label, field, record) {
  const wrapper = document.createElement('label'); wrapper.className = 'waiver-record-field'; wrapper.textContent = label;
  const input = document.createElement('input'); input.value = record.contact?.[field] || ''; input.dataset.field = field; wrapper.appendChild(input); return wrapper;
}

function renderRecord(record) {
  const card = document.createElement('article'); card.className = 'waiver-record'; card.dataset.id = record.id;
  const heading = document.createElement('div'); heading.className = 'waiver-record-heading';
  const title = document.createElement('strong'); title.textContent = record.participantName;
  const date = document.createElement('span'); date.textContent = `Signed ${String(record.signedAt || '').slice(0, 10)}`;
  const toggle = document.createElement('button'); toggle.className = 'btn'; toggle.type = 'button'; toggle.textContent = 'View / Edit';
  const body = document.createElement('div'); body.className = 'waiver-record-body'; body.hidden = selectedRecordId !== record.id;
  toggle.addEventListener('click', () => { body.hidden = !body.hidden; });
  heading.append(title, date, toggle); card.appendChild(heading);
  const meta = document.createElement('p'); meta.className = 'muted'; meta.textContent = `${record.studentType === 'kids' ? 'Child' : 'Adult'} waiver · ${record.parentGuardianName ? `Parent/Guardian: ${record.parentGuardianName}` : 'Participant signer'}`; body.appendChild(meta);
  const grid = document.createElement('div'); grid.className = 'waiver-record-grid';
  [['Date of birth', 'dateOfBirth'], ['Phone', 'phone'], ['Email', 'email'], ['Emergency name', 'emergencyName'], ['Emergency relationship', 'emergencyRelationship'], ['Emergency phone', 'emergencyPhone']].forEach(([label, field]) => grid.appendChild(makeInput(label, field, record)));
  body.appendChild(grid);
  const save = document.createElement('button'); save.className = 'btn save'; save.textContent = 'Save contact changes'; save.addEventListener('click', () => { const contact = {}; grid.querySelectorAll('input').forEach((input) => { contact[input.dataset.field] = input.value.trim(); }); waiverStore.updateWaiverContact(record.id, contact); setStatus('Contact details updated'); renderRecords(); });
  const print = document.createElement('button'); print.className = 'btn'; print.textContent = 'Print signed waiver'; print.addEventListener('click', () => printFullRecord(record));
  const actions = document.createElement('div'); actions.className = 'waiver-record-actions'; actions.append(save, print); body.appendChild(actions);
  card.appendChild(body); return card;
}

function renderRecords() {
  const query = el('waiverSearch').value;
  recordsEl.replaceChildren();
  const records = waiverStore.searchWaivers(query);
  if (!records.length) { recordsEl.appendChild(Object.assign(document.createElement('p'), { className: 'muted', textContent: 'No signed waivers found' })); return; }
  records.forEach((record) => recordsEl.appendChild(renderRecord(record)));
}

function printRecord(record) {
  const snapshot = record.snapshot || record;
  const popup = window.open('', '_blank');
  if (!popup) { setStatus('Allow pop-ups to print the waiver'); return; }
  const signature = snapshot.signature?.drawnDataUrl ? `<img class="printed-signature" src="${snapshot.signature.drawnDataUrl}" alt="Drawn signature" />` : '';
    popup.document.write(`<!doctype html><html><head><title>Signed waiver - ${snapshot.participantName}</title><style>body{font:14px Georgia,serif;max-width:800px;margin:30px auto;line-height:1.45;color:#111}h1{text-align:center;font:700 28px Arial}.brand{display:flex;align-items:center;justify-content:center}.sign{border-top:1px solid #111;margin-top:35px;padding-top:8px;display:grid;grid-template-columns:2fr 2fr 1fr;gap:20px}.printed-signature{max-width:180px;max-height:55px;display:block}li{margin-bottom:10px}</style></head><body><div class="brand"><h1>WAIVER OF LIABILITY</h1></div><p>This signed record preserves the waiver language accepted by the participant. Signed: ${String(record.signedAt || '').slice(0, 10)}</p><ol><li>Acknowledge the Activity includes training in jiu jitsu, grappling, striking self-defense, boxing/kickboxing, yoga, and seminars produced by or held at Black Lotus Brazilian Jiu Jitsu Academy LLP.</li><li>I understand the rules and agree to inspect the mats, equipment, training area, and facilities before participating.</li><li>I knowingly and voluntarily release Black Lotus Brazilian Jiu Jitsu Academy LLP, located at 22241 Lorain Rd., Fairview Park, OH 44126, and its representatives from claims arising from participation or travel.</li><li>I participate voluntarily and assume all known and unknown risks, including injury, disability, traumatic brain injury, emotional loss, and death.</li><li>I agree to indemnify and hold harmless Black Lotus Brazilian Jiu Jitsu Academy LLP and its agents.</li></ol><p>I have read the above warning, waiver, and release, understand that I give up substantial rights by signing it, and sign voluntarily.</p><div class="sign"><span>Participant: ${snapshot.participantName}</span><span>${snapshot.signature?.typed || ''}${signature}</span><span>Date: ${String(record.signedAt || '').slice(0, 10)}</span></div>${snapshot.parentGuardianName ? `<p>Parent/Guardian: ${snapshot.parentGuardianName}</p>` : ''}<script>window.onload=()=>window.print();<\/script></body></html>`);
  popup.document.close();
}

function printFullRecord(record) {
  const snapshot = record.snapshot || record;
  const popup = window.open('', '_blank');
  if (!popup) { setStatus('Allow pop-ups to print the waiver'); return; }
  const template = document.querySelector('.waiver-document').cloneNode(true);
  template.querySelector('#participantPrintPreview').textContent = snapshot.participantName || '';
  template.querySelector('#participantDatePreview').textContent = String(record.signedAt || '').slice(0, 10);
  template.querySelector('#participantSignaturePreview').textContent = record.studentType === 'kids' ? '' : snapshot.signature?.typed || '';
  template.querySelector('#guardianPrintPreview').textContent = snapshot.parentGuardianName || '';
  template.querySelector('#guardianDatePreview').textContent = String(record.signedAt || '').slice(0, 10);
  template.querySelector('#guardianSignaturePreview').textContent = record.studentType === 'kids' ? snapshot.signature?.typed || '' : '';
  if (record.studentType !== 'kids') template.querySelector('#minorGuardianDocument').hidden = true;
  const signatureTarget = record.studentType === 'kids' ? '#guardianSignaturePreview' : '#participantSignaturePreview';
  if (snapshot.signature?.drawnDataUrl) {
    const image = document.createElement('img'); image.src = snapshot.signature.drawnDataUrl; image.alt = 'Drawn signature'; image.className = 'printed-signature';
    template.querySelector(signatureTarget).appendChild(image);
  }
  popup.document.write(`<!doctype html><html><head><title>Signed waiver - ${snapshot.participantName}</title><style>body{font:14px Georgia,serif;max-width:900px;margin:30px auto;line-height:1.45;color:#111}.waiver-document-brand{display:flex;align-items:center;justify-content:center}.waiver-document-brand h2{font:700 28px Arial}.waiver-signature-grid{display:grid;grid-template-columns:2fr 2fr 1fr;gap:16px;border-top:1px solid #111;padding-top:8px;margin-top:24px}.printed-signature{display:block;max-width:180px;max-height:55px}</style></head><body>${template.outerHTML}<script>window.onload=()=>window.print();<\/script></body></html>`);
  popup.document.close();
}

fields.forEach((field) => el(field)?.addEventListener('input', updatePreview));
participantType.addEventListener('change', syncType);
studentRecord.addEventListener('change', loadSelectedStudent);
el('saveWaiver').addEventListener('click', saveWaiver);
el('clearWaiver').addEventListener('click', resetForm);
el('waiverSearch').addEventListener('input', renderRecords);
['participantSignature', 'guardianSignature'].forEach(setupCanvas);
document.querySelectorAll('[data-clear-canvas]').forEach((button) => button.addEventListener('click', () => clearCanvas(button.dataset.clearCanvas)));
await Promise.all([kidsStudents.syncFromCloud(), adultStudents.syncFromCloud(), waiverStore.syncFromCloud()]);
syncType(); resetForm();
const linked = new URLSearchParams(window.location.search);
if (linked.get('studentType')) {
  participantType.value = linked.get('studentType') === 'kids' ? 'child' : 'adult';
  syncType();
  studentRecord.value = linked.get('studentId') || '';
  loadSelectedStudent();
}
renderRecords();
