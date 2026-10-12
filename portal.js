/* =====================================================================
   SETU PORTAL — mentor & admin dashboards
   Plain JavaScript, no libraries. Talks to the Apps Script in
   apps-script/Code.gs (portal section). Settings come from config.js.
   ===================================================================== */

const CFG = window.SETU_CONFIG || {};
const API = CFG.SCRIPT_URL || '';
const TOKEN_KEY = 'setu-portal-token';

/* App state */
const S = {
  token: null,
  user: null,        // { email, name, isAdmin, isMentor }
  acting: null,      // when an admin opens a mentor's dashboard: that mentor's email
  dash: null,        // mentor dashboard data
  admin: null,       // admin data
};

/* =====================================================================
   HELPERS
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const ids = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
const first = name => String(name || '').trim().split(/\s+/)[0] || '';
const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const plural = (n, w, p) => `${n} ${n === 1 ? w : (p || w + 's')}`;
const by = (key, dir = 1) => (a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0);

/* All dates are India time, stored as "YYYY-MM-DDTHH:mm" */
const nowIst = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 16);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function parts(s) { const p = String(s || '').split(/[-T: ]/).map(Number); return { y: p[0], m: p[1], d: p[2], h: p[3] || 0, mi: p[4] || 0 }; }
function fmtDate(s, withDay = true) {
  if (!s) return '—';
  const p = parts(s);
  if (!p.y) return esc(s);
  const wd = DAY[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return `${withDay ? wd + ', ' : ''}${p.d} ${MON[p.m - 1]} ${p.y}`;
}
function fmtTime(s) { const p = parts(s); return `${(p.h + 11) % 12 + 1}:${String(p.mi).padStart(2, '0')} ${p.h < 12 ? 'am' : 'pm'}`; }
function fmtWhen(s) { return `${fmtDate(s)} · ${fmtTime(s)}`; }
function relative(s) {
  const a = Date.parse(s + ':00Z'), b = Date.parse(nowIst() + ':00Z');
  const mins = Math.round((a - b) / 60000);
  const abs = Math.abs(mins);
  const txt = abs < 60 ? plural(abs, 'minute') : abs < 1440 ? plural(Math.round(abs / 60), 'hour') : plural(Math.round(abs / 1440), 'day');
  return mins >= 0 ? `in ${txt}` : `${txt} ago`;
}

let toastTimer;
function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.toggle('is-error', !!isError);
  t.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-shown'), isError ? 5000 : 2800);
}

const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 5.5 5.8"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M8 14h8"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  cap: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5M22 9v5"/>',
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
};
const svg = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[name]}</svg>`;
const BRIDGE = '<svg viewBox="0 0 120 50" aria-hidden="true"><path d="M6 40Q60 0 114 40M2 40h116M30 40V24M60 40V19M90 40V24"/></svg>';

/* =====================================================================
   TALKING TO THE SERVER
   ===================================================================== */
const MENTOR_SCOPED = /^(mentor|meeting|remark|project)\./;

async function api(action, data = {}) {
  if (!/^(https:\/\/|http:\/\/localhost)/.test(API)) throw new Error('The portal is not connected yet — set SCRIPT_URL in config.js.');
  const body = Object.assign({ action, token: S.token }, data);
  if (S.acting && MENTOR_SCOPED.test(action) && !body.mentorEmail) body.mentorEmail = S.acting;
  let json;
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    json = await res.json();
  } catch (e) {
    throw new Error('Couldn\'t reach the server. Please check your connection and try again.');
  }
  if (json.status !== 'success') {
    if (json.auth) { signedOut(json.message); }
    throw new Error(json.message || 'Something went wrong.');
  }
  return json;
}

async function loadDash(force) {
  if (S.dash && !force) return S.dash;
  S.dash = await api('mentor.dashboard');
  return S.dash;
}
async function loadAdmin(force) {
  if (S.admin && !force) return S.admin;
  S.admin = await api('admin.data');
  return S.admin;
}

/* =====================================================================
   SIGN IN
   ===================================================================== */
let loginEmail = '';
let resendAt = 0;

function showLogin(msg, isError) {
  $('#shell').hidden = true;
  $('#login').hidden = false;
  $('#emailForm').hidden = false;
  $('#codeForm').hidden = true;
  setLoginMsg(msg || (!/^(https:\/\/|http:\/\/localhost)/.test(API) ? 'The portal is not connected yet — set SCRIPT_URL in config.js.' : ''), isError);
  setTimeout(() => $('#loginEmail').focus(), 50);
}
function setLoginMsg(msg, isError) {
  const el = $('#loginMsg');
  el.textContent = msg || '';
  el.classList.toggle('is-error', !!isError);
}
function busy(btn, on, label) {
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label || 'Please wait…'; btn.classList.add('is-loading'); btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.classList.remove('is-loading'); btn.disabled = false; }
}

async function requestCode(btn) {
  const email = $('#loginEmail').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setLoginMsg('Please enter a valid email address.', true);
  busy(btn, true, 'Sending…');
  setLoginMsg('');
  try {
    const r = await api('auth.requestCode', { email });
    loginEmail = email;
    resendAt = Date.now() + 30000;
    $('#emailForm').hidden = true;
    $('#codeForm').hidden = false;
    $('#codeHint').textContent = `Sent to ${email} (if it's registered). Check your inbox and spam folder.`;
    setLoginMsg(r.message);
    $('#loginCode').value = '';
    $('#loginCode').focus();
  } catch (e) { setLoginMsg(e.message, true); }
  busy(btn, false);
}

async function verifyCode(btn) {
  const code = $('#loginCode').value.replace(/\D/g, '');
  if (code.length !== 6) return setLoginMsg('Please enter the 6-digit code.', true);
  busy(btn, true, 'Signing in…');
  try {
    const r = await api('auth.verify', { email: loginEmail, code });
    S.token = r.token;
    store.set(TOKEN_KEY, r.token);
    startApp(r.user);
  } catch (e) { setLoginMsg(e.message, true); }
  busy(btn, false);
}

function signedOut(msg) {
  store.del(TOKEN_KEY);
  Object.assign(S, { token: null, user: null, acting: null, dash: null, admin: null });
  showLogin(msg, !!msg);
}

async function logout() {
  try { await api('auth.logout'); } catch (e) {}
  signedOut();
  toast('Signed out. See you soon 🙏');
}

/* =====================================================================
   APP SHELL & ROUTER
   ===================================================================== */
function startApp(user) {
  S.user = user;
  $('#login').hidden = true;
  $('#shell').hidden = false;
  $('#userAvatar').textContent = initials(user.name || user.email);
  $('#userName').textContent = user.name || 'Admin';
  $('#userEmail').textContent = user.email;
  $('#modeSwitch').hidden = !(user.isAdmin && user.isMentor);
  if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = homeRoute();
  else route();
}
const homeRoute = () => (S.user.isMentor ? '#/home' : '#/admin');

function navLinks(mode) {
  const items = mode === 'admin'
    ? [['#/admin', 'chart', 'Overview'], ['#/admin/mentors', 'shield', 'Mentors'], ['#/admin/students', 'cap', 'Students'], ['#/admin/meetings', 'report', 'Meetings']]
    : [['#/home', 'home', 'Home'], ['#/mentees', 'users', 'Mentees'], ['#/meetings', 'calendar', 'Meetings'], ['#/projects', 'folder', 'Projects']];
  const cur = location.hash.split('/').slice(0, 3).join('/');
  return items.map(([href, icon, label]) => {
    const on = cur === href || (href !== '#/admin' && cur.startsWith(href.replace(/s$/, '')));
    return `<a href="${href}" class="${on ? 'is-on' : ''}" ${on ? 'aria-current="page"' : ''}>${svg(icon)}<span>${label}</span></a>`;
  }).join('');
}

function renderChrome(mode) {
  $('#nav').innerHTML = navLinks(mode);
  $$('#modeSwitch a').forEach(a => a.classList.toggle('is-on', a.dataset.mode === mode));
  const bar = $('#actingBar');
  if (mode === 'mentor' && S.acting && S.dash) {
    bar.hidden = false;
    bar.innerHTML = `<span>Admin view of <strong>${esc(S.dash.mentor.name)}</strong>'s dashboard</span><button type="button" data-act="exit-acting">Back to admin</button>`;
  } else bar.hidden = true;
}

async function route() {
  if (!S.user) return;
  const [, area, a, b] = location.hash.replace(/^#/, '').split('/');
  const view = $('#view');
  const isAdminRoute = area === 'admin';
  if (isAdminRoute && !S.user.isAdmin) return (location.hash = '#/home');
  if (!isAdminRoute && !S.user.isMentor && !S.acting) return (location.hash = '#/admin');
  if (isAdminRoute && S.acting) { S.acting = null; S.dash = null; }

  renderChrome(isAdminRoute ? 'admin' : 'mentor');
  if (!(isAdminRoute ? S.admin : S.dash)) view.innerHTML = '<div class="skeleton"><div></div><div></div><div></div></div>';
  try {
    let html;
    if (isAdminRoute) {
      await loadAdmin();
      html = a === 'mentors' ? adminMentors() : a === 'students' ? adminStudents() : a === 'meetings' ? adminMeetings() : adminOverview();
    } else {
      await loadDash();
      renderChrome('mentor');
      html = ({
        home: mentorHome, mentees: menteesView, mentee: () => menteeView(a), meetings: meetingsView,
        meeting: () => meetingView(a), projects: projectsView, project: () => projectView(a),
      }[area] || mentorHome)();
    }
    view.innerHTML = html;
    afterRender();
  } catch (e) {
    if (S.user) view.innerHTML = `<div class="error-box">${esc(e.message)} <button class="btn btn--sm btn--line" data-act="retry">Try again</button></div>`;
  }
}

/* Small things that need to happen after a view is drawn */
function afterRender() {
  $$('.rate').forEach(paintStars);
  updateAdminSelection();
}

/* =====================================================================
   MENTOR — data helpers
   ===================================================================== */
function D() { return S.dash; }
function student(id) { return D().students.find(s => s.id === id); }
function meetingStudents(m) { return ids(m.studentIds).map(student).filter(Boolean); }
function feedbackFor(meetingId, studentId) { return D().feedback.find(f => f.meetingId === meetingId && f.studentId === studentId); }
function meetingState(m) {
  const now = nowIst();
  if (m.status === 'Cancelled') return 'cancelled';
  if (m.status === 'Completed') return 'completed';
  if (m.end && m.end <= now) return 'needs-report';
  if (m.start <= now) return 'live';
  return 'upcoming';
}
const STATE_PILL = {
  upcoming: '<span class="pill pill--info">Upcoming</span>',
  live: '<span class="pill pill--good">Happening now</span>',
  'needs-report': '<span class="pill pill--warn">Report pending</span>',
  completed: '<span class="pill pill--good">Completed</span>',
  cancelled: '<span class="pill pill--bad">Cancelled</span>',
};
function upcomingMeetings() { return D().meetings.filter(m => ['upcoming', 'live'].includes(meetingState(m))).sort(by('start')); }
function pendingReports() { return D().meetings.filter(m => meetingState(m) === 'needs-report').sort(by('start', -1)); }
function pastMeetings() { return D().meetings.filter(m => ['completed', 'cancelled'].includes(meetingState(m))).sort(by('start', -1)); }

function studentStats(sid) {
  const done = D().meetings.filter(m => m.status === 'Completed' && ids(m.studentIds).includes(sid));
  const fb = done.map(m => feedbackFor(m.id, sid)).filter(Boolean);
  const attended = fb.filter(f => f.attended === 'Yes').length;
  const ratings = fb.map(f => Number(f.rating)).filter(Boolean);
  return {
    held: done.length, attended,
    rate: done.length ? Math.round((attended / done.length) * 100) : null,
    avg: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : null,
  };
}
const stars = n => {
  const v = Math.round(Number(n) || 0);
  if (!v) return '<span class="muted small">No rating</span>';
  return `<span class="stars" aria-label="${v} out of 5">${'★'.repeat(v)}<span class="off">${'★'.repeat(5 - v)}</span></span>`;
};
const studentLine = s => [s.department, s.programme, s.year && `Year ${s.year}`].filter(Boolean).map(esc).join(' · ');
function emptyState(text, btn) {
  return `<div class="empty">${BRIDGE}<p>${text}</p>${btn || ''}</div>`;
}

/* =====================================================================
   MENTOR — views
   ===================================================================== */
function mentorHome() {
  const d = D(), up = upcomingMeetings(), next = up[0], pending = pendingReports();
  const held = d.meetings.filter(m => m.status === 'Completed').length;
  const activeProjects = d.projects.filter(p => p.status !== 'Completed').length;
  const hour = Number(nowIst().slice(11, 13));
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const nextCard = next ? `
    <div class="next">
      <p class="eyebrow">${meetingState(next) === 'live' ? 'Happening now' : 'Next meeting'}</p>
      <h2 class="next__title">${esc(next.title)}</h2>
      <p class="next__when">${fmtWhen(next.start)} – ${fmtTime(next.end)} IST · ${plural(meetingStudents(next).length, 'student')}</p>
      <span class="next__count">${relative(next.start)}</span>
      <div class="actions">
        <a class="btn btn--gold" href="${esc(next.meetLink)}" target="_blank" rel="noopener">Join meeting</a>
        <a class="btn btn--line" href="#/meeting/${esc(next.id)}">Details</a>
      </div>
    </div>` : `
    <div class="next">
      <p class="eyebrow">No meetings scheduled</p>
      <h2 class="next__title">${d.students.length ? 'Time to meet your mentees?' : 'Your mentees will appear here soon'}</h2>
      <p class="next__when">${d.students.length ? 'Pick a time — everyone gets an email with the Google Meet link.' : 'The Setu team is matching students with you.'}</p>
      ${d.students.length ? '<div class="actions"><button class="btn btn--gold" data-act="schedule">Schedule a meeting</button></div>' : ''}
    </div>`;

  return `
    <div class="page-head"><div>
      <p class="eyebrow">${greet}</p>
      <h1 class="page-title">Namaste, ${esc(first(d.mentor.name))} 🙏</h1>
    </div>${d.students.length ? '<button class="btn btn--dark" data-act="schedule">+ Schedule meeting</button>' : ''}</div>
    ${nextCard}
    <div class="section stats">
      <a class="stat" href="#/mentees"><div class="stat__num">${d.students.length}</div><div class="stat__label">Mentees</div></a>
      <a class="stat" href="#/meetings"><div class="stat__num">${held}</div><div class="stat__label">Meetings held</div></a>
      <a class="stat" href="#/meetings"><div class="stat__num">${up.length}</div><div class="stat__label">Upcoming</div></a>
      <a class="stat" href="#/projects"><div class="stat__num">${activeProjects}</div><div class="stat__label">Active projects</div></a>
    </div>
    ${pending.length ? `<div class="section"><h2 class="section-title">Reports waiting for you</h2>
      ${pending.map(m => `<a class="card card-link row" href="#/meeting/${esc(m.id)}">
        <div class="grow"><p class="name">${esc(m.title)}</p><p class="meta">${fmtWhen(m.start)}</p></div>
        <span class="btn btn--sm btn--gold">Write report</span></a>`).join('')}</div>` : ''}
    <div class="section"><h2 class="section-title">Your mentees <a href="#/mentees">See all</a></h2>
      ${d.students.length ? `<div class="cards cards--3">${d.students.slice(0, 6).map(menteeCard).join('')}</div>` : emptyState('No students assigned yet. We\'ll email you when they are.')}
    </div>`;
}

function menteeCard(s) {
  const st = studentStats(s.id);
  const lastRemark = D().remarks.filter(r => r.studentId === s.id).sort(by('createdOn', -1))[0];
  return `<a class="card card-link" href="#/mentee/${esc(s.id)}">
    <div class="row"><span class="avatar">${esc(initials(s.name))}</span>
      <div class="grow"><p class="name">${esc(s.name)}</p><p class="meta">${studentLine(s) || '&nbsp;'}</p></div></div>
    <p class="meta" style="margin-top:10px">${st.held ? `Attended ${st.attended}/${st.held} meetings` : 'No meetings yet'}${st.avg ? ' · ' + stars(st.avg) : ''}</p>
    ${lastRemark ? `<p class="small" style="margin-top:6px;color:var(--ink)">“${esc(lastRemark.remark.slice(0, 90))}${lastRemark.remark.length > 90 ? '…' : ''}”</p>` : ''}
  </a>`;
}

function menteesView() {
  const list = D().students.slice().sort(by('name'));
  return `<div class="page-head"><div><h1 class="page-title">My mentees</h1><p class="page-sub">${plural(list.length, 'student')} assigned to you</p></div></div>
    ${list.length ? `<div class="cards cards--3">${list.map(menteeCard).join('')}</div>` : emptyState('No students assigned yet. The Setu team will assign mentees and email you.')}`;
}

function menteeView(id) {
  const s = student(id);
  if (!s) return `<a class="back" href="#/mentees">← Mentees</a>${emptyState('This student isn\'t in your list.')}`;
  const st = studentStats(id);
  const remarks = D().remarks.filter(r => r.studentId === id).sort(by('createdOn', -1));
  const meetings = D().meetings.filter(m => ids(m.studentIds).includes(id) && m.status === 'Completed').sort(by('start', -1));
  const projects = D().projects.filter(p => ids(p.studentIds).includes(id));
  return `<a class="back" href="#/mentees">← Mentees</a>
    <div class="card"><div class="row row--top">
      <span class="avatar avatar--lg">${esc(initials(s.name))}</span>
      <div class="grow"><h1 class="page-title" style="font-size:1.9rem">${esc(s.name)}</h1><p class="meta">${studentLine(s)}</p></div></div>
      <dl class="kv" style="margin-top:14px">
        ${s.rollNo ? `<dt>Roll no.</dt><dd>${esc(s.rollNo)}</dd>` : ''}
        <dt>Email</dt><dd><a href="mailto:${esc(s.email)}">${esc(s.email)}</a></dd>
        ${s.phone ? `<dt>Phone</dt><dd><a href="tel:${esc(s.phone)}">${esc(s.phone)}</a></dd>` : ''}
        <dt>Attendance</dt><dd>${st.held ? `${st.attended} of ${st.held} meetings (${st.rate}%)` : 'No meetings yet'}</dd>
        <dt>Avg. rating</dt><dd>${st.avg ? stars(st.avg) + ` <span class="muted small">${st.avg.toFixed(1)}</span>` : '—'}</dd>
      </dl>
    </div>

    <div class="section"><h2 class="section-title">Remarks</h2>
      <form class="card" data-form="remark" data-student="${esc(id)}">
        <label class="field__label" for="remarkText">Add a remark about ${esc(first(s.name))}</label>
        <textarea class="input" id="remarkText" name="remark" maxlength="2000" placeholder="Strengths, areas to grow, anything to remember…" style="margin-top:6px" required></textarea>
        <div class="actions"><button class="btn btn--dark btn--sm" type="submit">Save remark</button></div>
      </form>
      ${remarks.length ? `<ul class="timeline" style="margin-top:12px">${remarks.map(r => `<li>
        <div class="row"><time class="grow">${fmtWhen(r.createdOn)}</time>
        <button class="linkbtn small" data-act="delete-remark" data-id="${esc(r.id)}">Delete</button></div>
        <p class="prewrap">${esc(r.remark)}</p></li>`).join('')}</ul>` : '<p class="muted small" style="margin-top:10px">No remarks yet.</p>'}
    </div>

    <div class="section"><h2 class="section-title">Meeting feedback</h2>
      ${meetings.length ? `<ul class="timeline">${meetings.map(m => {
        const f = feedbackFor(m.id, id);
        return `<li><div class="row"><a class="grow name" href="#/meeting/${esc(m.id)}">${esc(m.title)}</a>
          ${f ? (f.attended === 'Yes' ? '<span class="pill pill--good">Attended</span>' : '<span class="pill pill--bad">Absent</span>') : '<span class="pill">No entry</span>'}</div>
          <time>${fmtDate(m.start)}</time>
          ${f ? `<p style="margin-top:4px">${stars(f.rating)}</p>${f.feedback ? `<p class="prewrap">${esc(f.feedback)}</p>` : ''}` : ''}</li>`;
      }).join('')}</ul>` : '<p class="muted small">Feedback appears here after you write meeting reports.</p>'}
    </div>

    <div class="section"><h2 class="section-title">Projects</h2>
      ${projects.length ? `<div class="cards">${projects.map(projectCard).join('')}</div>` : '<p class="muted small">Not part of any project yet.</p>'}
    </div>`;
}

function meetingCard(m) {
  const state = meetingState(m);
  return `<a class="card card-link" href="#/meeting/${esc(m.id)}">
    <div class="row"><p class="name grow">${esc(m.title)}</p>${STATE_PILL[state]}</div>
    <p class="meta">${fmtWhen(m.start)} – ${fmtTime(m.end)} · ${plural(ids(m.studentIds).length, 'student')}</p>
    ${state === 'completed' && m.summary ? `<p class="small" style="margin-top:8px">${esc(m.summary.slice(0, 140))}${m.summary.length > 140 ? '…' : ''}</p>` : ''}
    ${state === 'upcoming' || state === 'live' ? `<p class="small" style="margin-top:6px;color:var(--terracotta-dk)">${relative(m.start)}</p>` : ''}
  </a>`;
}

function meetingsView() {
  const up = upcomingMeetings(), pending = pendingReports(), past = pastMeetings();
  const canSchedule = D().students.length > 0;
  return `<div class="page-head"><div><h1 class="page-title">Meetings</h1><p class="page-sub">Everyone invited gets an email with the Google Meet link.</p></div>
      ${canSchedule ? '<button class="btn btn--dark" data-act="schedule">+ Schedule meeting</button>' : ''}</div>
    ${pending.length ? `<div class="section"><h2 class="section-title">Report pending</h2><div class="cards">${pending.map(meetingCard).join('')}</div></div>` : ''}
    <div class="section"><h2 class="section-title">Upcoming</h2>
      ${up.length ? `<div class="cards">${up.map(meetingCard).join('')}</div>` : emptyState('No upcoming meetings.', canSchedule ? '<button class="btn btn--gold" data-act="schedule">Schedule a meeting</button>' : '')}</div>
    <div class="section"><h2 class="section-title">Past meetings</h2>
      ${past.length ? `<div class="cards">${past.map(meetingCard).join('')}</div>` : '<p class="muted small">Past meetings and their notes will appear here.</p>'}</div>`;
}

function meetingView(id) {
  const m = D().meetings.find(x => x.id === id);
  if (!m) return `<a class="back" href="#/meetings">← Meetings</a>${emptyState('Meeting not found.')}`;
  const state = meetingState(m), people = meetingStudents(m);
  const canReport = ['live', 'needs-report', 'completed'].includes(state);
  const head = `<a class="back" href="#/meetings">← Meetings</a>
    <div class="card">
      <div class="row"><h1 class="page-title grow" style="font-size:1.9rem">${esc(m.title)}</h1>${STATE_PILL[state]}</div>
      <p class="meta">${fmtWhen(m.start)} – ${fmtTime(m.end)} IST · ${m.duration} min</p>
      ${m.agenda ? `<p class="prewrap" style="margin-top:12px">${esc(m.agenda)}</p>` : ''}
      <p class="small" style="margin-top:12px"><strong>Invited:</strong> ${people.map(p => esc(p.name)).join(', ') || '—'}</p>
      ${state !== 'cancelled' && state !== 'completed' ? `<div class="actions">
        <a class="btn btn--gold" href="${esc(m.meetLink)}" target="_blank" rel="noopener">Join meeting</a>
        <button class="btn btn--line" data-act="copy" data-text="${esc(m.meetLink)}">Copy link</button>
        ${state === 'upcoming' ? `<button class="btn btn--line" data-act="reschedule" data-id="${esc(m.id)}">Reschedule</button>
        <button class="btn btn--danger" data-act="cancel-meeting" data-id="${esc(m.id)}">Cancel meeting</button>` : ''}
      </div>` : ''}
    </div>`;
  if (!canReport) return head + (state === 'upcoming' ? '<p class="muted small" style="margin-top:16px">After the meeting starts you can write notes here and give each mentee individual feedback.</p>' : '');

  return head + `
    <form class="section" data-form="report" data-id="${esc(m.id)}">
      <h2 class="section-title">Meeting report ${m.reportOn ? `<span class="muted small">Saved ${fmtWhen(m.reportOn)}</span>` : ''}</h2>
      <div class="card">
        <div class="field"><label class="field__label" for="sum">Notes — what did you discuss?</label>
          <textarea class="input" id="sum" name="summary" maxlength="5000" rows="5" placeholder="Topics covered, questions raised, key takeaways…">${esc(m.summary)}</textarea></div>
        <div class="field"><label class="field__label" for="nxt">Next steps <span class="muted">(optional)</span></label>
          <textarea class="input" id="nxt" name="nextSteps" maxlength="2000" rows="3" placeholder="Homework, resources shared, plan for next session…">${esc(m.nextSteps)}</textarea></div>
      </div>
      <h2 class="section-title" style="margin-top:20px">Feedback for each mentee</h2>
      ${people.map(p => {
        const f = feedbackFor(m.id, p.id);
        const attended = f ? f.attended === 'Yes' : true;
        const r = f ? Number(f.rating) || 0 : 0;
        return `<div class="mentee-report ${attended ? '' : 'is-absent'}" data-student="${esc(p.id)}">
          <div class="row"><span class="avatar">${esc(initials(p.name))}</span><p class="name grow">${esc(p.name)}</p>
            <label class="toggle"><input type="checkbox" name="att-${esc(p.id)}" ${attended ? 'checked' : ''}> Attended</label></div>
          <div class="row" style="margin-top:10px;flex-wrap:wrap"><span class="small muted">Engagement</span>
            <div class="rate" role="radiogroup" aria-label="Rating for ${esc(p.name)}">
              ${[1, 2, 3, 4, 5].map(n => `<input type="radio" id="r-${esc(p.id)}-${n}" name="rate-${esc(p.id)}" value="${n}" ${r === n ? 'checked' : ''}><label for="r-${esc(p.id)}-${n}" title="${n} of 5">★</label>`).join('')}
            </div></div>
          <textarea class="input" name="fb-${esc(p.id)}" maxlength="2000" rows="2" placeholder="Individual feedback for ${esc(first(p.name))}…" style="margin-top:10px">${esc(f ? f.feedback : '')}</textarea>
        </div>`;
      }).join('')}
      <div class="actions"><button class="btn btn--gold" type="submit">${m.status === 'Completed' ? 'Update report' : 'Save report'}</button></div>
    </form>`;
}

function projectCard(p) {
  const people = ids(p.studentIds).map(student).filter(Boolean);
  const pill = { 'Completed': 'pill--good', 'In progress': 'pill--info', 'On hold': 'pill--warn' }[p.status] || '';
  const overdue = p.dueDate && p.status !== 'Completed' && p.dueDate < nowIst().slice(0, 10);
  return `<a class="card card-link" href="#/project/${esc(p.id)}">
    <div class="row"><p class="name grow">${esc(p.title)}</p><span class="pill ${pill}">${esc(p.status)}</span></div>
    <div class="row" style="margin:12px 0 6px"><div class="progress grow"><span style="width:${Number(p.progress) || 0}%"></span></div><strong class="small">${Number(p.progress) || 0}%</strong></div>
    <p class="meta">${people.length ? people.map(x => esc(first(x.name))).join(', ') : 'No students yet'}${p.dueDate ? ` · ${overdue ? '<span style="color:var(--danger)">Overdue</span> · ' : ''}Due ${fmtDate(p.dueDate, false)}` : ''}</p>
  </a>`;
}

function projectsView() {
  const list = D().projects.slice().sort((a, b) => (a.status === 'Completed') - (b.status === 'Completed') || (b.updatedOn > a.updatedOn ? 1 : -1));
  return `<div class="page-head"><div><h1 class="page-title">Projects</h1><p class="page-sub">Guide students through real work and track progress.</p></div>
    <button class="btn btn--dark" data-act="project-new">+ New project</button></div>
    ${list.length ? `<div class="cards">${list.map(projectCard).join('')}</div>` : emptyState('No projects yet. Start one with your mentees.', '<button class="btn btn--gold" data-act="project-new">Create a project</button>')}`;
}

function projectView(id) {
  const p = D().projects.find(x => x.id === id);
  if (!p) return `<a class="back" href="#/projects">← Projects</a>${emptyState('Project not found.')}`;
  const people = ids(p.studentIds).map(student).filter(Boolean);
  const updates = D().projectUpdates.filter(u => u.projectId === id).sort(by('createdOn', -1));
  return `<a class="back" href="#/projects">← Projects</a>
    <div class="card">
      <div class="row"><h1 class="page-title grow" style="font-size:1.9rem">${esc(p.title)}</h1><span class="pill">${esc(p.status)}</span></div>
      <div class="row" style="margin:14px 0"><div class="progress grow"><span style="width:${Number(p.progress) || 0}%"></span></div><strong>${Number(p.progress) || 0}%</strong></div>
      ${p.description ? `<p class="prewrap">${esc(p.description)}</p>` : ''}
      <dl class="kv" style="margin-top:12px">
        <dt>Students</dt><dd>${people.map(x => `<a href="#/mentee/${esc(x.id)}">${esc(x.name)}</a>`).join(', ') || '—'}</dd>
        <dt>Start</dt><dd>${fmtDate(p.startDate, false)}</dd><dt>Due</dt><dd>${fmtDate(p.dueDate, false)}</dd>
      </dl>
      <div class="actions">
        <button class="btn btn--gold" data-act="project-update" data-id="${esc(p.id)}">+ Progress report</button>
        <button class="btn btn--line" data-act="project-edit" data-id="${esc(p.id)}">Edit project</button>
      </div>
    </div>
    <div class="section"><h2 class="section-title">Progress reports</h2>
      ${updates.length ? `<ul class="timeline">${updates.map(u => `<li><div class="row"><time class="grow">${fmtWhen(u.createdOn)}</time><strong class="small">${esc(u.progress)}%</strong></div><p class="prewrap">${esc(u.note)}</p></li>`).join('')}</ul>`
        : '<p class="muted small">No progress reports yet. Add one after each milestone.</p>'}
    </div>`;
}

/* =====================================================================
   ADMIN — views
   ===================================================================== */
function A() { return S.admin; }
function mentorByEmail(e) { return A().mentors.find(m => m.email === e); }
function approvedMentors() { return A().mentors.filter(m => m.status === 'Approved').sort(by('name')); }
const MENTOR_PILL = { Approved: 'pill--good', Pending: 'pill--warn', Rejected: 'pill--bad', Inactive: '' };

function adminOverview() {
  const a = A(), now = nowIst();
  const active = a.students.filter(s => s.status !== 'Inactive');
  const approved = a.mentors.filter(m => m.status === 'Approved');
  const pending = a.mentors.filter(m => m.status === 'Pending');
  const held = a.meetings.filter(m => m.status === 'Completed');
  const upcoming = a.meetings.filter(m => m.status === 'Scheduled' && m.start > now);
  const unassigned = active.filter(s => !s.mentorEmail).length;

  // Students by department (single series → one colour, value labels)
  const dept = {};
  active.forEach(s => { const k = s.department || 'Not set'; dept[k] = (dept[k] || 0) + 1; });
  const deptRows = Object.entries(dept).sort((x, y) => y[1] - x[1]);
  const maxD = Math.max(1, ...deptRows.map(r => r[1]));

  // Meetings held per month, last 6 months
  const months = [];
  const p = parts(now);
  for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(p.y, p.m - 1 - i, 1)); months.push(d.toISOString().slice(0, 7)); }
  const perMonth = months.map(mo => held.filter(m => m.start.slice(0, 7) === mo).length);
  const maxM = Math.max(1, ...perMonth);

  const activity = approved.map(m => {
    const mm = a.meetings.filter(x => x.mentorEmail === m.email);
    const done = mm.filter(x => x.status === 'Completed');
    return {
      m, mentees: active.filter(s => s.mentorEmail === m.email).length, held: done.length,
      upcoming: mm.filter(x => x.status === 'Scheduled' && x.start > now).length,
      last: done.map(x => x.start).sort().pop() || '',
      pendingReports: mm.filter(x => x.status === 'Scheduled' && x.end <= now).length,
      projects: a.projects.filter(x => x.mentorEmail === m.email && x.status !== 'Completed').length,
    };
  }).sort((x, y) => y.held - x.held);

  return `<div class="page-head"><div><p class="eyebrow">Admin</p><h1 class="page-title">Setu at a glance</h1></div>
    <button class="btn btn--dark" data-act="schedule-admin">+ Schedule meeting</button></div>
    <div class="stats">
      <a class="stat" href="#/admin/mentors"><div class="stat__num">${approved.length}</div><div class="stat__label">Active mentors</div>${pending.length ? `<div class="stat__sub">${pending.length} awaiting approval</div>` : ''}</a>
      <a class="stat" href="#/admin/students"><div class="stat__num">${active.length}</div><div class="stat__label">Students</div>${unassigned ? `<div class="stat__sub">${unassigned} not yet assigned</div>` : ''}</a>
      <a class="stat" href="#/admin/meetings"><div class="stat__num">${held.length}</div><div class="stat__label">Meetings held</div></a>
      <a class="stat" href="#/admin/meetings"><div class="stat__num">${upcoming.length}</div><div class="stat__label">Upcoming meetings</div></a>
    </div>

    <div class="section cards">
      <div class="card">
        <p class="chart-title">Students by department</p><p class="chart-sub">${plural(active.length, 'active student')}</p>
        ${deptRows.length ? `<div class="hbars">${deptRows.map(([k, v]) => `<div class="hbar" title="${esc(k)}: ${v}">
          <span class="hbar__label">${esc(k)}</span><div class="hbar__track"><div class="hbar__bar" style="width:${(v / maxD) * 100}%"></div></div><span class="hbar__val">${v}</span></div>`).join('')}</div>`
          : '<p class="muted small">Add students to see the breakdown.</p>'}
      </div>
      <div class="card">
        <p class="chart-title">Meetings held per month</p><p class="chart-sub">Last 6 months · ${plural(perMonth.reduce((x, y) => x + y, 0), 'meeting')}</p>
        <div class="vbars">${perMonth.map((v, i) => `<div class="vbar" title="${MON[Number(months[i].slice(5)) - 1]}: ${v}"><span class="vbar__val">${v || ''}</span><div class="vbar__bar" style="height:${(v / maxM) * 100}%"></div></div>`).join('')}</div>
        <div class="vlabels">${months.map(mo => `<span>${MON[Number(mo.slice(5)) - 1]}</span>`).join('')}</div>
      </div>
    </div>

    ${pending.length ? `<div class="section"><h2 class="section-title">Awaiting approval <a href="#/admin/mentors">Review all</a></h2>
      ${pending.slice(0, 4).map(m => `<div class="card row"><span class="avatar avatar--gold">${esc(initials(m.name))}</span>
        <div class="grow"><p class="name">${esc(m.name)}</p><p class="meta">${esc(m.designation)}${m.company ? ', ' + esc(m.company) : ''} · ${esc(m.experience)} yrs</p></div>
        <button class="btn btn--sm btn--gold" data-act="mentor-status" data-email="${esc(m.email)}" data-status="Approved">Approve</button></div>`).join('')}</div>` : ''}

    <div class="section"><h2 class="section-title">Mentor activity</h2>
      ${activity.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Mentor</th><th class="num">Mentees</th><th class="num">Held</th><th class="num">Upcoming</th><th>Last meeting</th><th class="num">Reports due</th><th class="num">Projects</th><th></th></tr></thead><tbody>
        ${activity.map(r => `<tr><td data-label="Mentor"><strong>${esc(r.m.name)}</strong><br><span class="meta">${esc(r.m.company)}</span></td>
          <td class="num" data-label="Mentees">${r.mentees}</td><td class="num" data-label="Held">${r.held}</td><td class="num" data-label="Upcoming">${r.upcoming}</td>
          <td data-label="Last meeting">${r.last ? fmtDate(r.last, false) : '—'}</td>
          <td class="num" data-label="Reports due">${r.pendingReports ? `<span class="pill pill--warn pill--plain">${r.pendingReports}</span>` : '0'}</td>
          <td class="num" data-label="Projects">${r.projects}</td>
          <td data-label=""><button class="btn btn--sm btn--line" data-act="open-mentor" data-email="${esc(r.m.email)}">Open</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted small">Approve mentors to see their activity.</p>'}
    </div>`;
}

let mentorFilter = 'Pending';
function adminMentors() {
  const a = A();
  const counts = {};
  a.mentors.forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });
  if (mentorFilter !== 'All' && !counts[mentorFilter] && a.mentors.length) mentorFilter = counts.Pending ? 'Pending' : 'All';
  const list = a.mentors.filter(m => mentorFilter === 'All' || m.status === mentorFilter).sort(by('joinedOn', -1));
  return `<div class="page-head"><div><h1 class="page-title">Mentors</h1><p class="page-sub">${plural(a.mentors.length, 'sign-up')} from the Setu form</p></div></div>
    <div class="tabs">${['All', 'Pending', 'Approved', 'Rejected', 'Inactive'].map(t => `<button class="tab ${mentorFilter === t ? 'is-on' : ''}" data-act="mentor-filter" data-v="${t}">${t} ${t === 'All' ? a.mentors.length : counts[t] || 0}</button>`).join('')}</div>
    ${list.length ? list.map(m => {
      const mentees = a.students.filter(s => s.mentorEmail === m.email && s.status !== 'Inactive').length;
      const held = a.meetings.filter(x => x.mentorEmail === m.email && x.status === 'Completed').length;
      return `<div class="card">
        <div class="row row--top"><span class="avatar ${m.status === 'Approved' ? '' : 'avatar--gold'}">${esc(initials(m.name))}</span>
          <div class="grow"><p class="name">${esc(m.name)} <span class="pill ${MENTOR_PILL[m.status] || ''}">${esc(m.status)}</span></p>
            <p class="meta">${esc(m.designation)}${m.company ? ', ' + esc(m.company) : ''} · ${esc(m.experience)} yrs${m.city ? ' · ' + esc(m.city) : ''}</p>
            ${m.status === 'Approved' ? `<p class="meta">${plural(mentees, 'mentee')} · ${plural(held, 'meeting')} held</p>` : ''}</div></div>
        <details style="margin-top:10px"><summary class="small" style="cursor:pointer;color:var(--terracotta-dk)">Profile details</summary>
          <dl class="kv small" style="margin-top:10px">
            <dt>Email</dt><dd><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></dd>
            <dt>Phone</dt><dd><a href="tel:${esc(m.phone)}">${esc(m.phone)}</a></dd>
            ${m.domains ? `<dt>Domains</dt><dd>${esc(m.domains)}</dd>` : ''}
            ${m.waysToHelp ? `<dt>Wants to help with</dt><dd>${esc(m.waysToHelp)}</dd>` : ''}
            ${m.timeCommitment ? `<dt>Time</dt><dd>${esc(m.timeCommitment)}</dd>` : ''}
            ${m.aolConnection ? `<dt>Art of Living</dt><dd>${esc(m.aolConnection)}</dd>` : ''}
            ${m.linkedin ? `<dt>LinkedIn</dt><dd><a href="${esc(m.linkedin)}" target="_blank" rel="noopener">${esc(m.linkedin)}</a></dd>` : ''}
            ${m.message ? `<dt>Message</dt><dd class="prewrap">${esc(m.message)}</dd>` : ''}
            <dt>Signed up</dt><dd>${esc(m.joinedOn)}</dd>
          </dl></details>
        <div class="actions">
          ${m.status !== 'Approved' ? `<button class="btn btn--sm btn--gold" data-act="mentor-status" data-email="${esc(m.email)}" data-status="Approved">Approve</button>` : `<button class="btn btn--sm btn--dark" data-act="open-mentor" data-email="${esc(m.email)}">Open dashboard</button>`}
          ${m.status === 'Pending' ? `<button class="btn btn--sm btn--danger" data-act="mentor-status" data-email="${esc(m.email)}" data-status="Rejected">Decline</button>` : ''}
          ${m.status === 'Approved' ? `<button class="btn btn--sm btn--line" data-act="mentor-status" data-email="${esc(m.email)}" data-status="Inactive">Mark inactive</button>` : ''}
        </div></div>`;
    }).join('') : emptyState(mentorFilter === 'All' ? 'No mentor sign-ups yet. Share the Setu link!' : `No ${mentorFilter.toLowerCase()} mentors.`)}`;
}

const studentFilter = { q: '', dept: '', mentor: '' };
const selected = new Set();
function filteredStudents() {
  const q = studentFilter.q.toLowerCase();
  return A().students.filter(s =>
    (!q || [s.name, s.email, s.rollNo].join(' ').toLowerCase().includes(q)) &&
    (!studentFilter.dept || (s.department || 'Not set') === studentFilter.dept) &&
    (!studentFilter.mentor || (studentFilter.mentor === '__none' ? !s.mentorEmail : s.mentorEmail === studentFilter.mentor))
  ).sort(by('name'));
}
function departments() { return [...new Set(A().students.map(s => s.department || 'Not set'))].sort(); }

function adminStudents() {
  const a = A(), list = filteredStudents();
  [...selected].forEach(id => { if (!a.students.find(s => s.id === id)) selected.delete(id); });
  return `<div class="page-head"><div><h1 class="page-title">Students</h1><p class="page-sub">${plural(a.students.length, 'student')} · ${plural(a.students.filter(s => !s.mentorEmail && s.status !== 'Inactive').length, 'unassigned student')}</p></div>
      <div class="actions" style="margin:0"><button class="btn btn--line" data-act="student-import">Bulk import</button><button class="btn btn--dark" data-act="student-new">+ Add student</button></div></div>
    <div class="filters">
      <input class="input" type="search" placeholder="Search name, email, roll no." value="${esc(studentFilter.q)}" data-filter="q" aria-label="Search students">
      <select class="select" data-filter="dept" aria-label="Department"><option value="">All departments</option>${departments().map(d => `<option ${studentFilter.dept === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select>
      <select class="select" data-filter="mentor" aria-label="Mentor"><option value="">All mentors</option><option value="__none" ${studentFilter.mentor === '__none' ? 'selected' : ''}>Unassigned</option>
        ${approvedMentors().map(m => `<option value="${esc(m.email)}" ${studentFilter.mentor === m.email ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
    </div>
    <div class="card row" id="assignBar" style="flex-wrap:wrap;margin-bottom:12px">
      <span class="grow small" id="selCount">Select students to assign them to a mentor.</span>
      <select class="select" id="assignTo" style="width:auto;flex:1 1 200px" aria-label="Assign to mentor"><option value="">Choose a mentor…</option>${approvedMentors().map(m => `<option value="${esc(m.email)}">${esc(m.name)}</option>`).join('')}<option value="__none">— Remove mentor —</option></select>
      <button class="btn btn--gold btn--sm" data-act="assign">Assign</button>
    </div>
    ${list.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th><input type="checkbox" data-act="select-all" aria-label="Select all shown"></th><th>Name</th><th>Department</th><th>Programme / year</th><th>Mentor</th><th></th></tr></thead><tbody>
      ${list.map(s => { const m = mentorByEmail(s.mentorEmail); return `<tr>
        <td data-label=""><label class="check" style="padding:0"><input type="checkbox" data-sel="${esc(s.id)}" ${selected.has(s.id) ? 'checked' : ''} aria-label="Select ${esc(s.name)}"></label></td>
        <td data-label="Name"><strong>${esc(s.name)}</strong> ${s.status === 'Inactive' ? '<span class="pill">Inactive</span>' : ''}<br><span class="meta">${esc(s.email)}${s.rollNo ? ' · ' + esc(s.rollNo) : ''}</span></td>
        <td data-label="Department">${esc(s.department) || '—'}</td>
        <td data-label="Programme">${esc(s.programme) || '—'}${s.year ? ' · ' + esc(s.year) : ''}</td>
        <td data-label="Mentor">${m ? esc(m.name) : '<span class="pill pill--warn">Unassigned</span>'}</td>
        <td data-label=""><button class="btn btn--sm btn--line" data-act="student-edit" data-id="${esc(s.id)}">Edit</button></td></tr>`; }).join('')}
    </tbody></table></div>` : emptyState(a.students.length ? 'No students match these filters.' : 'No students yet. Add them one by one or paste a list.', a.students.length ? '' : '<button class="btn btn--gold" data-act="student-import">Bulk import</button>')}`;
}
function updateAdminSelection() {
  const c = $('#selCount');
  if (c) c.textContent = selected.size ? `${plural(selected.size, 'student')} selected` : 'Select students to assign them to a mentor.';
}

const meetingFilter = { mentor: '', status: '', from: '', to: '' };
function filteredMeetings() {
  const now = nowIst();
  return A().meetings.filter(m => {
    const st = m.status === 'Scheduled' && m.end <= now ? 'Report pending' : m.status;
    return (!meetingFilter.mentor || m.mentorEmail === meetingFilter.mentor) &&
      (!meetingFilter.status || st === meetingFilter.status) &&
      (!meetingFilter.from || m.start.slice(0, 10) >= meetingFilter.from) &&
      (!meetingFilter.to || m.start.slice(0, 10) <= meetingFilter.to);
  }).sort(by('start', -1));
}
function meetingStats(m) {
  const fb = A().feedback.filter(f => f.meetingId === m.id);
  const invited = ids(m.studentIds).length;
  const attended = fb.filter(f => f.attended === 'Yes').length;
  const r = fb.map(f => Number(f.rating)).filter(Boolean);
  return { invited, attended, fb, avg: r.length ? r.reduce((x, y) => x + y, 0) / r.length : null };
}
function adminStatusPill(m) {
  if (m.status === 'Scheduled' && m.end <= nowIst()) return STATE_PILL['needs-report'];
  return { Scheduled: STATE_PILL.upcoming, Completed: STATE_PILL.completed, Cancelled: STATE_PILL.cancelled }[m.status] || '';
}

function adminMeetings() {
  const list = filteredMeetings();
  const done = list.filter(m => m.status === 'Completed');
  let inv = 0, att = 0;
  const ratings = [];
  done.forEach(m => { const s = meetingStats(m); inv += s.invited; att += s.attended; s.fb.forEach(f => Number(f.rating) && ratings.push(Number(f.rating))); });
  const studentName = id => (A().students.find(s => s.id === id) || {}).name || 'Unknown student';
  return `<div class="page-head"><div><h1 class="page-title">Meetings report</h1><p class="page-sub">Every meeting across all mentors</p></div>
      <div class="actions" style="margin:0"><button class="btn btn--line" data-act="export-meetings">Export CSV</button><button class="btn btn--dark" data-act="schedule-admin">+ Schedule meeting</button></div></div>
    <div class="filters">
      <select class="select" data-mfilter="mentor" aria-label="Mentor"><option value="">All mentors</option>${A().mentors.filter(m => A().meetings.some(x => x.mentorEmail === m.email)).map(m => `<option value="${esc(m.email)}" ${meetingFilter.mentor === m.email ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
      <select class="select" data-mfilter="status" aria-label="Status"><option value="">Any status</option>${['Scheduled', 'Report pending', 'Completed', 'Cancelled'].map(s => `<option ${meetingFilter.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <input class="input" type="date" data-mfilter="from" value="${esc(meetingFilter.from)}" aria-label="From date">
      <input class="input" type="date" data-mfilter="to" value="${esc(meetingFilter.to)}" aria-label="To date">
    </div>
    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><div class="stat__num">${list.length}</div><div class="stat__label">Meetings</div></div>
      <div class="stat"><div class="stat__num">${done.length}</div><div class="stat__label">Completed</div></div>
      <div class="stat"><div class="stat__num">${inv ? Math.round((att / inv) * 100) + '%' : '—'}</div><div class="stat__label">Attendance</div></div>
      <div class="stat"><div class="stat__num">${ratings.length ? (ratings.reduce((x, y) => x + y, 0) / ratings.length).toFixed(1) : '—'}</div><div class="stat__label">Avg. engagement (of 5)</div></div>
    </div>
    ${list.length ? list.map(m => {
      const s = meetingStats(m), mentor = mentorByEmail(m.mentorEmail) || { name: m.mentorEmail };
      return `<div class="card">
        <div class="row"><p class="name grow">${esc(m.title)}</p>${adminStatusPill(m)}</div>
        <p class="meta">${fmtWhen(m.start)} · ${esc(mentor.name)} · ${m.status === 'Completed' ? `${s.attended}/${s.invited} attended` : plural(s.invited, 'student')}${s.avg ? ' · ' + stars(s.avg) : ''}</p>
        ${m.status === 'Completed' ? `<details style="margin-top:8px"><summary class="small" style="cursor:pointer;color:var(--terracotta-dk)">Report & individual feedback</summary>
          ${m.summary ? `<p class="prewrap small" style="margin-top:8px"><strong>Notes:</strong> ${esc(m.summary)}</p>` : ''}
          ${m.nextSteps ? `<p class="prewrap small" style="margin-top:6px"><strong>Next steps:</strong> ${esc(m.nextSteps)}</p>` : ''}
          <ul class="timeline" style="margin-top:10px">${s.fb.map(f => `<li class="small"><div class="row"><strong class="grow">${esc(studentName(f.studentId))}</strong>${f.attended === 'Yes' ? '<span class="pill pill--good">Attended</span>' : '<span class="pill pill--bad">Absent</span>'}</div>${stars(f.rating)}${f.feedback ? `<p class="prewrap">${esc(f.feedback)}</p>` : ''}</li>`).join('')}</ul>
        </details>` : ''}
      </div>`;
    }).join('') : emptyState('No meetings match these filters.')}`;
}

function exportMeetingsCsv() {
  const rows = [['Date (IST)', 'Start', 'End', 'Mentor', 'Mentor email', 'Title', 'Status', 'Invited', 'Attended', 'Avg rating', 'Meeting notes', 'Next steps', 'Student', 'Student email', 'Department', 'Student attended', 'Student rating', 'Student feedback']];
  filteredMeetings().forEach(m => {
    const s = meetingStats(m), mentor = mentorByEmail(m.mentorEmail) || {};
    const base = [m.start.slice(0, 10), fmtTime(m.start), fmtTime(m.end), mentor.name || '', m.mentorEmail, m.title, m.status, s.invited, s.attended, s.avg ? s.avg.toFixed(1) : '', m.summary, m.nextSteps];
    const studs = ids(m.studentIds);
    if (!studs.length) rows.push(base);
    studs.forEach(id => {
      const st = A().students.find(x => x.id === id) || {};
      const f = s.fb.find(x => x.studentId === id) || {};
      rows.push(base.concat([st.name || '', st.email || '', st.department || '', f.attended || '', f.rating || '', f.feedback || '']));
    });
  });
  const csv = rows.map(r => r.map(v => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;                    // keep spreadsheets from running formulas
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `setu-meetings-${nowIst().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* =====================================================================
   MODAL (pop-up forms)
   ===================================================================== */
let modalSubmit = null;
function openModal(title, body, submitLabel, onSubmit) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  $('#modalSubmit').textContent = submitLabel || 'Save';
  $('#modalError').hidden = true;
  modalSubmit = onSubmit;
  const dlg = $('#modal');
  if (!dlg.open) dlg.showModal();
  const f = $('#modalBody input:not([type=hidden]), #modalBody textarea, #modalBody select');
  if (f && matchMedia('(pointer: fine)').matches) f.focus();
}
function closeModal() { const d = $('#modal'); if (d.open) d.close(); modalSubmit = null; }
function modalError(msg) { const e = $('#modalError'); e.textContent = msg; e.hidden = false; }

async function submitModal(e) {
  e.preventDefault();
  if (!modalSubmit) return;
  const btn = $('#modalSubmit');
  $('#modalError').hidden = true;
  busy(btn, true, btn.dataset.busy || 'Saving…');
  try {
    await modalSubmit(new FormData($('#modalForm')), $('#modalForm'));
    closeModal();
  } catch (err) { modalError(err.message); }
  busy(btn, false);
}

/* ---------- Schedule a meeting (mentor or admin) ---------- */
function studentChecklist(list) {
  if (!list.length) return '<p class="muted small">No students assigned to this mentor yet.</p>';
  return `<div class="checklist">${list.map(s => `<label class="check"><input type="checkbox" name="students" value="${esc(s.id)}" checked>
    <span>${esc(s.name)} <small>${esc(s.department || '')}</small></span></label>`).join('')}</div>`;
}
function defaultStart() {   // next full hour, at least 1 hour ahead
  const d = new Date(Date.now() + 5.5 * 3600e3 + 3600e3);
  d.setUTCMinutes(0, 0, 0);
  if (d.getUTCHours() < 9) d.setUTCHours(10);
  return d.toISOString().slice(0, 16);
}
function scheduleForm(students, mentorSelect) {
  return `${mentorSelect || ''}
    <div class="field"><label class="field__label" for="mTitle">Topic</label>
      <input class="input" id="mTitle" name="title" maxlength="120" value="Mentoring session" required></div>
    <div class="grid2">
      <div class="field"><label class="field__label" for="mStart">Date & time (IST)</label>
        <input class="input" id="mStart" name="start" type="datetime-local" min="${nowIst()}" value="${defaultStart()}" required></div>
      <div class="field"><label class="field__label" for="mDur">Duration</label>
        <select class="select" id="mDur" name="duration">${[30, 45, 60, 90, 120].map(n => `<option value="${n}" ${n === 60 ? 'selected' : ''}>${n} minutes</option>`).join('')}</select></div>
    </div>
    <div class="field"><label class="field__label" for="mAgenda">Agenda <span class="muted">(optional)</span></label>
      <textarea class="input" id="mAgenda" name="agenda" rows="3" maxlength="2000" placeholder="What you'd like to cover"></textarea></div>
    <div class="field"><span class="field__label">Who's invited</span><div id="studentPick">${studentChecklist(students)}</div>
      <span class="field__hint">Each student gets an email and a calendar invite with the Google Meet link.</span></div>
    <details class="field"><summary class="small" style="cursor:pointer;color:var(--terracotta-dk)">Use my own meeting link instead (Zoom, Teams…)</summary>
      <input class="input" name="meetLink" type="url" placeholder="https://…" style="margin-top:8px"></details>`;
}
async function doSchedule(fd, mentorEmail) {
  const studentIds = fd.getAll('students');
  if (!studentIds.length) throw new Error('Please invite at least one student.');
  const start = fd.get('start');
  if (!start) throw new Error('Please choose a date and time.');
  const r = await api('meeting.create', {
    mentorEmail, title: fd.get('title'), start, duration: Number(fd.get('duration')),
    agenda: fd.get('agenda'), studentIds, meetLink: (fd.get('meetLink') || '').trim(),
  });
  toast(`Meeting scheduled — ${plural(r.emailed || studentIds.length, 'student')} emailed ✉️`);
  return r;
}
function openSchedule() {
  $('#modalSubmit').dataset.busy = 'Creating Meet link & emailing…';
  openModal('Schedule a meeting', scheduleForm(D().students), 'Schedule & email students', async fd => {
    const r = await doSchedule(fd);
    await loadDash(true);
    location.hash = '#/meeting/' + r.meeting.id;
    route();
  });
}
function openScheduleAdmin() {
  const mentors = approvedMentors().filter(m => A().students.some(s => s.mentorEmail === m.email && s.status !== 'Inactive'));
  if (!mentors.length) return toast('Assign students to an approved mentor first.', true);
  const sel = `<div class="field"><label class="field__label" for="mMentor">Mentor</label>
    <select class="select" id="mMentor" name="mentor" data-act-change="pick-mentor">${mentors.map(m => `<option value="${esc(m.email)}">${esc(m.name)}</option>`).join('')}</select>
    <span class="field__hint">The mentor is invited too and the meeting appears on their dashboard.</span></div>`;
  $('#modalSubmit').dataset.busy = 'Creating Meet link & emailing…';
  openModal('Schedule a meeting', scheduleForm(adminStudentsOf(mentors[0].email), sel), 'Schedule & email students', async fd => {
    await doSchedule(fd, fd.get('mentor'));
    await loadAdmin(true);
    route();
  });
}
function adminStudentsOf(email) { return A().students.filter(s => s.mentorEmail === email && s.status !== 'Inactive').sort(by('name')); }

function openReschedule(id) {
  const m = D().meetings.find(x => x.id === id);
  $('#modalSubmit').dataset.busy = 'Updating & emailing…';
  openModal('Reschedule meeting', `
    <div class="grid2">
      <div class="field"><label class="field__label" for="rStart">New date & time (IST)</label>
        <input class="input" id="rStart" name="start" type="datetime-local" min="${nowIst()}" value="${esc(m.start)}" required></div>
      <div class="field"><label class="field__label" for="rDur">Duration</label>
        <select class="select" id="rDur" name="duration">${[30, 45, 60, 90, 120].map(n => `<option value="${n}" ${n === Number(m.duration) ? 'selected' : ''}>${n} minutes</option>`).join('')}</select></div>
    </div><p class="field__hint">Everyone invited gets an email with the new time.</p>`, 'Save new time', async fd => {
    await api('meeting.reschedule', { meetingId: id, start: fd.get('start'), duration: Number(fd.get('duration')) });
    toast('Meeting rescheduled — students notified');
    await loadDash(true); route();
  });
}

/* ---------- Projects ---------- */
function projectForm(p) {
  p = p || { status: 'Not started', studentIds: '' };
  const chosen = ids(p.studentIds);
  return `<div class="field"><label class="field__label" for="pTitle">Project title</label>
      <input class="input" id="pTitle" name="title" maxlength="150" value="${esc(p.title || '')}" required></div>
    <div class="field"><label class="field__label" for="pDesc">Description & goals</label>
      <textarea class="input" id="pDesc" name="description" rows="4" maxlength="3000">${esc(p.description || '')}</textarea></div>
    <div class="grid2">
      <div class="field"><label class="field__label" for="pStart">Start date</label><input class="input" id="pStart" name="startDate" type="date" value="${esc(p.startDate || nowIst().slice(0, 10))}"></div>
      <div class="field"><label class="field__label" for="pDue">Due date</label><input class="input" id="pDue" name="dueDate" type="date" value="${esc(p.dueDate || '')}"></div>
    </div>
    <div class="field"><label class="field__label" for="pStatus">Status</label>
      <select class="select" id="pStatus" name="status">${['Not started', 'In progress', 'On hold', 'Completed'].map(s => `<option ${p.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="field"><span class="field__label">Students on this project</span>
      ${D().students.length ? `<div class="checklist">${D().students.map(s => `<label class="check"><input type="checkbox" name="students" value="${esc(s.id)}" ${chosen.includes(s.id) ? 'checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}</div>` : '<p class="muted small">No mentees assigned yet — you can add them later.</p>'}</div>`;
}
function openProject(id) {
  const p = id ? D().projects.find(x => x.id === id) : null;
  $('#modalSubmit').dataset.busy = 'Saving…';
  openModal(p ? 'Edit project' : 'New project', projectForm(p), p ? 'Save changes' : 'Create project', async fd => {
    const r = await api('project.save', {
      projectId: p ? p.id : '', title: fd.get('title'), description: fd.get('description'), startDate: fd.get('startDate'),
      dueDate: fd.get('dueDate'), status: fd.get('status'), studentIds: fd.getAll('students'),
    });
    toast(p ? 'Project updated' : 'Project created 🌱');
    await loadDash(true);
    location.hash = '#/project/' + r.project.id;
    route();
  });
}
function openProjectUpdate(id) {
  const p = D().projects.find(x => x.id === id);
  const v = Number(p.progress) || 0;
  $('#modalSubmit').dataset.busy = 'Saving…';
  openModal('Progress report', `
    <div class="field"><label class="field__label" for="uProg">Overall progress</label>
      <div class="row"><input class="range grow" id="uProg" name="progress" type="range" min="0" max="100" step="5" value="${v}" data-act-input="range"><span class="range-val" id="uProgVal">${v}%</span></div></div>
    <div class="field"><label class="field__label" for="uNote">What's been done? What's next?</label>
      <textarea class="input" id="uNote" name="note" rows="5" maxlength="3000" required placeholder="Milestones reached, blockers, next steps…"></textarea></div>`, 'Save report', async fd => {
    await api('project.addUpdate', { projectId: id, progress: Number(fd.get('progress')), note: fd.get('note') });
    toast('Progress report saved');
    await loadDash(true); route();
  });
}

/* ---------- Students (admin) ---------- */
function studentForm(s) {
  s = s || {};
  const mentors = approvedMentors();
  return `<div class="grid2">
      <div class="field"><label class="field__label" for="sName">Full name</label><input class="input" id="sName" name="name" maxlength="120" value="${esc(s.name || '')}" required></div>
      <div class="field"><label class="field__label" for="sEmail">Email</label><input class="input" id="sEmail" name="email" type="email" value="${esc(s.email || '')}" required></div>
      <div class="field"><label class="field__label" for="sRoll">Roll no.</label><input class="input" id="sRoll" name="rollNo" value="${esc(s.rollNo || '')}"></div>
      <div class="field"><label class="field__label" for="sPhone">Phone</label><input class="input" id="sPhone" name="phone" type="tel" value="${esc(s.phone || '')}"></div>
      <div class="field"><label class="field__label" for="sDept">Department</label><input class="input" id="sDept" name="department" list="deptList" value="${esc(s.department || '')}">
        <datalist id="deptList">${departments().filter(d => d !== 'Not set').map(d => `<option value="${esc(d)}">`).join('')}</datalist></div>
      <div class="field"><label class="field__label" for="sProg">Programme</label><input class="input" id="sProg" name="programme" placeholder="e.g. BBA, B.Tech CSE" value="${esc(s.programme || '')}"></div>
      <div class="field"><label class="field__label" for="sYear">Year</label><input class="input" id="sYear" name="year" placeholder="e.g. 2" value="${esc(s.year || '')}"></div>
      ${s.id ? `<div class="field"><label class="field__label" for="sStatus">Status</label><select class="select" id="sStatus" name="status"><option ${s.status !== 'Inactive' ? 'selected' : ''}>Active</option><option ${s.status === 'Inactive' ? 'selected' : ''}>Inactive</option></select></div>`
        : `<div class="field"><label class="field__label" for="sMentor">Mentor</label><select class="select" id="sMentor" name="mentorEmail"><option value="">Assign later</option>${mentors.map(m => `<option value="${esc(m.email)}">${esc(m.name)}</option>`).join('')}</select></div>`}
    </div>`;
}
function openStudent(id) {
  const s = id ? A().students.find(x => x.id === id) : null;
  $('#modalSubmit').dataset.busy = 'Saving…';
  openModal(s ? 'Edit student' : 'Add a student', studentForm(s), s ? 'Save changes' : 'Add student', async fd => {
    const obj = Object.fromEntries(fd.entries());
    if (s) await api('admin.updateStudent', { id: s.id, patch: obj });
    else {
      const r = await api('admin.saveStudents', { students: [obj] });
      if (r.errors && r.errors.length) throw new Error(r.errors.join('\n'));
    }
    toast(s ? 'Student updated' : 'Student added');
    await loadAdmin(true); route();
  });
}

const IMPORT_COLS = ['name', 'email', 'rollNo', 'department', 'programme', 'year', 'phone', 'mentorEmail'];
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(Boolean));
}
function csvToStudents(text) {
  let rows = parseCsv(text);
  if (!rows.length) return [];
  let cols = IMPORT_COLS;
  const head = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
  if (head.includes('email')) {
    const alias = { name: ['name', 'fullname', 'studentname'], email: ['email', 'emailid', 'mail'], rollNo: ['rollno', 'roll', 'rollnumber', 'regno', 'registrationno'], department: ['department', 'dept', 'school', 'faculty'], programme: ['programme', 'program', 'course'], year: ['year', 'semester', 'batch'], phone: ['phone', 'mobile', 'contact'], mentorEmail: ['mentoremail', 'mentor'] };
    cols = head.map(h => Object.keys(alias).find(k => alias[k].includes(h)) || '');
    rows = rows.slice(1);
  }
  return rows.map(r => { const o = {}; cols.forEach((k, i) => { if (k) o[k] = r[i] || ''; }); return o; });
}
function openImport() {
  $('#modalSubmit').dataset.busy = 'Importing…';
  openModal('Bulk import students', `
    <p class="small" style="margin-bottom:10px">Paste from Excel / Google Sheets, or choose a CSV file. Columns in this order (a header row is fine):</p>
    <p class="small" style="margin-bottom:12px"><code>Name, Email, Roll No, Department, Programme, Year, Phone, Mentor Email</code></p>
    <div class="field"><input type="file" accept=".csv,text/csv" data-act-change="csv-file" aria-label="Choose a CSV file"></div>
    <div class="field"><label class="field__label" for="csvText">Student list</label>
      <textarea class="input" id="csvText" name="csv" rows="8" data-act-input="csv-preview" placeholder="Asha Patel, asha@ssu.edu.in, SSU2301, Management, BBA, 2&#10;Rahul Das, rahul@ssu.edu.in, SSU2302, Engineering, B.Tech CSE, 3"></textarea>
      <span class="field__hint" id="csvPreview">Students with an email already on file are updated, not duplicated.</span></div>`, 'Import students', async fd => {
    const list = csvToStudents(fd.get('csv') || '');
    if (!list.length) throw new Error('Please paste at least one student.');
    const r = await api('admin.saveStudents', { students: list });
    await loadAdmin(true); route();
    toast(`${r.added} added, ${r.updated} updated${r.errors.length ? ` · ${r.errors.length} skipped` : ''}`);
    if (r.errors.length) setTimeout(() => alert('Some rows need attention:\n\n' + r.errors.slice(0, 15).join('\n')), 300);
  });
}

/* =====================================================================
   EVENTS (one listener for the whole page)
   ===================================================================== */
async function onClick(e) {
  const t = e.target.closest('[data-act]');
  if (e.target.closest('[data-close-modal]')) return closeModal();
  if (!t) {
    if (!e.target.closest('#userMenu, #userBtn')) $('#userMenu').hidden = true;
    return;
  }
  const act = t.dataset.act;
  try {
    switch (act) {
      case 'retry': S.dash = null; S.admin = null; return route();
      case 'schedule': return openSchedule();
      case 'schedule-admin': return openScheduleAdmin();
      case 'reschedule': return openReschedule(t.dataset.id);
      case 'project-new': return openProject();
      case 'project-edit': return openProject(t.dataset.id);
      case 'project-update': return openProjectUpdate(t.dataset.id);
      case 'student-new': return openStudent();
      case 'student-edit': return openStudent(t.dataset.id);
      case 'student-import': return openImport();
      case 'export-meetings': return exportMeetingsCsv();
      case 'copy':
        try { await navigator.clipboard.writeText(t.dataset.text); } catch (err) {}
        return toast('Link copied ✓');
      case 'cancel-meeting':
        if (!confirm('Cancel this meeting? All invited students will be emailed.')) return;
        busy(t, true, 'Cancelling…');
        await api('meeting.cancel', { meetingId: t.dataset.id });
        toast('Meeting cancelled — students notified');
        await loadDash(true); return route();
      case 'delete-remark':
        if (!confirm('Delete this remark?')) return;
        await api('remark.delete', { remarkId: t.dataset.id });
        await loadDash(true); return route();
      case 'mentor-filter': mentorFilter = t.dataset.v; return route();
      case 'mentor-status': {
        const st = t.dataset.status;
        if (st !== 'Approved' && !confirm(`Mark this mentor as ${st}?`)) return;
        busy(t, true, 'Saving…');
        await api('admin.setMentorStatus', { email: t.dataset.email, status: st });
        toast(st === 'Approved' ? 'Approved — they\'ve been emailed a dashboard link 🎉' : `Marked ${st}`);
        await loadAdmin(true); return route();
      }
      case 'open-mentor':
        S.acting = t.dataset.email; S.dash = null;
        location.hash = '#/home'; return;
      case 'exit-acting':
        S.acting = null; S.dash = null;
        location.hash = '#/admin/mentors'; return;
      case 'select-all':
        filteredStudents().forEach(s => (t.checked ? selected.add(s.id) : selected.delete(s.id)));
        $$('[data-sel]').forEach(c => { c.checked = t.checked; });
        return updateAdminSelection();
      case 'assign': {
        const to = $('#assignTo').value;
        if (!selected.size) return toast('Select at least one student first.', true);
        if (!to) return toast('Choose a mentor to assign to.', true);
        busy(t, true, 'Assigning…');
        const r = await api('admin.assign', { studentIds: [...selected], mentorEmail: to === '__none' ? '' : to });
        selected.clear();
        toast(to === '__none' ? `Removed mentor from ${plural(r.changed, 'student')}` : `${plural(r.changed, 'student')} assigned — mentor notified`);
        await loadAdmin(true); return route();
      }
    }
  } catch (err) {
    toast(err.message, true);
    if (t.classList.contains('is-loading')) busy(t, false);
  }
}

async function onSubmitForm(e) {
  const f = e.target;
  if (f.id === 'modalForm') return submitModal(e);
  if (f.id === 'emailForm') { e.preventDefault(); return requestCode(f.querySelector('button[type=submit]')); }
  if (f.id === 'codeForm') { e.preventDefault(); return verifyCode(f.querySelector('button[type=submit]')); }
  const kind = f.dataset.form;
  if (!kind) return;
  e.preventDefault();
  const btn = f.querySelector('button[type=submit]');
  busy(btn, true, 'Saving…');
  try {
    if (kind === 'remark') {
      await api('remark.add', { studentId: f.dataset.student, remark: f.remark.value });
      toast('Remark saved');
    } else if (kind === 'report') {
      const entries = $$('.mentee-report', f).map(row => {
        const sid = row.dataset.student;
        const r = row.querySelector(`input[name="rate-${CSS.escape(sid)}"]:checked`);
        return {
          studentId: sid,
          attended: row.querySelector(`input[name="att-${CSS.escape(sid)}"]`).checked,
          rating: r && row.querySelector(`input[name="att-${CSS.escape(sid)}"]`).checked ? Number(r.value) : '',
          feedback: row.querySelector(`textarea[name="fb-${CSS.escape(sid)}"]`).value,
        };
      });
      await api('meeting.saveReport', { meetingId: f.dataset.id, summary: f.summary.value, nextSteps: f.nextSteps.value, entries });
      toast('Report saved ✓');
    }
    await loadDash(true);
    route();
  } catch (err) { toast(err.message, true); busy(btn, false); }
}

function paintStars(group) {
  const checked = group.querySelector('input:checked');
  const v = checked ? Number(checked.value) : 0;
  $$('label', group).forEach((l, i) => l.classList.toggle('on', i < v));
}

function onChange(e) {
  const t = e.target;
  if (t.closest('.rate')) return paintStars(t.closest('.rate'));
  if (t.name && t.name.startsWith('att-')) { t.closest('.mentee-report').classList.toggle('is-absent', !t.checked); return; }
  if (t.dataset.sel) { t.checked ? selected.add(t.dataset.sel) : selected.delete(t.dataset.sel); return updateAdminSelection(); }
  if (t.dataset.filter) { studentFilter[t.dataset.filter] = t.value; if (t.dataset.filter !== 'q') route(); return; }
  if (t.dataset.mfilter) { meetingFilter[t.dataset.mfilter] = t.value; return route(); }
  if (t.dataset.actChange === 'pick-mentor') { $('#studentPick').innerHTML = studentChecklist(adminStudentsOf(t.value)); return; }
  if (t.dataset.actChange === 'csv-file' && t.files[0]) {
    const r = new FileReader();
    r.onload = () => { $('#csvText').value = r.result; previewCsv(); };
    r.readAsText(t.files[0]);
  }
}
function previewCsv() {
  const list = csvToStudents($('#csvText').value);
  const bad = list.filter(s => !s.name || !/@/.test(s.email || '')).length;
  $('#csvPreview').textContent = list.length ? `${plural(list.length, 'student')} found${bad ? ` · ${bad} missing a name or email` : ''}` : 'Students with an email already on file are updated, not duplicated.';
}
let searchTimer;
function onInput(e) {
  const t = e.target;
  if (t.dataset.filter === 'q') {
    studentFilter.q = t.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { const pos = t.selectionStart; route().then(() => { const s = $('[data-filter="q"]'); if (s) { s.focus(); s.setSelectionRange(pos, pos); } }); }, 250);
  }
  if (t.dataset.actInput === 'range') $('#uProgVal').textContent = t.value + '%';
  if (t.dataset.actInput === 'csv-preview') previewCsv();
}

/* =====================================================================
   START
   ===================================================================== */
function init() {
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmitForm);
  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  addEventListener('hashchange', route);
  $('#changeEmail').addEventListener('click', () => showLogin());
  $('#resendCode').addEventListener('click', e => {
    if (Date.now() < resendAt) return setLoginMsg(`Please wait ${Math.ceil((resendAt - Date.now()) / 1000)} seconds before asking again.`, true);
    $('#loginEmail').value = loginEmail;
    requestCode(e.target);
  });
  $('#userBtn').addEventListener('click', () => {
    const m = $('#userMenu');
    m.hidden = !m.hidden;
    $('#userBtn').setAttribute('aria-expanded', String(!m.hidden));
  });
  $('#logoutBtn').addEventListener('click', logout);
  $('#modal').addEventListener('close', () => { modalSubmit = null; });

  S.token = store.get(TOKEN_KEY);
  if (!S.token) return showLogin();
  $('#view').innerHTML = '';
  api('auth.me').then(r => startApp(r.user)).catch(err => { if (S.token) showLogin(err.message, true); });
}
init();
