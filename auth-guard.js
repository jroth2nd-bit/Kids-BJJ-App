import { supabase } from './supabase-client.js';

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.replace('login.html');
} else {
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('active')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !profile?.active) {
    await supabase.auth.signOut();
    window.location.replace('login.html');
  }
}
