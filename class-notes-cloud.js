import { supabase } from './supabase-client.js';

export async function syncFromCloud(program, storageKey) {
  const { data, error } = await supabase
    .from('class_notes')
    .select('program, class_date, session_id, title, content, created_at, updated_at')
    .eq('program', program)
    .order('class_date', { ascending: false });
  if (error) throw error;
  const notes = data.map((note) => ({
    key: `${note.class_date}::${note.session_id}`,
    date: note.class_date,
    sessionId: note.session_id,
    className: program === 'kids' ? 'Kids Class' : note.session_id,
    coach: '',
    title: note.title,
    content: note.content,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
  }));
  localStorage.setItem(storageKey, JSON.stringify(notes));
  return notes;
}

export async function syncLocalNotes(program, notes) {
  const rows = notes.map((note) => ({
    program,
    class_date: note.date,
    session_id: note.sessionId || (program === 'kids' ? 'kids-class' : 'adult-class'),
    title: String(note.title || ''),
    content: String(note.content || ''),
    created_at: note.createdAt || new Date().toISOString(),
    updated_at: note.updatedAt || note.createdAt || new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from('class_notes').upsert(rows, { onConflict: 'program,class_date,session_id' });
  if (error) throw error;
}
