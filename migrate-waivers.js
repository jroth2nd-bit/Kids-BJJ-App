import { supabase } from './supabase-client.js';

const summary = document.getElementById('migrationSummary');
const status = document.getElementById('migrationStatus');
const refreshButton = document.getElementById('refreshMigration');
const migrateButton = document.getElementById('migrateWaivers');

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function localWaivers() {
  return readList('bjj_waivers');
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', isError);
}

function renderPreview() {
  const waivers = localWaivers();
  const kids = waivers.filter((waiver) => waiver.studentType === 'kids').length;
  const adults = waivers.filter((waiver) => waiver.studentType === 'adult').length;
  summary.innerHTML = '';
  const total = document.createElement('strong');
  total.textContent = `Total signed waivers: ${waivers.length}`;
  const breakdown = document.createElement('span');
  breakdown.textContent = `Kids: ${kids} | Adults: ${adults}`;
  summary.append(total, breakdown);
  setStatus('Ready to preview or migrate.');
}

async function migrate() {
  const waivers = localWaivers();
  if (!waivers.length) {
    setStatus('No local waivers were found.', true);
    return;
  }
  migrateButton.disabled = true;
  setStatus(`Preparing ${waivers.length} signed waivers...`);
  try {
    const { data: students, error: studentError } = await supabase.from('students').select('id, legacy_id, program');
    if (studentError) throw studentError;
    const studentIds = new Map(students.map((student) => [`${student.program}:${student.legacy_id}`, student.id]));
    const missing = [];
    const rows = waivers.map((waiver) => {
      const studentId = studentIds.get(`${waiver.studentType}:${waiver.studentId}`);
      if (!studentId) missing.push(`${waiver.studentType}:${waiver.studentId}`);
      const contact = waiver.contact || {};
      const signedAt = waiver.signedAt || waiver.createdAt || new Date().toISOString();
      return {
        student_id: studentId,
        waiver_version: Number(waiver.waiverVersion || 1),
        participant_name: String(waiver.participantName || ''),
        parent_guardian_name: String(waiver.parentGuardianName || contact.parentGuardianName || ''),
        phone: String(contact.phone || ''),
        email: String(contact.email || ''),
        emergency_name: String(contact.emergencyName || ''),
        emergency_phone: String(contact.emergencyPhone || ''),
        date_of_birth: contact.dateOfBirth || null,
        emergency_relationship: String(contact.emergencyRelationship || ''),
        signature: waiver.signature || waiver.snapshot?.signature || {},
        snapshot: waiver.snapshot || {},
        signed_at: signedAt,
        created_at: waiver.createdAt || signedAt,
        updated_at: waiver.updatedAt || signedAt,
        legacy_key: waiver.id,
      };
    });
    if (missing.length) throw new Error(`Missing cloud students: ${missing.join(', ')}`);
    const { error } = await supabase.from('waivers').upsert(rows, { onConflict: 'legacy_key' });
    if (error) throw error;
    setStatus(`Migration complete: ${rows.length} signed waivers copied.`);
  } catch (error) {
    setStatus(`Migration failed: ${error.message}`, true);
  } finally {
    migrateButton.disabled = false;
  }
}

refreshButton.addEventListener('click', renderPreview);
migrateButton.addEventListener('click', migrate);
renderPreview();
