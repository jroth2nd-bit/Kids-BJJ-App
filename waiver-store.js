import { supabase } from './supabase-client.js';
import { sha256Hex } from './waiver-pdf.js?v=1';

const WAIVERS_KEY = 'bjj_waivers';
const PDF_BUCKET = 'signed-waivers';

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

const WAIVER_COLUMNS = 'id, waiver_version, participant_name, parent_guardian_name, phone, email, emergency_name, emergency_phone, date_of_birth, emergency_relationship, signature, snapshot, signed_at, created_at, updated_at, legacy_key, waiver_text, waiver_text_sha256, signer_relationship, signed_by_email, signed_user_agent, pdf_path, pdf_sha256, students!inner(legacy_id, program)';

function fromCloudRow(record) {
  return {
    id: record.legacy_key || record.id,
    dbId: record.id,
    studentType: record.students.program,
    studentId: Number(record.students.legacy_id),
    waiverVersion: record.waiver_version,
    participantName: record.participant_name,
    parentGuardianName: record.parent_guardian_name,
    signerRelationship: record.signer_relationship || '',
    contact: { dateOfBirth: record.date_of_birth || '', phone: record.phone, email: record.email, emergencyName: record.emergency_name, emergencyRelationship: record.emergency_relationship, emergencyPhone: record.emergency_phone, parentGuardianName: record.parent_guardian_name },
    signature: record.signature,
    snapshot: record.snapshot,
    waiverText: record.waiver_text || '',
    waiverTextSha256: record.waiver_text_sha256 || '',
    signedByEmail: record.signed_by_email || '',
    signedUserAgent: record.signed_user_agent || '',
    pdfPath: record.pdf_path || '',
    pdfSha256: record.pdf_sha256 || '',
    signedAt: record.signed_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

// signed_at, created_at, updated_at, signed_by and signed_by_email are set by the database.
async function insertCloudWaiver(record) {
  const studentId = await cloudStudentId(record.studentType, record.studentId);
  if (!studentId) throw new Error(`Cloud student not found for ${record.studentType}:${record.studentId}`);
  const contact = record.contact || {};
  const row = {
    student_id: studentId,
    waiver_version: Number(record.waiverVersion || 1),
    participant_name: String(record.participantName || ''),
    parent_guardian_name: String(record.parentGuardianName || contact.parentGuardianName || ''),
    signer_relationship: String(record.signerRelationship || ''),
    phone: String(contact.phone || ''),
    email: String(contact.email || ''),
    emergency_name: String(contact.emergencyName || ''),
    emergency_phone: String(contact.emergencyPhone || ''),
    date_of_birth: contact.dateOfBirth || null,
    emergency_relationship: String(contact.emergencyRelationship || ''),
    signature: record.signature || record.snapshot?.signature || {},
    snapshot: record.snapshot || {},
    waiver_text: record.waiverText || '',
    waiver_text_sha256: record.waiverTextSha256 || '',
    signed_user_agent: String(record.signedUserAgent || ''),
    legacy_key: record.id,
  };
  const { data, error } = await supabase.from('waivers').insert(row).select(WAIVER_COLUMNS).single();
  if (error) throw error;
  return fromCloudRow(data);
}

export async function syncFromCloud() {
  const { data, error } = await supabase.from('waivers').select(WAIVER_COLUMNS).order('signed_at', { ascending: false });
  if (error) throw error;
  const records = data.map(fromCloudRow);
  save(records);
  return records;
}

async function uploadPdf(record, pdfBlob) {
  const path = `${record.studentType}/${record.dbId}.pdf`;
  const pdfSha256 = await sha256Hex(await pdfBlob.arrayBuffer());
  const { error: uploadError } = await supabase.storage.from(PDF_BUCKET).upload(path, pdfBlob, { contentType: 'application/pdf', upsert: false });
  if (uploadError && !/already exists|duplicate/i.test(uploadError.message || '')) throw uploadError;
  const { error } = await supabase.from('waivers').update({ pdf_path: path, pdf_sha256: pdfSha256 }).eq('id', record.dbId).is('pdf_path', null);
  if (error) throw error;
  return { pdfPath: path, pdfSha256 };
}

export async function ensurePdfCopy(id) {
  const records = load();
  const record = records.find((item) => item.id === id);
  if (!record) throw new Error('Waiver not found');
  if (record.pdfPath) return record;
  if (!record.waiverText) throw new Error('This waiver was signed before the wording was stored, so no PDF copy can be built.');
  const { buildWaiverPdf } = await import('./waiver-pdf.js?v=1');
  Object.assign(record, await uploadPdf(record, await buildWaiverPdf(record)));
  save(records);
  return record;
}

export async function getPdfUrl(id) {
  const record = await ensurePdfCopy(id);
  const { data, error } = await supabase.storage.from(PDF_BUCKET).createSignedUrl(record.pdfPath, 300);
  if (error) throw error;
  return data.signedUrl;
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

// Resolves only after the cloud has stored the waiver; a PDF failure is reported via pdfError.
export async function createWaiver(record) {
  const saved = await insertCloudWaiver({ ...record, id: uid(), waiverVersion: 1, snapshot: { ...(record.snapshot || {}) } });
  const records = load().filter((item) => item.id !== saved.id);
  records.push(saved);
  save(records);
  try {
    const { buildWaiverPdf } = await import('./waiver-pdf.js?v=1');
    Object.assign(saved, await uploadPdf(saved, await buildWaiverPdf(saved)));
    save(records);
  } catch (error) {
    console.error('Waiver PDF copy failed', error);
    saved.pdfError = error.message || String(error);
  }
  return saved;
}

export async function updateWaiverContact(id, contact) {
  const records = load();
  const record = records.find((item) => item.id === id);
  if (!record) return false;
  const next = { ...(record.contact || {}), ...contact };
  const { error } = await supabase.from('waivers').update({
    phone: String(next.phone || ''),
    email: String(next.email || ''),
    emergency_name: String(next.emergencyName || ''),
    emergency_phone: String(next.emergencyPhone || ''),
    emergency_relationship: String(next.emergencyRelationship || ''),
    date_of_birth: next.dateOfBirth || null,
  }).eq('id', record.dbId);
  if (error) throw error;
  record.contact = next;
  record.updatedAt = new Date().toISOString();
  save(records);
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

export default { getWaivers, syncFromCloud, getWaiversForStudent, getLatestWaiverForStudent, getWaiverById, createWaiver, updateWaiverContact, searchWaivers, replaceWaivers, ensurePdfCopy, getPdfUrl };