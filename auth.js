import { supabase } from './supabase-client.js';

const form = document.getElementById('loginForm');
const emailRow = document.getElementById('emailRow');
const emailInput = document.getElementById('email');
const passwordRow = document.getElementById('passwordRow');
const passwordInput = document.getElementById('password');
const newPasswordRow = document.getElementById('newPasswordRow');
const newPasswordInput = document.getElementById('newPassword');
const passwordConfirmRow = document.getElementById('passwordConfirmRow');
const passwordConfirmInput = document.getElementById('passwordConfirm');
const description = document.getElementById('loginDescription');
const status = document.getElementById('loginStatus');
const submitButton = form.querySelector('button[type="submit"]');
const forgotPasswordButton = document.getElementById('forgotPassword');
const backToSignInButton = document.getElementById('backToSignIn');
let mode = 'login';

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
  setStatus(mode === 'reset' ? 'Updating password...' : mode === 'forgot' ? 'Sending reset email...' : 'Signing in...');

  if (mode === 'reset') {
    if (newPasswordInput.value !== passwordConfirmInput.value) {
      submitButton.disabled = false;
      setStatus('The new passwords do not match.', true);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPasswordInput.value });
    if (error) {
      submitButton.disabled = false;
      setStatus(error.message, true);
      return;
    }
    await supabase.auth.signOut();
    setLoginMode();
    description.textContent = 'Your password was updated. Sign in to continue.';
    setStatus('Password updated successfully.');
    submitButton.disabled = false;
    return;
  }

  if (mode === 'forgot') {
    const { error } = await supabase.auth.resetPasswordForEmail(emailInput.value.trim(), {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    submitButton.disabled = false;
    if (error) {
      setStatus(error.message, true);
      return;
    }
    setStatus('If an account exists for that email, a password reset link has been sent.');
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
  mode = 'reset';
  description.textContent = 'Choose a new password for your account.';
  emailRow.hidden = true;
  passwordRow.hidden = true;
  forgotPasswordButton.hidden = true;
  backToSignInButton.hidden = false;
  passwordInput.required = false;
  newPasswordRow.hidden = false;
  newPasswordInput.required = true;
  passwordConfirmRow.hidden = false;
  passwordConfirmInput.required = true;
  submitButton.textContent = 'Update password';
  setStatus('');
}

function setLoginMode() {
  mode = 'login';
  emailRow.hidden = false;
  passwordRow.hidden = false;
  passwordInput.required = true;
  newPasswordRow.hidden = true;
  newPasswordInput.required = false;
  passwordConfirmRow.hidden = true;
  passwordConfirmInput.required = false;
  forgotPasswordButton.hidden = false;
  backToSignInButton.hidden = true;
  submitButton.textContent = 'Sign in';
}

forgotPasswordButton.addEventListener('click', () => {
  mode = 'forgot';
  description.textContent = 'Enter your email and we will send a password reset link.';
  passwordRow.hidden = true;
  passwordInput.required = false;
  newPasswordRow.hidden = true;
  newPasswordInput.required = false;
  passwordConfirmRow.hidden = true;
  passwordConfirmInput.required = false;
  forgotPasswordButton.hidden = true;
  backToSignInButton.hidden = false;
  submitButton.textContent = 'Send reset link';
  setStatus('');
  emailInput.focus();
});

backToSignInButton.addEventListener('click', () => {
  setLoginMode();
  description.textContent = 'Sign in to manage the academy app.';
  setStatus('');
});

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') showRecoveryForm();
});

if (isRecoveryLink()) showRecoveryForm();
