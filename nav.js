import { supabase } from './supabase-client.js';

// Inject a consistent top navigation across pages
const containerId = 'global-nav';
function makeNav(){
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  const brandWrap = document.createElement('div');
  brandWrap.className = 'site-brand';
  const logo = document.createElement('img');
  logo.src = 'assets/Copilot_20260913_133023.png';
  logo.alt = 'Black Lotus BJJ';
  logo.className = 'site-logo';
  brandWrap.appendChild(logo);

  const nav = document.createElement('nav');
  nav.className = 'topnav';
  nav.setAttribute('aria-label','Main navigation');
  const navToggle = document.createElement('button');
  navToggle.type = 'button';
  navToggle.className = 'nav-toggle';
  navToggle.setAttribute('aria-expanded', 'false');
  navToggle.setAttribute('aria-controls', 'site-navigation');
  navToggle.textContent = 'Menu';
  nav.id = 'site-navigation';

  const a1 = document.createElement('a');
  a1.href = 'index.html';
  a1.className = 'nav-link';
  a1.textContent = 'Kids Attendanece';

  const a2 = document.createElement('a');
  a2.href = 'promotion.html';
  a2.className = 'nav-link';
  a2.textContent = 'Kids Promotions';

  const a3 = document.createElement('a');
  a3.href = 'class-notes.html';
  a3.className = 'nav-link';
  a3.textContent = 'Kids Class Notes';

  const a4 = document.createElement('a');
  a4.href = 'idea-notebook.html';
  a4.className = 'nav-link';
  a4.textContent = 'Idea Notebook';

  const a5 = document.createElement('a');
  a5.href = 'admin.html';
  a5.className = 'nav-link';
  a5.textContent = 'Admin';

  const a6 = document.createElement('a');
  a6.href = 'adult-attendance.html';
  a6.className = 'nav-link';
  a6.textContent = 'Adult Attendance';

  const a7 = document.createElement('a');
  a7.href = 'adult-promotions.html';
  a7.className = 'nav-link';
  a7.textContent = 'Adult Promotions';

  const a8 = document.createElement('a');
  a8.href = 'adult-class-notes.html';
  a8.className = 'nav-link';
  a8.textContent = 'Adult Class Notes';
  const a9 = document.createElement('a');
  a9.href = 'calendar.html';
  a9.className = 'nav-link';
  a9.textContent = 'Calendar';
  const a10 = document.createElement('a');
  a10.href = 'waiver.html';
  a10.className = 'nav-link';
  a10.textContent = 'Waivers';
  const a11 = document.createElement('a');
  a11.href = 'student-info.html';
  a11.className = 'nav-link';
  a11.textContent = 'Student Info';

  const signOut = document.createElement('button');
  signOut.type = 'button';
  signOut.className = 'nav-link';
  signOut.textContent = 'Sign out';
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    await supabase.auth.signOut();
    window.location.replace('login.html');
  });

  // highlight current (Attendance, Promotions, Class Notes, Idea Notebook, Admin order)
  try{
    const cur = window.location.pathname.split('/').pop() || 'index.html';
    if (cur.startsWith('promotion') && !cur.startsWith('adult-')) a2.classList.add('active');
    else if (cur.startsWith('class-notes')) a3.classList.add('active');
    else if (cur.startsWith('idea-notebook')) a4.classList.add('active');
    else if (cur.startsWith('admin')) a5.classList.add('active');
    else if (cur.startsWith('adult-attendance')) a6.classList.add('active');
    else if (cur.startsWith('adult-promotions')) a7.classList.add('active');
    else if (cur.startsWith('adult-class-notes')) a8.classList.add('active');
    else if (cur.startsWith('calendar')) a9.classList.add('active');
    else if (cur.startsWith('waiver')) a10.classList.add('active');
    else if (cur.startsWith('student-info')) a11.classList.add('active');
    else a1.classList.add('active');
  } catch(e){}

  nav.appendChild(a6);
  nav.appendChild(a1);
  nav.appendChild(a11);
  nav.appendChild(a9);
  nav.appendChild(a10);
  nav.appendChild(a8);
  nav.appendChild(a3);
  nav.appendChild(a4);
  nav.appendChild(a5);
  nav.appendChild(signOut);

  const wrapper = document.createElement('div');
  wrapper.className = 'header-nav-wrapper';
  wrapper.appendChild(brandWrap);
  navToggle.addEventListener('click', () => {
    const open = wrapper.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  wrapper.appendChild(navToggle);
  wrapper.appendChild(nav);
  container.appendChild(wrapper);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', makeNav);
else makeNav();

// Ensure no horizontal page scroll is introduced by content on any page
try{ document.documentElement.style.overflowX = 'hidden'; document.body.style.overflowX = 'hidden'; }catch(e){}

export default { makeNav };
