import { syncFromCloud, syncLocalNotebook } from './idea-cloud.js?v=3';
import { sanitizeNotesHtml, setupNotesToolbar } from './notes-editor.js?v=5';
import { makeSortable, gripIcon } from './reorder.js?v=2';

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

const saveIdeaBtn = document.getElementById('saveIdea');
const statusEl = document.getElementById('ideasStatus');

let selectedSectionId = null;
let selectedSubsectionId = null;
let dirty = false;

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

function clearDirty(message = 'Saved') {
  dirty = false;
  setStatus(message);
}

const LEGACY_SKELETON = '<h3>Overview</h3><p></p><h3>How To Run It</h3><p></p><h3>Coaching Notes</h3><p></p><h3>References</h3><p></p>';

function defaultContent() {
  return '';
}

// Subsections never edited still hold the old heading skeleton; show them blank.
function initialContent(html) {
  const flat = String(html || '').replace(/<br\s*\/?>|\s/g, '');
  return flat === LEGACY_SKELETON.replace(/\s/g, '') ? '' : (html || '');
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

function makeGrip(kind) {
  const grip = document.createElement('button');
  grip.type = 'button';
  grip.className = 'drag-handle';
  grip.innerHTML = gripIcon;
  grip.title = `Drag to reorder (or use the arrow keys)`;
  grip.setAttribute('aria-label', `Reorder ${kind}`);
  return grip;
}

function reorderById(items, orderedIds) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedIds.map((id) => byId.get(id)).filter(Boolean);
}

function onSectionsReordered(orderedIds) {
  const data = getNotebook();
  data.sections = reorderById(data.sections, orderedIds);
  replaceNotebook(data);
  setStatus('Sections reordered');
}

function onSubsectionsReordered(orderedIds) {
  const data = getNotebook();
  const section = getSectionById(data, selectedSectionId);
  if (!section) return;
  section.subsections = reorderById(section.subsections, orderedIds);
  replaceNotebook(data);
  setStatus('Subsections reordered');
}

makeSortable(sectionsList, { onReorder: onSectionsReordered });
makeSortable(subsectionsList, { onReorder: onSubsectionsReordered });
function renderSections() {
  const notebook = getNotebook();
  if (!sectionsList) return;
  sectionsList.innerHTML = '';

  notebook.sections.forEach((section) => {
    const li = document.createElement('li');
    li.className = 'ideas-item';
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

    li.append(makeGrip('section'), btn);
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

    li.append(makeGrip('subsection'), btn);
    subsectionsList.appendChild(li);
  });
}

function sanitizeHtml(html) {
  return sanitizeNotesHtml(html);
}

function renderEditor() {
  const notebook = getNotebook();
  const section = getSectionById(notebook, selectedSectionId);
  const sub = section ? getSubsectionById(section, selectedSubsectionId) : null;

  if (sectionNameInput) sectionNameInput.value = section ? (section.title || '') : '';
  if (subsectionNameInput) subsectionNameInput.value = sub ? (sub.title || '') : '';

  if (!editor) return;
  editor.innerHTML = sub ? initialContent(sub.content) : '';
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

function noteToPlainText(html) {
  const div = document.createElement('div');
  div.innerHTML = html || '';
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

if (toolbar && editor) setupNotesToolbar(toolbar, editor, markDirty);

editor && editor.addEventListener('input', markDirty);

saveIdeaBtn && saveIdeaBtn.addEventListener('click', persistCurrentEditor);
addSectionBtn && addSectionBtn.addEventListener('click', addSection);
addSubsectionBtn && addSubsectionBtn.addEventListener('click', addSubsection);
saveSectionNameBtn && saveSectionNameBtn.addEventListener('click', renameSection);
saveSubsectionNameBtn && saveSubsectionNameBtn.addEventListener('click', renameSubsection);
deleteSectionBtn && deleteSectionBtn.addEventListener('click', deleteSection);
deleteSubsectionBtn && deleteSubsectionBtn.addEventListener('click', deleteSubsection);

async function init() {
  await syncFromCloud(IDEAS_KEY);
  ensureSelection();
  renderAll();
  clearDirty('Ready');
}

init();
