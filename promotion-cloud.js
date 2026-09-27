import { supabase } from './supabase-client.js';

function keyFor(program, record, index) {
  return record.legacyKey || `${program}:${record.studentId}:${record.createdAt || record.promotionDate}:${index}`;
}

export async function syncFromCloud(program, storageKey) {
  const { data, error } = await supabase
    .from('promotions')
    .select('id, promotion_date, previous_rank, new_rank, belt_size, in_stock, confirmed, notes, legacy_key, students!inner(legacy_id, program)')
    .eq('students.program', program)
    .order('promotion_date');
  if (error) throw error;
  const records = data.map((record) => ({
    studentId: Number(record.students.legacy_id),
    oldRank: record.previous_rank,
    newRank: record.new_rank,
    beltSize: record.belt_size,
    inStock: record.in_stock,
    confirmed: record.confirmed,
    staged: !record.confirmed,
    notes: record.notes,
    promotionDate: `${record.promotion_date}T12:00:00.000Z`,
    createdAt: record.promotion_date,
    legacyKey: record.legacy_key || `${program}:${record.students.legacy_id}:cloud-${record.id}`,
  }));
  localStorage.setItem(storageKey, JSON.stringify(records));
  if (data.some((record) => !record.legacy_key)) await syncLocalPromotions(program, records);
  return records;
}

export async function syncLocalPromotions(program, records) {
  const { data: students, error: studentError } = await supabase.from('students').select('id, legacy_id, program').eq('program', program);
  if (studentError) throw studentError;
  const studentIds = new Map(students.map((student) => [Number(student.legacy_id), student.id]));
  const rows = records.map((record, index) => ({
    student_id: studentIds.get(Number(record.studentId)),
    promotion_date: String(record.promotionDate || record.createdAt || new Date().toISOString()).slice(0, 10),
    previous_rank: String(record.oldRank || 'White'),
    new_rank: String(record.newRank || 'White'),
    belt_size: String(record.beltSize || ''),
    in_stock: Boolean(record.inStock),
    confirmed: Boolean(record.confirmed),
    notes: String(record.notes || ''),
    legacy_key: keyFor(program, record, index),
  })).filter((row) => row.student_id);
  if (!rows.length) return;
  const { error } = await supabase.from('promotions').upsert(rows, { onConflict: 'legacy_key' });
  if (error) throw error;
}

export async function deleteStagedPromotion(program, legacyStudentId, promotionDate) {
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('id')
    .eq('program', program)
    .eq('legacy_id', Number(legacyStudentId))
    .maybeSingle();
  if (studentError) throw studentError;
  if (!student) return;
  const { error } = await supabase
    .from('promotions')
    .delete()
    .eq('student_id', student.id)
    .eq('promotion_date', String(promotionDate || '').slice(0, 10))
    .eq('confirmed', false);
  if (error) throw error;
}
