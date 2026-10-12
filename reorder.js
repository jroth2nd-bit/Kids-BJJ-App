// Drag-to-reorder for a list, using pointer events so mouse, pen and touch all work.
// Each <li> needs data-id and a child matching `handle`. Arrow keys on a focused handle also move the item.
export function makeSortable(list, { handle = '.drag-handle', onReorder }) {
  if (!list) return;
  const items = () => Array.from(list.children).filter((el) => el.dataset && el.dataset.id);
  const ids = () => items().map((el) => el.dataset.id);

  let dragged = null;
  let startOrder = '';
  let scrollTimer = null;

  function finish(commit) {
    if (!dragged) return;
    dragged.classList.remove('dragging');
    list.classList.remove('is-sorting');
    clearInterval(scrollTimer);
    const moved = dragged;
    dragged = null;
    if (!commit) {
      const byId = new Map(items().map((el) => [el.dataset.id, el]));
      startOrder.split('|').forEach((id) => { if (byId.has(id)) list.appendChild(byId.get(id)); });
      return;
    }
    const order = ids();
    if (order.join('|') !== startOrder) onReorder(order, moved.dataset.id);
  }

  list.addEventListener('pointerdown', (event) => {
    const grip = event.target.closest(handle);
    if (!grip || !list.contains(grip) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    dragged = grip.closest('[data-id]');
    if (!dragged) return;
    event.preventDefault();
    startOrder = ids().join('|');
    dragged.classList.add('dragging');
    list.classList.add('is-sorting');
    let lastY = event.clientY;

    const place = () => {
      const others = items().filter((el) => el !== dragged);
      const next = others.find((el) => {
        const box = el.getBoundingClientRect();
        return lastY < box.top + box.height / 2;
      });
      if (next) { if (dragged.nextElementSibling !== next) list.insertBefore(dragged, next); }
      else if (list.lastElementChild !== dragged) list.appendChild(dragged);
    };

    // Moving the row in the DOM releases pointer capture, so track the pointer on window instead.
    const onMove = (e) => { if (e.pointerId !== event.pointerId) return; lastY = e.clientY; place(); };
    const onEnd = (e) => {
      if (e.pointerId !== event.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      finish(e.type === 'pointerup');
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);

    // Scroll the list when the pointer nears its top or bottom edge.
    scrollTimer = setInterval(() => {
      const box = list.getBoundingClientRect();
      if (lastY < box.top + 28) list.scrollTop -= 8;
      else if (lastY > box.bottom - 28) list.scrollTop += 8;
      else return;
      place();
    }, 16);
  });

  list.addEventListener('keydown', (event) => {
    const grip = event.target.closest(handle);
    if (!grip || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    const item = grip.closest('[data-id]');
    const sibling = event.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    event.preventDefault();
    if (event.key === 'ArrowUp') list.insertBefore(item, sibling); else list.insertBefore(sibling, item);
    onReorder(ids(), item.dataset.id);
    const again = list.querySelector(`[data-id="${CSS.escape(item.dataset.id)}"] ${handle}`);
    if (again) again.focus();
  });
}

export const gripIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';
