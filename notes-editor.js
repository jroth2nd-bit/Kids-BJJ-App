const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'SPAN', 'A']);
const BLOCK_TAGS = new Set(['P', 'DIV', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'BLOCKQUOTE']);
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function normalizeLinkUrl(value) {
  let url = String(value || '').trim();
  if (!url) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !/^\/\//.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? parsed.href : '';
  } catch (e) {
    return '';
  }
}

function unwrap(element) {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

const HEADINGS = new Set(['H2', 'H3', 'H4']);
const TEXT_BLOCKS = new Set(['P', 'H2', 'H3', 'H4']);

// Chrome can leave blocks inside blocks (for example a heading inside a heading); keep the innermost.
function flattenBlocks(root) {
  Array.from(root.querySelectorAll('p, h2, h3, h4')).forEach((el) => {
    const parent = el.parentElement;
    if (!parent || el === root) return;
    if (el.tagName === 'P' && (TEXT_BLOCKS.has(parent.tagName) || parent.tagName === 'LI')) unwrap(el);
  });
  Array.from(root.querySelectorAll('h2, h3, h4, p')).forEach((el) => {
    if (!el.parentNode) return;
    const nested = Array.from(el.children).some((child) => HEADINGS.has(child.tagName) || (el.tagName === 'P' && TEXT_BLOCKS.has(child.tagName)) || ['UL', 'OL', 'BLOCKQUOTE'].includes(child.tagName));
    if (nested) unwrap(el);
  });
}

// Empty paragraphs need a placeholder line, otherwise heading/list commands nest oddly inside them.
export function fillEmptyBlocks(root) {
  root.querySelectorAll('p, h2, h3, h4, li').forEach((el) => { if (!el.firstChild) el.appendChild(document.createElement('br')); });
}
// Browsers may put a list directly inside a list; HTML requires it to live inside an li.
function nestLists(doc, root) {
  Array.from(root.querySelectorAll('ul, ol')).forEach((list) => {
    const parent = list.parentElement;
    if (!parent || !['UL', 'OL'].includes(parent.tagName)) return;
    let item = list.previousElementSibling;
    if (!item || item.tagName !== 'LI') {
      item = doc.createElement('li');
      parent.insertBefore(item, list);
    }
    item.appendChild(list);
  });
}

export function sanitizeNotesHtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const nodes = Array.from(root.querySelectorAll('*'));
  nodes.forEach((element) => {
    const tag = element.tagName;
    const weight = element.style.fontWeight;

    // Browsers wrap each Enter-created line in a div; keep it as its own paragraph.
    if (tag === 'DIV') {
      const hasBlockChild = Array.from(element.children).some((child) => BLOCK_TAGS.has(child.tagName));
      const inTextBlock = element.parentNode && ['P', 'LI', 'H2', 'H3', 'H4'].includes(element.parentNode.tagName);
      if (hasBlockChild || inTextBlock) {
        unwrap(element);
      } else {
        const paragraph = doc.createElement('p');
        while (element.firstChild) paragraph.appendChild(element.firstChild);
        element.replaceWith(paragraph);
      }
      return;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      unwrap(element);
      return;
    }

    if (tag === 'A') {
      const href = normalizeLinkUrl(element.getAttribute('href'));
      if (!href) {
        unwrap(element);
        return;
      }
      while (element.attributes.length) element.removeAttribute(element.attributes[0].name);
      element.setAttribute('href', href);
      element.setAttribute('target', '_blank');
      element.setAttribute('rel', 'noopener noreferrer');
      return;
    }

    while (element.attributes.length) element.removeAttribute(element.attributes[0].name);
    if (tag === 'SPAN' && (weight === 'normal' || weight === 'bold')) element.style.fontWeight = weight;
  });

  flattenBlocks(root);
  nestLists(doc, root);
  return root.innerHTML;
}

export function openLinkBar(toolbar, onSubmit) {
  const existing = toolbar.parentNode.querySelector('.notes-link-bar');
  if (existing) { existing.querySelector('input').focus(); return; }
  const form = document.createElement('form');
  form.className = 'notes-link-bar';
  form.innerHTML = '<input type="text" inputmode="url" aria-label="Link address" placeholder="Paste link address (https://...)" autocomplete="off" /><button type="submit" class="btn save">Add link</button><button type="button" class="btn" data-cancel>Cancel</button><span class="muted" role="status"></span>';
  const input = form.querySelector('input');
  const message = form.querySelector('span');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = normalizeLinkUrl(input.value);
    if (!url) { message.textContent = 'Enter an http, https, or mailto link.'; input.focus(); return; }
    form.remove();
    onSubmit(url);
  });
  form.querySelector('[data-cancel]').addEventListener('click', () => form.remove());
  form.addEventListener('keydown', (event) => { if (event.key === 'Escape') form.remove(); });
  toolbar.after(form);
  input.focus();
}
// Call after the editor has focus and the saved selection has been restored.
export function insertLink(url) {
  if (!url) return;
  const selection = window.getSelection();
  if (selection && String(selection).trim()) {
    document.execCommand('createLink', false, url);
    return;
  }
  const label = url.replace(/^mailto:/i, '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  document.execCommand('insertHTML', false, `<a href="${url.replace(/"/g, '%22')}">${label}</a>`);
}

function selectionInList(editor) {
  const selection = window.getSelection();
  const node = selection && selection.anchorNode;
  const element = node && (node.nodeType === 1 ? node : node.parentElement);
  return Boolean(element && editor.contains(element) && element.closest('li'));
}

export function initNotesEditor(editor, onChange) {
  document.execCommand('defaultParagraphSeparator', false, 'p');
  editor.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey || !selectionInList(editor)) return;
    event.preventDefault();
    document.execCommand(event.shiftKey ? 'outdent' : 'indent');
    if (onChange) onChange();
  });
  editor.addEventListener('click', (event) => {
    const link = event.target.closest && event.target.closest('a[href]');
    if (!link || !editor.contains(link) || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    window.open(link.href, '_blank', 'noopener,noreferrer');
  });
}
