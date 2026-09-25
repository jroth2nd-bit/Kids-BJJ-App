import { syncFromCloud, syncLocalNotebook } from './idea-cloud.js';

const IDEAS_KEY = 'bjj_idea_notebook';

const sectionsList = document.getElementById('sectionsList');
const subsectionsList = document.getElementById('subsectionsList');

const addSectionBtn = document.getElementById('addSection');
const addSubsectionBtn = document.getElementById('addSubsection');

const sectionNameInput = document.getElementById('sectionName');
const subsectionNameInput = document.getElementById('subsectionName');

const saveSectionNameBtn = document.getElementById('saveSectionName');
const saveSubsectionNameBtn = document.getElementById('saveSubsectionName');
const deleteSectionBtn = document.getElementById('deleteSection');
const deleteSubsectionBtn = document.getElementById('deleteSubsection');

const editor = document.getElementById('ideaEditor');
const toolbar = document.getElementById('ideasToolbar');
const insertLinkBtn = document.getElementById('insertLink');
const linkUrlInput = document.getElementById('linkUrl');

const saveIdeaBtn = document.getElementById('saveIdea');
const exportJsonBtn = document.getElementById('exportIdeasJson');
const exportCsvBtn = document.getElementById('exportIdeasCsv');
const statusEl = document.getElementById('ideasStatus');

let selectedSectionId = null;
let selectedSubsectionId = null;
let dirty = false;
let savedEditorRange = null;

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

function markDirty() {
  dirty = true;
  setStatus('Unsaved changes');
}

function rememberEditorSelection() {
  if (!editor) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) {
    savedEditorRange = range.cloneRange();
  }
}

document.addEventListener('selectionchange', () => {
  rememberEditorSelection();
});

function restoreEditorSelection() {
  if (!editor || !savedEditorRange) return;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedEditorRange);
}

function clearDirty(message = 'Saved') {
  dirty = false;
  setStatus(message);
}

function defaultContent() {
  return '<h3>Overview</h3><p></p><h3>How To Run It</h3><p></p><h3>Coaching Notes</h3><p></p><h3>References</h3><p></p>';
}

function defaultNotebook() {
  const sectionId = uid('section');
  const subId = uid('sub');
  return {
    sections: [
      {
        id: sectionId,
        title: 'Games',
        subsections: [
          {
            id: subId,
            title: 'Bull in the Ring',
            content: defaultContent(),
            createdAt: nowIso(),
            updatedAt: nowIso(),
          }
        ]
      }
    ]
  };
}

function loadNotebook() {
  try {
    const data = JSON.parse(localStorage.getItem(IDEAS_KEY) || 'null');
    if (!data || !Array.isArray(data.sections)) {
      const seeded = defaultNotebook();
      localStorage.setItem(IDEAS_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return data;
  } catch (e) {
    const seeded = defaultNotebook();
    localStorage.setItem(IDEAS_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveNotebook(data) {
  localStorage.setItem(IDEAS_KEY, JSON.stringify(data));
  void syncLocalNotebook(data).catch((error) => console.error('Cloud idea save failed', error));
}

function getNotebook() {
  return loadNotebook();
}

function replaceNotebook(data) {
  saveNotebook(data);
}

function getSectionById(notebook, id) {
  return notebook.sections.find(s => s.id === id) || null;
}

function getSubsectionById(section, id) {
  return section.subsections.find(s => s.id === id) || null;
}

function ensureSelection() {
  const notebook = getNotebook();
  if (notebook.sections.length === 0) {
    const seeded = defaultNotebook();
    replaceNotebook(seeded);
    selectedSectionId = seeded.sections[0].id;
    selectedSubsectionId = seeded.sections[0].subsections[0].id;
    return;
  }

  let section = getSectionById(notebook, selectedSectionId);
  if (!section) {
    section = notebook.sections[0];
    selectedSectionId = section.id;
  }

  if (!section.subsections || section.subsections.length === 0) {
    section.subsections = [{
      id: uid('sub'),
      title: 'New Idea',
      content: defaultContent(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }];
    replaceNotebook(notebook);
  }

  let sub = getSubsectionById(section, selectedSubsectionId);
  if (!sub) {
    sub = section.subsections[0];
    selectedSubsectionId = sub.id;
  }
}

function renderSections() {
  const notebook = getNotebook();
  if (!sectionsList) return;
  sectionsList.innerHTML = '';

  notebook.sections.forEach((section) => {
    const li = document.createElement('li');
    li.className = 'ideas-item';
    li.draggable = true;
    li.dataset.id = section.id;
    li.dataset.kind = 'section';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ideas-item-btn';
    if (section.id === selectedSectionId) btn.classList.add('active');
    btn.textContent = section.title || '(Untitled section)';
    btn.addEventListener('click', () => {
      if (dirty && !confirm('Discard unsaved changes and switch?')) return;
      selectedSectionId = section.id;
      selectedSubsectionId = section.subsections[0] ? section.subsections[0].id : null;
      clearDirty('Loaded');
      renderAll();
    });

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `section:${section.id}`);
      e.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => e.preventDefault());
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('text/plain') || '';
      const [kind, dragId] = raw.split(':');
      if (kind !== 'section' || !dragId || dragId === section.id) return;

      const data = getNotebook();
      const from = data.sections.findIndex(s => s.id === dragId);
      const to = data.sections.findIndex(s => s.id === section.id);
      if (from === -1 || to === -1) return;

      const moved = data.sections.splice(from, 1)[0];
      data.sections.splice(to, 0, moved);
      replaceNotebook(data);
      setStatus('Sections reordered');
      renderAll();
    });

    li.appendChild(btn);
    sectionsList.appendChild(li);
  });
}

function renderSubsections() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  if (!subsectionsList) return;
  subsectionsList.innerHTML = '';

  if (!section) return;

  section.subsections.forEach((sub) => {
    const li = document.createElement('li');
    li.className = 'ideas-item';
    li.draggable = true;
    li.dataset.id = sub.id;
    li.dataset.kind = 'subsection';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ideas-item-btn';
    if (sub.id === selectedSubsectionId) btn.classList.add('active');
    btn.textContent = sub.title || '(Untitled subsection)';
    btn.addEventListener('click', () => {
      if (dirty && !confirm('Discard unsaved changes and switch?')) return;
      selectedSubsectionId = sub.id;
      clearDirty('Loaded');
      renderAll();
    });

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', `subsection:${sub.id}`);
      e.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    li.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (e) => e.preventDefault());
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('text/plain') || '';
      const [kind, dragId] = raw.split(':');
      if (kind !== 'subsection' || !dragId || dragId === sub.id) return;

      const data = getNotebook();
      const sec = getSectionById(data, selectedSectionId);
      if (!sec) return;
      const from = sec.subsections.findIndex(s => s.id === dragId);
      const to = sec.subsections.findIndex(s => s.id === sub.id);
      if (from === -1 || to === -1) return;

      const moved = sec.subsections.splice(from, 1)[0];
      sec.subsections.splice(to, 0, moved);
      replaceNotebook(data);
      setStatus('Subsections reordered');
      renderAll();
    });

    li.appendChild(btn);
    subsectionsList.appendChild(li);
  });
}

function applyAnchorPolicies(root) {
  const anchors = root.querySelectorAll('a');
  anchors.forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href || /^javascript:/i.test(href)) {
      a.removeAttribute('href');
      return;
    }
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
}

function sanitizeHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return '';

  const allowed = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'H3', 'H4', 'BLOCKQUOTE', 'SPAN', 'A']);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  const nodes = [];
  let n = walker.nextNode();
  while (n) {
    nodes.push(n);
    n = walker.nextNode();
  }

  nodes.forEach((el) => {
    const tag = el.tagName;
    const weight = el.style.fontWeight;
    if (!allowed.has(tag)) {
      const parent = el.parentNode;
      if (!parent) return;
      while (el.firstChild) parent.insertBefore(el.firstChild, el);
      parent.removeChild(el);
      return;
    }

    if (tag === 'A') {
      const href = el.getAttribute('href') || '';
      const attrs = ['href', 'target', 'rel'];
      Array.from(el.attributes).forEach((a) => {
        if (!attrs.includes(a.name)) el.removeAttribute(a.name);
      });
      if (!href || /^javascript:/i.test(href)) el.removeAttribute('href');
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    } else if (tag === 'SPAN' || tag === 'H3' || tag === 'H4') {
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
      if (weight === 'normal' || weight === 'bold') {
        el.style.fontWeight = weight;
      }
    } else {
      while (el.attributes.length > 0) {
        el.removeAttribute(el.attributes[0].name);
      }
    }
  });

  applyAnchorPolicies(root);
  return root.innerHTML;
}

function renderEditor() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  const sub = section ? getSubsectionById(section, selectedSubsectionId) : null;

  if (sectionNameInput) sectionNameInput.value = section ? (section.title || '') : '';
  if (subsectionNameInput) subsectionNameInput.value = sub ? (sub.title || '') : '';

  if (!editor) return;
  editor.innerHTML = sub ? (sub.content || defaultContent()) : '';
  applyAnchorPolicies(editor);
}

function renderAll() {
  ensureSelection();
  renderSections();
  renderSubsections();
  renderEditor();
}

function persistCurrentEditor() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  const sub = section ? getSubsectionById(section, selectedSubsectionId) : null;
  if (!section || !sub) return false;

  sub.title = (subsectionNameInput ? subsectionNameInput.value : sub.title || '').trim() || 'Untitled subsection';
  sub.content = sanitizeHtml(editor ? editor.innerHTML : '');
  sub.updatedAt = nowIso();
  if (!sub.createdAt) sub.createdAt = sub.updatedAt;

  section.title = (sectionNameInput ? sectionNameInput.value : section.title || '').trim() || 'Untitled section';

  replaceNotebook(notebook);
  clearDirty('Saved');
  renderSections();
  renderSubsections();
  return true;
}

function addSection() {
  const notebook = getNotebook();
  const sectionId = uid('section');
  const subId = uid('sub');
  const nextIndex = notebook.sections.length + 1;
  notebook.sections.push({
    id: sectionId,
    title: `New Section ${nextIndex}`,
    subsections: [{
      id: subId,
      title: 'New idea',
      content: defaultContent(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }]
  });
  replaceNotebook(notebook);
  selectedSectionId = sectionId;
  selectedSubsectionId = subId;
  clearDirty('Section added');
  renderAll();
  if (sectionNameInput) sectionNameInput.focus();
}

function addSubsection() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  if (!section) return;

  const subId = uid('sub');
  const nextIndex = section.subsections.length + 1;
  section.subsections.push({
    id: subId,
    title: `New Idea ${nextIndex}`,
    content: defaultContent(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  replaceNotebook(notebook);
  selectedSubsectionId = subId;
  clearDirty('Subsection added');
  renderAll();
  if (subsectionNameInput) subsectionNameInput.focus();
}

function renameSection() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  if (!section || !sectionNameInput) return;
  section.title = sectionNameInput.value.trim() || 'Untitled section';
  replaceNotebook(notebook);
  clearDirty('Section renamed');
  renderSections();
}

function renameSubsection() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  const sub = section ? getSubsectionById(section, selectedSubsectionId) : null;
  if (!sub || !subsectionNameInput) return;
  sub.title = subsectionNameInput.value.trim() || 'Untitled subsection';
  sub.updatedAt = nowIso();
  replaceNotebook(notebook);
  clearDirty('Subsection renamed');
  renderSubsections();
}

function deleteSection() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  if (!section) return;
  if (!confirm(`Delete section "${section.title}" and all subsections?`)) return;

  notebook.sections = notebook.sections.filter(s => s.id !== section.id);
  replaceNotebook(notebook);
  selectedSectionId = notebook.sections[0] ? notebook.sections[0].id : null;
  selectedSubsectionId = null;
  clearDirty('Section deleted');
  renderAll();
}

function deleteSubsection() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  const sub = section ? getSubsectionById(section, selectedSubsectionId) : null;
  if (!section || !sub) return;
  if (!confirm(`Delete subsection "${sub.title}"?`)) return;

  section.subsections = section.subsections.filter(s => s.id !== sub.id);
  if (section.subsections.length === 0) {
    section.subsections.push({
      id: uid('sub'),
      title: 'New idea',
      content: defaultContent(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
  selectedSubsectionId = section.subsections[0].id;
  replaceNotebook(notebook);
  clearDirty('Subsection deleted');
  renderAll();
}

function openLinkPrompt() {
  if (!editor) return;
  editor.focus();
  let url = linkUrlInput ? linkUrlInput.value.trim() : '';
  if (!url) {
    alert('Enter a URL in the link field first');
    return;
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  const selection = window.getSelection();
  const hasText = selection && String(selection).trim().length > 0;
  if (hasText) {
    document.execCommand('createLink', false, url);
  } else {
    document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  }

  applyAnchorPolicies(editor);
  if (linkUrlInput) linkUrlInput.value = '';
  markDirty();
}

function applyToolbarCommand(cmd, value) {
  if (!editor) return;
  editor.focus();
  restoreEditorSelection();
  if (cmd === 'formatBlock') {
    document.execCommand('formatBlock', false, value || 'p');
  } else {
    document.execCommand(cmd, false, null);
  }
  applyAnchorPolicies(editor);
  markDirty();
}

function noteToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

function flattenRows() {
  const notebook = getNotebook();
  const rows = [];
  notebook.sections.forEach((section, sIdx) => {
    section.subsections.forEach((sub, subIdx) => {
      rows.push({
        sectionOrder: sIdx + 1,
        subsectionOrder: subIdx + 1,
        sectionTitle: section.title || '',
        subsectionTitle: sub.title || '',
        contentHtml: sub.content || '',
        contentText: noteToPlainText(sub.content || ''),
        createdAt: sub.createdAt || '',
        updatedAt: sub.updatedAt || '',
      });
    });
  });
  return rows;
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJson() {
  download('idea-notebook.json', JSON.stringify(getNotebook(), null, 2), 'application/json');
}

function csvEscape(v) {
  return `"${String(v || '').replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = flattenRows();
  const header = ['sectionOrder', 'subsectionOrder', 'sectionTitle', 'subsectionTitle', 'contentHtml', 'contentText', 'createdAt', 'updatedAt'];
  const out = [header.join(',')];
  rows.forEach((r) => {
    out.push([
      csvEscape(r.sectionOrder),
      csvEscape(r.subsectionOrder),
      csvEscape(r.sectionTitle),
      csvEscape(r.subsectionTitle),
      csvEscape(r.contentHtml),
      csvEscape(r.contentText),
      csvEscape(r.createdAt),
      csvEscape(r.updatedAt),
    ].join(','));
  });
  download('idea-notebook.csv', out.join('\n'), 'text/csv');
}

if (toolbar) {
  toolbar.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    rememberEditorSelection();
    e.preventDefault();
  });
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    applyToolbarCommand(btn.dataset.cmd, btn.dataset.value || '');
  });
}

insertLinkBtn && insertLinkBtn.addEventListener('click', openLinkPrompt);

editor && editor.addEventListener('input', markDirty);
editor && editor.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;
  e.preventDefault();
  const href = link.getAttribute('href');
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
});

saveIdeaBtn && saveIdeaBtn.addEventListener('click', persistCurrentEditor);
addSectionBtn && addSectionBtn.addEventListener('click', addSection);
addSubsectionBtn && addSubsectionBtn.addEventListener('click', addSubsection);
saveSectionNameBtn && saveSectionNameBtn.addEventListener('click', renameSection);
saveSubsectionNameBtn && saveSubsectionNameBtn.addEventListener('click', renameSubsection);
deleteSectionBtn && deleteSectionBtn.addEventListener('click', deleteSection);
deleteSubsectionBtn && deleteSubsectionBtn.addEventListener('click', deleteSubsection);
exportJsonBtn && exportJsonBtn.addEventListener('click', exportJson);
exportCsvBtn && exportCsvBtn.addEventListener('click', exportCsv);

async function init() {
  await syncFromCloud(IDEAS_KEY);
  ensureSelection();
  renderAll();
  clearDirty('Ready');
}

init();
