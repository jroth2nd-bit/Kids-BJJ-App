import { supabase } from './supabase-client.js';

const summary = document.getElementById('migrationSummary');
const status = document.getElementById('migrationStatus');
const refreshButton = document.getElementById('refreshMigration');
const migrateButton = document.getElementById('migrateIdeas');

function readNotebook() {
  try {
    const value = JSON.parse(localStorage.getItem('bjj_idea_notebook') || 'null');
    return value && Array.isArray(value.sections) ? value : { sections: [] };
  } catch (error) {
    return { sections: [] };
  }
}

function localIdeas() {
  const notebook = readNotebook();
  const ideas = [];
  notebook.sections.forEach((section, sectionIndex) => {
    (section.subsections || []).forEach((idea, subsectionIndex) => {
      ideas.push({ ...idea, sectionTitle: section.title || 'Untitled section', sectionIndex, subsectionIndex });
    });
  });
  return ideas;
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', isError);
}

function renderPreview() {
  const ideas = localIdeas();
  summary.innerHTML = '';
  const total = document.createElement('strong');
  total.textContent = `Total ideas: ${ideas.length}`;
  const sections = document.createElement('span');
  sections.textContent = `Sections: ${readNotebook().sections.length}`;
  summary.append(total, sections);
  setStatus('Ready to preview or migrate.');
}

async function migrate() {
  const ideas = localIdeas();
  if (!ideas.length) {
    setStatus('No local ideas were found.', true);
    return;
  }
  migrateButton.disabled = true;
  setStatus(`Preparing ${ideas.length} ideas...`);
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user found');
    const rows = ideas.map((idea) => ({
      title: `${idea.sectionTitle} / ${idea.title || 'Untitled idea'}`,
      content: String(idea.content || ''),
      created_by: user.id,
      created_at: idea.createdAt || new Date().toISOString(),
      updated_at: idea.updatedAt || idea.createdAt || new Date().toISOString(),
      legacy_key: `${idea.id || 'idea'}:${idea.sectionIndex}:${idea.subsectionIndex}`,
    }));
    const { error } = await supabase.from('idea_notes').upsert(rows, { onConflict: 'legacy_key' });
    if (error) throw error;
    setStatus(`Migration complete: ${rows.length} ideas copied.`);
  } catch (error) {
    setStatus(`Migration failed: ${error.message}`, true);
  } finally {
    migrateButton.disabled = false;
  }
}

refreshButton.addEventListener('click', renderPreview);
migrateButton.addEventListener('click', migrate);
renderPreview();
