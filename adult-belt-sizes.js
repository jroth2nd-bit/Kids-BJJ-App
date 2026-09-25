const STORAGE_KEY = 'bjj_adult_belt_sizes';
const DEFAULTS = ['A0', 'A1', 'A2', 'A2L', 'A3', 'A3L', 'A4', 'A5'];

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(value) ? value.filter(Boolean) : null;
  } catch (e) {
    return null;
  }
}

function save(list) {
  const values = [...new Set(list.map((value) => String(value).trim()).filter(Boolean))];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  return values;
}

export function getDefaultBeltSizes() { return DEFAULTS.slice(); }
export function getBeltSizes() {
  const stored = load();
  return stored || save(DEFAULTS);
}
export function setBeltSizes(list) { return save(Array.isArray(list) ? list : []); }
export function addBeltSize(value) { return save([...getBeltSizes(), value]); }
export function removeBeltSize(value) { return save(getBeltSizes().filter((item) => item.toLowerCase() !== String(value).trim().toLowerCase())); }
export function resetBeltSizes() { return save(DEFAULTS); }

export default { getDefaultBeltSizes, getBeltSizes, setBeltSizes, addBeltSize, removeBeltSize, resetBeltSizes };
