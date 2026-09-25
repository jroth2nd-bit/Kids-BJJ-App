const STORAGE_KEY = 'bjj_shared_belt_sizes';
const DEFAULTS = ['Y00', 'Y0', 'Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'A0', 'A1', 'A2', 'A2L', 'A3', 'A3L', 'A4', 'A5'];

function normalize(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).map((value) => String(value || '').trim()).filter((value) => {
    const key = value.toLowerCase();
    if (!value || seen.has(key) || !/^[YA]\w*$/i.test(value)) return false;
    seen.add(key);
    return true;
  });
}

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(value) ? normalize(value) : null;
  } catch (e) {
    return null;
  }
}

function save(list) {
  const next = normalize(list);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function getBeltSizes() { return load() || save(DEFAULTS); }
export function getSizesForType(type) { return getBeltSizes().filter((size) => size[0].toLowerCase() === (type === 'adult' ? 'a' : 'y')); }
export function addBeltSize(value) { return save([...getBeltSizes(), value]); }
export function removeBeltSize(value) { return save(getBeltSizes().filter((size) => size.toLowerCase() !== String(value || '').trim().toLowerCase())); }
export function resetBeltSizes() { return save(DEFAULTS); }
export function setBeltSizes(list) { return save(list); }
export default { getBeltSizes, getSizesForType, addBeltSize, removeBeltSize, resetBeltSizes, setBeltSizes };