const STORAGE_KEY = 'bjj_belt_sizes';

const DEFAULT_BELT_SIZES = [
  'Y00 / 0000 / M000 - 70"',
  'Y0 / 000 / M00 - 72"',
  'Y1 / 00 / M0 / K1 / A0 Kids / Tatami 00 - 74-76"',
  'Y2 / 0 / M1 / K2 / Tatami 0 - 80"',
  'Y3 / 1 / M2 / K3 / A1 Kids / Tatami 1 - 82-85"',
  'Y4 / 2 / M3 / K4 / A2 Kids / Tatami 2 - 88-90"',
  'Y5 / 3 / JR / K5 / A3 Kids / Tatami 3 - 94-96"',
];

function normalizeSize(value) {
  return String(value || '').trim();
}

function uniqueSizes(list) {
  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    const value = normalizeSize(item);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });
  return out;
}

function loadStoredSizes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(parsed) ? uniqueSizes(parsed) : null;
  } catch (e) {
    return null;
  }
}

function saveSizes(list) {
  const normalized = uniqueSizes(list);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function getDefaultBeltSizes() {
  return DEFAULT_BELT_SIZES.slice();
}

export function getBeltSizes() {
  const stored = loadStoredSizes();
  if (stored && stored.length > 0) return stored;
  if (stored && stored.length === 0) return [];
  return saveSizes(DEFAULT_BELT_SIZES);
}

export function setBeltSizes(list) {
  return saveSizes(Array.isArray(list) ? list : []);
}

export function addBeltSize(value) {
  const next = getBeltSizes();
  next.push(value);
  return saveSizes(next);
}

export function removeBeltSize(value) {
  const target = normalizeSize(value).toLowerCase();
  return saveSizes(getBeltSizes().filter((item) => item.toLowerCase() !== target));
}

export function resetBeltSizes() {
  return saveSizes(DEFAULT_BELT_SIZES);
}

export default {
  getBeltSizes,
  setBeltSizes,
  addBeltSize,
  removeBeltSize,
  resetBeltSizes,
  getDefaultBeltSizes,
};