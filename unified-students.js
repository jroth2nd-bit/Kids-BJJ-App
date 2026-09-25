const KIDS_KEY = 'bjj_students';
const ADULT_KEY = 'bjj_adult_students';
const KIDS_ATTENDANCE_KEY = 'bjj_attendance';
const ADULT_ATTENDANCE_KEY = 'bjj_adult_attendance';
const KIDS_PROMO_KEY = 'bjj_promotions';
const ADULT_PROMO_KEY = 'bjj_adult_promotions';

function read(key, fallback = []) { try { const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); return value; } catch (e) { return fallback; } }
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function nextId(key, list) { const current = Number(localStorage.getItem(key) || '1'); const max = list.reduce((value, item) => Math.max(value, Number(item.id) || 0), 0) + 1; const id = Math.max(current, max); localStorage.setItem(key, String(id + 1)); return id; }

export function getStudents() {
  return [
    ...read(KIDS_KEY).map((student) => ({ ...student, studentType: 'child', sourceId: student.id })),
    ...read(ADULT_KEY).map((student) => ({ ...student, studentType: 'adult', sourceId: student.id })),
  ];
}

export function getStudent(studentType, id) { return getStudents().find((student) => student.studentType === studentType && Number(student.sourceId) === Number(id)) || null; }

export function updateStudent(student, patch) {
  const key = student.studentType === 'child' ? KIDS_KEY : ADULT_KEY;
  const list = read(key);
  const index = list.findIndex((item) => Number(item.id) === Number(student.sourceId));
  if (index === -1) return false;
  list[index] = { ...list[index], ...patch };
  write(key, list);
  return true;
}

function moveAttendance(student, targetType, targetId) {
  const sourceKey = student.studentType === 'child' ? KIDS_ATTENDANCE_KEY : ADULT_ATTENDANCE_KEY;
  const targetKey = targetType === 'child' ? KIDS_ATTENDANCE_KEY : ADULT_ATTENDANCE_KEY;
  const source = read(sourceKey); const matching = source.filter((item) => Number(item.studentId) === Number(student.sourceId));
  write(sourceKey, source.filter((item) => Number(item.studentId) !== Number(student.sourceId)));
  const target = read(targetKey);
  matching.forEach((item) => {
    const next = { ...item, studentId: targetId };
    if (targetType === 'adult' && !next.sessionId) next.sessionId = 'migrated';
    if (targetType === 'child') delete next.sessionId;
    target.push(next);
  });
  write(targetKey, target);
}

function movePromotions(student, targetType, targetId) {
  const sourceKey = student.studentType === 'child' ? KIDS_PROMO_KEY : ADULT_PROMO_KEY;
  const targetKey = targetType === 'child' ? KIDS_PROMO_KEY : ADULT_PROMO_KEY;
  const source = read(sourceKey); const matching = source.filter((item) => Number(item.studentId) === Number(student.sourceId));
  write(sourceKey, source.filter((item) => Number(item.studentId) !== Number(student.sourceId)));
  const target = read(targetKey); matching.forEach((item) => target.push({ ...item, studentId: targetId })); write(targetKey, target);
}

export function changeStudentType(student, targetType) {
  if (student.studentType === targetType) return student;
  const sourceKey = student.studentType === 'child' ? KIDS_KEY : ADULT_KEY;
  const targetKey = targetType === 'child' ? KIDS_KEY : ADULT_KEY;
  const source = read(sourceKey); const current = source.find((item) => Number(item.id) === Number(student.sourceId));
  if (!current) return null;
  const target = read(targetKey); const existingId = target.some((item) => Number(item.id) === Number(student.sourceId)); const targetId = existingId ? nextId(targetType === 'child' ? 'bjj_next_student_id' : 'bjj_adult_next_student_id', target) : Number(student.sourceId);
  const nextKey = targetType === 'child' ? 'bjj_next_student_id' : 'bjj_adult_next_student_id';
  if (!existingId) localStorage.setItem(nextKey, String(Math.max(Number(localStorage.getItem(nextKey) || '1'), targetId + 1)));
  const moved = { ...current, id: targetId };
  target.push(moved); write(targetKey, target); write(sourceKey, source.filter((item) => Number(item.id) !== Number(student.sourceId)));
  moveAttendance(student, targetType, targetId); movePromotions(student, targetType, targetId);
  const waivers = read('bjj_waivers'); waivers.forEach((record) => { if (record.studentType === (student.studentType === 'child' ? 'kids' : 'adult') && Number(record.studentId) === Number(student.sourceId)) { record.studentType = targetType === 'child' ? 'kids' : 'adult'; record.studentId = targetId; } }); write('bjj_waivers', waivers);
  return { ...moved, studentType: targetType, sourceId: targetId };
}

export function updateBeltSize(student, beltSize) { return updateStudent(student, { beltSize }); }
export function updateRank(student, rank) { return updateStudent(student, { rank }); }
export function updateNotes(student, notes) { return updateStudent(student, { notes }); }
export default { getStudents, getStudent, updateStudent, changeStudentType, updateBeltSize, updateRank, updateNotes };