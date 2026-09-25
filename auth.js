import { supabase } from './supabase-client.js';

const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const newPasswordRow = document.getElementById('newPasswordRow');
const newPasswordInput = document.getElementById('newPassword');
const description = document.getElementById('loginDescription');
const status = document.getElementById('loginStatus');
const submitButton = form.querySelector('button[type="submit"]');
let recoveryMode = false;

function isRecoveryLink() {
  return new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('auth-error', isError);
}

async function redirectIfSignedIn() {
  if (isRecoveryLink()) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('active, role')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !profile?.active) {
    await supabase.auth.signOut();
    return;
  }

  window.location.href = 'index.html';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus(recoveryMode ? 'Updating password...' : 'Signing in...');

  if (recoveryMode) {
    const { error } = await supabase.auth.updateUser({ password: newPasswordInput.value });
    if (error) {
      submitButton.disabled = false;
      setStatus(error.message, true);
      return;
    }
    await supabase.auth.signOut();
    recoveryMode = false;
    newPasswordRow.hidden = true;
    newPasswordInput.required = false;
    passwordInput.hidden = false;
    passwordInput.required = true;
    description.textContent = 'Your password was updated. Sign in to continue.';
    submitButton.textContent = 'Sign in';
    setStatus('Password updated successfully.');
    submitButton.disabled = false;
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: emailInput.value.trim(),
    password: passwordInput.value,
  });

  if (error) {
    submitButton.disabled = false;
    setStatus(error.message, true);
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('active')
    .eq('user_id', data.user.id)
    .maybeSingle();

  if (profileError || !profile?.active) {
    await supabase.auth.signOut();
    submitButton.disabled = false;
    setStatus('Your account is not enabled for this app.', true);
    return;
  }

  setStatus('Signed in. Opening the app...');
  window.location.href = 'index.html';
});

redirectIfSignedIn();

function showRecoveryForm() {
  recoveryMode = true;
  description.textContent = 'Choose a new password for your account.';
  passwordInput.hidden = true;
  passwordInput.required = false;
  newPasswordRow.hidden = false;
  newPasswordInput.required = true;
  submitButton.textContent = 'Update password';
  setStatus('');
}

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') showRecoveryForm();
});

if (isRecoveryLink()) showRecoveryForm();
