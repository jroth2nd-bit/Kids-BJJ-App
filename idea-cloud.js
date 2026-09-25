import { supabase } from './supabase-client.js';

export async function syncFromCloud(storageKey) {
  const { data, error } = await supabase.from('idea_notes').select('id, title, content, created_at, updated_at, legacy_key').order('created_at');
  if (error) throw error;
  const sections = new Map();
  data.forEach((idea) => {
    const separator = String(idea.title || '').indexOf(' / ');
    const sectionTitle = separator >= 0 ? idea.title.slice(0, separator) : 'Ideas';
    const subsectionTitle = separator >= 0 ? idea.title.slice(separator + 3) : idea.title || 'Untitled idea';
    if (!sections.has(sectionTitle)) sections.set(sectionTitle, { id: `section_cloud_${sections.size}`, title: sectionTitle, subsections: [] });
    sections.get(sectionTitle).subsections.push({ id: idea.legacy_key || `idea_cloud_${idea.id}`, title: subsectionTitle, content: idea.content || '', createdAt: idea.created_at, updatedAt: idea.updated_at });
  });
  const notebook = { sections: [...sections.values()] };
  localStorage.setItem(storageKey, JSON.stringify(notebook));
  return notebook;
}

export async function syncLocalNotebook(notebook) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user found');
  const rows = [];
  notebook.sections.forEach((section, sectionIndex) => section.subsections.forEach((idea, subsectionIndex) => rows.push({
    title: `${section.title || 'Untitled section'} / ${idea.title || 'Untitled idea'}`,
    content: idea.content || '',
    created_by: user.id,
    created_at: idea.createdAt || new Date().toISOString(),
    updated_at: idea.updatedAt || new Date().toISOString(),
    legacy_key: `${idea.id || 'idea'}:${sectionIndex}:${subsectionIndex}`,
  })));
  if (!rows.length) return;
  const { error } = await supabase.from('idea_notes').upsert(rows, { onConflict: 'legacy_key' });
  if (error) throw error;
}
