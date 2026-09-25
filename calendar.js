import * as adultAttendance from './adult-attendance.js?v=3';

const grid = document.getElementById('calendarGrid');
const monthLabel = document.getElementById('calendarMonth');
let cursor = new Date(); cursor.setDate(1);
const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const iso = (date) => date.toISOString().split('T')[0];
const read = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch (e) { return []; } };
const noteExists = (key, date, sessionId) => read(key).some((note) => note.date === date && (!sessionId || note.sessionId === sessionId));
function addEvent(cell, text, className, onClick) { const item = document.createElement('button'); item.type = 'button'; item.className = `calendar-event ${className}`; item.textContent = text; item.addEventListener('click', onClick); cell.appendChild(item); }
function openNote(url, hasNote, label) { if (!hasNote) return alert(`No class note was found for ${label}.`); window.location.href = url; }
function render() {
  const showKids = document.getElementById('showKids').checked; const showAdults = document.getElementById('showAdults').checked; const showPromotions = document.getElementById('showPromotions').checked;
  const year = cursor.getFullYear(); const month = cursor.getMonth(); monthLabel.textContent = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); grid.innerHTML = '';
  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((name) => { const head = document.createElement('div'); head.className = 'calendar-weekday'; head.textContent = name; grid.appendChild(head); });
  const first = new Date(year, month, 1); const offset = first.getDay(); const days = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('div'));
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day, 12); const dateValue = iso(date); const cell = document.createElement('article'); cell.className = 'calendar-day'; if (dateValue === iso(new Date())) cell.classList.add('calendar-today'); const number = document.createElement('strong'); number.textContent = day; cell.appendChild(number); if (dateValue === iso(new Date())) { const todayLabel = document.createElement('span'); todayLabel.className = 'calendar-today-label'; todayLabel.textContent = 'Today'; cell.appendChild(todayLabel); }
    if (showKids && (date.getDay() === 2 || date.getDay() === 4)) addEvent(cell, 'Kids BJJ · 5:30–6:15 PM', 'kids-event', () => openNote(`class-notes.html?date=${dateValue}`, noteExists('bjj_class_notes', dateValue), `Kids BJJ on ${dateValue}`));
    if (showAdults) adultAttendance.getSessionsForDate(dateValue).forEach((session) => addEvent(cell, `${session.label} · ${session.slot}`, 'adult-event', () => openNote(`adult-class-notes.html?date=${dateValue}&session=${session.id}`, noteExists('bjj_adult_class_notes', dateValue, session.id), `${session.label} ${session.slot} on ${dateValue}`)));
    if (showPromotions) {
      read('bjj_promotions').filter((promotion) => String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10) === dateValue).forEach((promotion) => addEvent(cell, `Kids promotion${promotion.confirmed ? '' : ' · Unconfirmed'}`, promotion.confirmed ? 'kids-promotion' : 'unconfirmed', () => { window.location.href = `promotion.html?date=${dateValue}`; }));
      read('bjj_adult_promotions').filter((promotion) => String(promotion.promotionDate || promotion.createdAt || '').slice(0, 10) === dateValue).forEach((promotion) => addEvent(cell, `Adult promotion${promotion.confirmed ? '' : ' · Unconfirmed'}`, promotion.confirmed ? 'adult-promotion' : 'unconfirmed', () => { window.location.href = `adult-promotions.html?date=${dateValue}`; }));
    }
    grid.appendChild(cell);
  }
}
document.getElementById('previousMonth').addEventListener('click', () => { cursor.setMonth(cursor.getMonth() - 1); render(); });
document.getElementById('nextMonth').addEventListener('click', () => { cursor.setMonth(cursor.getMonth() + 1); render(); });
document.getElementById('todayMonth').addEventListener('click', () => { const today = new Date(); cursor = new Date(today.getFullYear(), today.getMonth(), 1); render(); });
['showKids', 'showAdults', 'showPromotions'].forEach((id) => document.getElementById(id).addEventListener('change', render));
render();
