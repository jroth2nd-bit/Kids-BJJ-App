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

export function openLinkBar(toolbar, onSubmit, options = {}) {
  const existing = toolbar.parentNode.querySelector('.notes-link-bar');
  if (existing) { existing.querySelector('input').focus(); return; }
  const editing = Boolean(options.href);
  const form = document.createElement('form');
  form.className = 'notes-link-bar';
  form.innerHTML = '<input type="text" inputmode="url" aria-label="Link address" placeholder="Paste link address (https://...)" autocomplete="off" />'
    + `<button type="submit" class="btn save">${editing ? 'Update link' : 'Add link'}</button>`
    + (editing ? '<a class="btn" data-open target="_blank" rel="noopener noreferrer">Open</a><button type="button" class="btn cancel" data-remove>Remove</button>' : '')
    + '<button type="button" class="btn" data-cancel>Cancel</button><span class="muted" role="status"></span>';
  const input = form.querySelector('input');
  const message = form.querySelector('span');
  if (editing) {
    input.value = options.href;
    form.querySelector('[data-open]').href = options.href;
    form.querySelector('[data-remove]').addEventListener('click', () => { form.remove(); if (options.onRemove) options.onRemove(); });
  }
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

const ICONS = {
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M14 5h-4M14 19h-4M15 5l-6 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  ol: '<path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4M3.5 13.5c0-1 2.5-1 2.5.2 0 1-2.5 1.8-2.5 2.8H6"/>',
  indent: '<path d="M4 6h16M12 12h8M12 18h8M4 9l3 3-3 3"/>',
  outdent: '<path d="M4 6h16M12 12h8M12 18h8M7 9l-3 3 3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  clear: '<path d="M5 6h14M9 6l-1 12M15 6l1 12M4 20h16M10 3h4"/>'
};
const icon = (name) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const tool = (cmd, name, label, extra = '') => `<button type="button" class="tb-btn" data-cmd="${cmd}" ${extra} title="${label}" aria-label="${label}" aria-pressed="false">${icon(name)}</button>`;

export function buildNotesToolbar(toolbar) {
  toolbar.classList.add('notes-toolbar');
  toolbar.innerHTML = '<label class="tb-style"><span class="sr-only">Text style</span><select data-style aria-label="Text style"><option value="p">Normal text</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="h4">Heading 4</option></select></label>'
    + '<span class="tb-group">' + tool('bold', 'bold', 'Bold (Ctrl+B)') + tool('italic', 'italic', 'Italic (Ctrl+I)') + tool('underline', 'underline', 'Underline (Ctrl+U)') + '</span>'
    + '<span class="tb-group">' + tool('insertUnorderedList', 'ul', 'Bulleted list') + tool('insertOrderedList', 'ol', 'Numbered list') + tool('outdent', 'outdent', 'Outdent (Shift+Tab)') + tool('indent', 'indent', 'Indent (Tab)') + '</span>'
    + '<span class="tb-group">' + tool('createLink', 'link', 'Add or edit link (Ctrl+K)') + tool('removeFormat', 'clear', 'Clear formatting') + '</span>';
}

// Builds the shared toolbar and wires every editing command, selection handling and active states.
export function setupNotesToolbar(toolbar, editor, onChange = () => {}) {
  buildNotesToolbar(toolbar);
  initNotesEditor(editor, onChange);
  const styleSelect = toolbar.querySelector('[data-style]');
  let savedRange = null;

  const inEditor = (node) => Boolean(node && editor.contains(node));
  const remember = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount && inEditor(selection.anchorNode)) savedRange = selection.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    const current = window.getSelection();
    if (document.activeElement === editor && current && current.rangeCount && inEditor(current.anchorNode)) return;
    editor.focus();
    if (savedRange) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(savedRange); }
  };
  const elementOf = (node) => (node && node.nodeType === 1 ? node : node && node.parentElement);
  const currentLink = () => {
    const selection = window.getSelection();
    const element = selection && selection.rangeCount && inEditor(selection.anchorNode) ? elementOf(selection.anchorNode) : elementOf(savedRange && savedRange.startContainer);
    const link = element && element.closest('a[href]');
    return link && editor.contains(link) ? link : null;
  };

  function refreshState() {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !inEditor(selection.anchorNode)) return;
    ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList'].forEach((cmd) => {
      const button = toolbar.querySelector(`[data-cmd="${cmd}"]`);
      let on = false;
      try { on = document.queryCommandState(cmd); } catch (e) { on = false; }
      button.classList.toggle('active', on);
      button.setAttribute('aria-pressed', String(on));
    });
    const block = elementOf(selection.anchorNode).closest('h2, h3, h4, p, li, blockquote');
    styleSelect.value = block && ['H2', 'H3', 'H4'].includes(block.tagName) ? block.tagName.toLowerCase() : 'p';
    const linkButton = toolbar.querySelector('[data-cmd="createLink"]');
    const linked = Boolean(currentLink());
    linkButton.classList.toggle('active', linked);
    linkButton.setAttribute('aria-pressed', String(linked));
  }

  function run(command, value) {
    restore();
    const caret = window.getSelection();
    const keepText = caret && caret.isCollapsed && caret.anchorNode && caret.anchorNode.nodeType === 3 ? caret.anchorNode.data : null;
    const keepOffset = caret ? caret.anchorOffset : 0;
    document.execCommand(command, false, value || null);
    if (keepText) {
      const now = window.getSelection();
      if (now.isCollapsed && now.anchorNode && now.anchorNode.nodeType === 3 && now.anchorNode.data === keepText && now.anchorOffset !== keepOffset) now.collapse(now.anchorNode, keepOffset);
    }
    fillEmptyBlocks(editor);
    remember();
    refreshState();
    onChange();
  }

  function editLink() {
    remember();
    const link = currentLink();
    const apply = (url) => {
      restore();
      if (link) {
        const range = document.createRange();
        range.selectNodeContents(link);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('createLink', false, url);
      } else {
        insertLink(url);
      }
      remember(); refreshState(); onChange();
    };
    openLinkBar(toolbar, apply, link ? { href: link.getAttribute('href'), onRemove: () => { restore(); document.execCommand('unlink'); remember(); refreshState(); onChange(); } } : {});
  }

  document.addEventListener('selectionchange', () => { remember(); refreshState(); });
  toolbar.addEventListener('mousedown', (event) => { if (event.target.closest('button[data-cmd]')) { remember(); event.preventDefault(); } });
  toolbar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-cmd]');
    if (!button) return;
    if (button.dataset.cmd === 'createLink') editLink(); else run(button.dataset.cmd);
  });
  styleSelect.addEventListener('change', () => { run('formatBlock', styleSelect.value); editor.focus(); });
  editor.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') { event.preventDefault(); editLink(); }
  });
}
