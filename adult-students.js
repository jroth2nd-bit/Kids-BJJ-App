import { supabase } from './supabase-client.js';

const STUDENTS_KEY = 'bjj_adult_students';
const NEXT_ID_KEY = 'bjj_adult_next_student_id';

function loadStudents() {
  try {
    const value = JSON.parse(localStorage.getItem(STUDENTS_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
}

function saveStudents(list) {
  localStorage.setItem(STUDENTS_KEY, JSON.stringify(list));
}

function nextId() {
  const value = Number(localStorage.getItem(NEXT_ID_KEY) || '1');
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function getStudents() { const list = loadStudents(); let changed = false; list.forEach((student) => { if (!('notes' in student)) { student.notes = ''; changed = true; } }); if (changed) saveStudents(list); return list; }
export async function syncFromCloud() {
  const { data, error } = await supabase
    .from('students')
    .select('legacy_id, first_name, last_name, active, rank, belt_size, notes')
    .eq('program', 'adult')
    .order('legacy_id');
  if (error) throw error;
  const list = data.map((student) => ({ id: Number(student.legacy_id), firstName: student.first_name, lastName: student.last_name, active: student.active, rank: student.rank, beltSize: student.belt_size, notes: student.notes }));
  saveStudents(list);
  localStorage.setItem(NEXT_ID_KEY, String(list.reduce((max, student) => Math.max(max, student.id), 0) + 1));
  return list;
}
export function getActiveStudents() { return loadStudents().filter((student) => student.active !== false); }
export function getStudentById(id) { return loadStudents().find((student) => student.id === Number(id)) || null; }

export function addStudent(firstName, lastName) {
  const list = loadStudents();
  const id = nextId();
  const student = { id, firstName: String(firstName).trim(), lastName: String(lastName).trim(), active: true, rank: 'White', beltSize: '', notes: '' };
  list.push(student);
  saveStudents(list);
  localStorage.setItem(NEXT_ID_KEY, String(id + 1));
  return student;
}

export function updateStudent(id, firstName, lastName) {
  const list = loadStudents();
  const student = list.find((item) => item.id === Number(id));
  if (!student) return false;
  student.firstName = String(firstName).trim();
  student.lastName = String(lastName).trim();
  saveStudents(list);
  return true;
}

export function removeStudent(id) { saveStudents(loadStudents().filter((student) => student.id !== Number(id))); }

export function setActiveStatus(id, active) {
  const list = loadStudents();
  const student = list.find((item) => item.id === Number(id));
  if (!student) return false;
  student.active = Boolean(active);
  saveStudents(list);
  return true;
}

export function setRank(id, rank) {
  const list = loadStudents();
  const student = list.find((item) => item.id === Number(id));
  if (!student) return false;
  student.rank = rank;
  saveStudents(list);
  return true;
}

export function setBeltSize(id, beltSize) {
  const list = loadStudents();
  const student = list.find((item) => item.id === Number(id));
  if (!student) return false;
  student.beltSize = beltSize;
  saveStudents(list);
  return true;
}
export function setNotes(id, notes) { const list = loadStudents(); const student = list.find((item) => item.id === Number(id)); if (!student) return false; student.notes = String(notes || ''); saveStudents(list); return true; }

export default { getStudents, syncFromCloud, getActiveStudents, getStudentById, addStudent, updateStudent, removeStudent, setActiveStatus, setRank, setBeltSize, setNotes };
