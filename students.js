import { supabase } from './supabase-client.js';

const STORAGE_KEY = 'bjj_students';
const NEXT_ID_KEY = 'bjj_next_student_id';

function loadStudents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function migrateStudents() {
  const list = loadStudents();
  let changed = false;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!('rank' in s)) { s.rank = 'White'; changed = true; }
    if (!('beltSize' in s)) { s.beltSize = ''; changed = true; }
    if (!('active' in s)) { s.active = true; changed = true; }
    if (!('notes' in s)) { s.notes = ''; changed = true; }
  }
  if (changed) saveStudents(list);
}

function saveStudents(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function getNextId() {
  const n = parseInt(localStorage.getItem(NEXT_ID_KEY), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function incNextId() {
  const next = getNextId() + 1;
  localStorage.setItem(NEXT_ID_KEY, String(next));
}

function ensureSeed() {
  const students = loadStudents();
  if (students.length === 0) {
    // Seed with a couple of examples
    addStudent('Ethan', 'Smith');
    addStudent('Maya', 'Garcia');
    addStudent('Liam', 'Johnson');
  }
}

export function getStudents() {
  return loadStudents();
}

export async function syncFromCloud() {
  const { data, error } = await supabase
    .from('students')
    .select('legacy_id, first_name, last_name, active, rank, belt_size, notes')
    .eq('program', 'kids')
    .order('legacy_id');
  if (error) throw error;
  const list = data.map((student) => ({ id: Number(student.legacy_id), firstName: student.first_name, lastName: student.last_name, active: student.active, rank: student.rank, beltSize: student.belt_size, notes: student.notes }));
  saveStudents(list);
  localStorage.setItem(NEXT_ID_KEY, String(list.reduce((max, student) => Math.max(max, student.id), 0) + 1));
  return list;
}

export function getActiveStudents() {
  return loadStudents().filter(s => s.active);
}

export function getStudentById(id) {
  return loadStudents().find(s => s.id === Number(id)) || null;
}

export function addStudent(firstName, lastName) {
  const list = loadStudents();
  const id = getNextId();
  const student = {
    id,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    active: true,
    rank: 'White',
    beltSize: '',
    notes: '',
  };
  list.push(student);
  saveStudents(list);
  incNextId();
  return student;
}

export function removeStudent(id) {
  const list = loadStudents().filter(s => s.id !== Number(id));
  saveStudents(list);
}

export function setActiveStatus(id, active) {
  const list = loadStudents();
  const i = list.findIndex(s => s.id === Number(id));
  if (i !== -1) {
    list[i].active = Boolean(active);
    saveStudents(list);
    return true;
  }
  return false;
}

export function updateStudent(id, firstName, lastName) {
  const list = loadStudents();
  const i = list.findIndex(s => s.id === Number(id));
  if (i === -1) return false;
  list[i].firstName = String(firstName).trim();
  list[i].lastName = String(lastName).trim();
  saveStudents(list);
  return true;
}

export function setRank(id, rank) {
  const list = loadStudents();
  const i = list.findIndex(s => s.id === Number(id));
  if (i === -1) return false;
  list[i].rank = rank;
  saveStudents(list);
  return true;
}

export function setBeltSize(id, size) {
  const list = loadStudents();
  const i = list.findIndex(s => s.id === Number(id));
  if (i === -1) return false;
  list[i].beltSize = size;
  saveStudents(list);
  return true;
}
export function setNotes(id, notes) {
  const list = loadStudents(); const student = list.find((item) => item.id === Number(id));
  if (!student) return false; student.notes = String(notes || ''); saveStudents(list); return true;
}

// Seed on first load
ensureSeed();
// Ensure rank/beltSize fields exist for older data
migrateStudents();

export default {
  getStudents,
  syncFromCloud,
  getActiveStudents,
  getStudentById,
  addStudent,
  removeStudent,
  setActiveStatus,
  updateStudent,
  setNotes,
};
