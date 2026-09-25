import { supabase } from './supabase-client.js';

const summary = document.getElementById('migrationSummary');
const status = document.getElementById('migrationStatus');
const refreshButton = document.getElementById('refreshMigration');
const migrateButton = document.getElementById('migratePromotions');

function readList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
}

function localPromotions() {
  return [
    ...readList('bjj_promotions').map((promotion) => ({ ...promotion, program: 'kids' })),
    ...readList('bjj_adult_promotions').map((promotion) => ({ ...promotion, program: 'adult' })),
  ];
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', isError);
}

function renderPreview() {
  const promotions = localPromotions();
  const kids = promotions.filter((promotion) => promotion.program === 'kids').length;
  const adults = promotions.filter((promotion) => promotion.program === 'adult').length;
  summary.innerHTML = '';
  const total = document.createElement('strong');
  total.textContent = `Total promotions: ${promotions.length}`;
  const breakdown = document.createElement('span');
  breakdown.textContent = `Kids: ${kids} | Adults: ${adults}`;
  summary.append(total, breakdown);
  setStatus('Ready to preview or migrate.');
}

async function migrate() {
  const promotions = localPromotions();
  if (!promotions.length) {
    setStatus('No local promotions were found.', true);
    return;
  }
  migrateButton.disabled = true;
  setStatus(`Preparing ${promotions.length} promotion records...`);
  try {
    const { data: students, error: studentError } = await supabase.from('students').select('id, legacy_id, program');
    if (studentError) throw studentError;
    const studentIds = new Map(students.map((student) => [`${student.program}:${student.legacy_id}`, student.id]));
    const missing = [];
    const rows = promotions.map((promotion, index) => {
      const studentId = studentIds.get(`${promotion.program}:${promotion.studentId}`);
      if (!studentId) missing.push(`${promotion.program}:${promotion.studentId}`);
      const promotionDate = promotion.promotionDate || promotion.createdAt || new Date().toISOString();
      return {
        student_id: studentId,
        promotion_date: String(promotionDate).slice(0, 10),
        previous_rank: String(promotion.oldRank || 'White'),
        new_rank: String(promotion.newRank || 'White'),
        belt_size: String(promotion.beltSize || ''),
        in_stock: Boolean(promotion.inStock),
        confirmed: Boolean(promotion.confirmed),
        notes: String(promotion.notes || ''),
        legacy_key: `${promotion.program}:${promotion.studentId}:${promotion.createdAt || promotionDate}:${index}`,
      };
    });
    if (missing.length) throw new Error(`Missing cloud students: ${missing.join(', ')}`);
    const { error } = await supabase.from('promotions').upsert(rows, { onConflict: 'legacy_key' });
    if (error) throw error;
    setStatus(`Migration complete: ${rows.length} promotion records copied.`);
  } catch (error) {
    setStatus(`Migration failed: ${error.message}`, true);
  } finally {
    migrateButton.disabled = false;
  }
}

refreshButton.addEventListener('click', renderPreview);
migrateButton.addEventListener('click', migrate);
renderPreview();
