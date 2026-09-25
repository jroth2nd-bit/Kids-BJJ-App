import { supabase } from './supabase-client.js';

const WAIVERS_KEY = 'bjj_waivers';

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(WAIVERS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
}

function save(records) {
  localStorage.setItem(WAIVERS_KEY, JSON.stringify(records));
}

function uid() {
  return `waiver_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function cloudStudentId(studentType, studentId) {
  const { data, error } = await supabase.from('students').select('id').eq('program', studentType).eq('legacy_id', Number(studentId)).maybeSingle();
  if (error) throw error;
  return data?.id || null;
}

async function saveCloudWaiver(record) {
  const studentId = await cloudStudentId(record.studentType, record.studentId);
  if (!studentId) throw new Error(`Cloud student not found for ${record.studentType}:${record.studentId}`);
  const contact = record.contact || {};
  const signedAt = record.signedAt || record.createdAt || new Date().toISOString();
  const row = {
    id: /^[0-9a-f-]{36}$/i.test(String(record.id)) ? record.id : undefined,
    student_id: studentId,
    waiver_version: Number(record.waiverVersion || 1),
    participant_name: String(record.participantName || ''),
    parent_guardian_name: String(record.parentGuardianName || contact.parentGuardianName || ''),
    phone: String(contact.phone || ''),
    email: String(contact.email || ''),
    emergency_name: String(contact.emergencyName || ''),
    emergency_phone: String(contact.emergencyPhone || ''),
    date_of_birth: contact.dateOfBirth || null,
    emergency_relationship: String(contact.emergencyRelationship || ''),
    signature: record.signature || record.snapshot?.signature || {},
    snapshot: record.snapshot || {},
    signed_at: signedAt,
    created_at: record.createdAt || signedAt,
    updated_at: record.updatedAt || signedAt,
    legacy_key: record.id,
  };
  if (!row.id) delete row.id;
  const { error } = await supabase.from('waivers').upsert(row, { onConflict: 'legacy_key' });
  if (error) throw error;
}

export async function syncFromCloud() {
  const { data, error } = await supabase
    .from('waivers')
    .select('id, waiver_version, participant_name, parent_guardian_name, phone, email, emergency_name, emergency_phone, date_of_birth, emergency_relationship, signature, snapshot, signed_at, created_at, updated_at, legacy_key, students!inner(legacy_id, program)')
    .order('signed_at', { ascending: false });
  if (error) throw error;
  const records = data.map((record) => ({
    id: record.legacy_key || record.id,
    studentType: record.students.program,
    studentId: Number(record.students.legacy_id),
    waiverVersion: record.waiver_version,
    participantName: record.participant_name,
    parentGuardianName: record.parent_guardian_name,
    contact: { dateOfBirth: record.date_of_birth || '', phone: record.phone, email: record.email, emergencyName: record.emergency_name, emergencyRelationship: record.emergency_relationship, emergencyPhone: record.emergency_phone, parentGuardianName: record.parent_guardian_name },
    signature: record.signature,
    snapshot: record.snapshot,
    signedAt: record.signed_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }));
  save(records);
  return records;
}

export function getWaivers() {
  return load().sort((a, b) => String(b.signedAt || '').localeCompare(String(a.signedAt || '')));
}

export function getWaiversForStudent(studentType, studentId) {
  return getWaivers().filter((record) => record.studentType === studentType && Number(record.studentId) === Number(studentId));
}

export function getLatestWaiverForStudent(studentType, studentId) {
  return getWaiversForStudent(studentType, studentId)[0] || null;
}

export function getWaiverById(id) {
  return load().find((record) => record.id === id) || null;
}

export function createWaiver(record) {
  const timestamp = new Date().toISOString();
  const next = { ...record, id: uid(), waiverVersion: 1, signedAt: timestamp, createdAt: timestamp, updatedAt: timestamp, snapshot: { ...(record.snapshot || {}) } };
  const records = load();
  records.push(next);
  save(records);
  void saveCloudWaiver(next).catch((error) => console.error('Cloud waiver save failed', error));
  return next;
}

export function updateWaiverContact(id, contact) {
  const records = load();
  const record = records.find((item) => item.id === id);
  if (!record) return false;
  record.contact = { ...(record.contact || {}), ...contact };
  record.updatedAt = new Date().toISOString();
  save(records);
  void saveCloudWaiver(record).catch((error) => console.error('Cloud waiver update failed', error));
  return true;
}

export function searchWaivers(query) {
  const term = String(query || '').trim().toLowerCase();
  if (!term) return getWaivers();
  return getWaivers().filter((record) => [record.participantName, record.parentGuardianName, record.contact?.phone, record.contact?.email, record.contact?.emergencyName].some((value) => String(value || '').toLowerCase().includes(term)));
}

export function replaceWaivers(records) {
  save(Array.isArray(records) ? records : []);
}

export default { getWaivers, syncFromCloud, getWaiversForStudent, getLatestWaiverForStudent, getWaiverById, createWaiver, updateWaiverContact, searchWaivers, replaceWaivers };