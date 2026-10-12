/* =====================================================================
   SETU PORTAL — mentor & admin dashboards (Google Apps Script)
   ---------------------------------------------------------------------
   Works together with Code.gs (same Apps Script project).
   Every dashboard request arrives through doPost() in Code.gs with an
   "action" field and is answered by handleAction_() below.

   Data lives in tabs of the same Google Sheet (created automatically):
     Responses       mentors (from the public sign-up form) + Status column
     Students        students, their department and assigned mentor
     Meetings        scheduled / completed / cancelled meetings + report
     Feedback        per-meeting, per-student attendance, rating, feedback
     Remarks         running notes a mentor keeps on each mentee
     Projects        mentor-led projects and their overall progress
     ProjectUpdates  dated progress reports for each project
   ===================================================================== */

// ⚙️ PORTAL SETTINGS
const SESSION_DAYS = 14;                       // how long a login lasts on one device
// Google Meet links are created through Google Calendar. This needs the
// "Google Calendar API" service switched on (SETUP.md, part 5). If it is off,
// mentors can still paste their own meeting link.
const CREATE_MEET_LINKS = true;
const SEND_CALENDAR_INVITES = true;            // Google Calendar also sends its own invitation
const SEND_MEETING_EMAILS = true;              // our own branded email with the Meet link to each student

/* ---------------------------------------------------------------------
   TABLE DEFINITIONS — [key used in code, column header in the Sheet]
   --------------------------------------------------------------------- */
const TABLES = {
  Students: [
    ['id', 'ID'], ['name', 'Name'], ['email', 'Email'], ['rollNo', 'Roll No'], ['department', 'Department'],
    ['programme', 'Programme'], ['year', 'Year'], ['phone', 'Phone'], ['mentorEmail', 'Mentor Email'],
    ['status', 'Status'], ['addedOn', 'Added On'], ['updatedOn', 'Updated On'],
  ],
  Meetings: [
    ['id', 'ID'], ['mentorEmail', 'Mentor Email'], ['title', 'Title'], ['agenda', 'Agenda'],
    ['start', 'Start (IST)'], ['end', 'End (IST)'], ['duration', 'Duration (min)'], ['meetLink', 'Meet Link'],
    ['eventId', 'Calendar Event ID'], ['studentIds', 'Student IDs'], ['status', 'Status'],
    ['createdBy', 'Created By'], ['createdOn', 'Created On'], ['summary', 'Meeting Notes'],
    ['nextSteps', 'Next Steps'], ['reportOn', 'Report Saved On'],
  ],
  Feedback: [
    ['id', 'ID'], ['meetingId', 'Meeting ID'], ['studentId', 'Student ID'], ['mentorEmail', 'Mentor Email'],
    ['attended', 'Attended'], ['rating', 'Rating (1-5)'], ['feedback', 'Feedback'], ['updatedOn', 'Updated On'],
  ],
  Remarks: [
    ['id', 'ID'], ['studentId', 'Student ID'], ['mentorEmail', 'Mentor Email'], ['remark', 'Remark'],
    ['createdOn', 'Created On'],
  ],
  Projects: [
    ['id', 'ID'], ['mentorEmail', 'Mentor Email'], ['title', 'Title'], ['description', 'Description'],
    ['studentIds', 'Student IDs'], ['startDate', 'Start Date'], ['dueDate', 'Due Date'], ['status', 'Status'],
    ['progress', 'Progress %'], ['createdOn', 'Created On'], ['updatedOn', 'Updated On'],
  ],
  ProjectUpdates: [
    ['id', 'ID'], ['projectId', 'Project ID'], ['mentorEmail', 'Mentor Email'], ['progress', 'Progress %'],
    ['note', 'Note'], ['createdOn', 'Created On'],
  ],
};
const MENTOR_STATUSES = ['Pending', 'Approved', 'Rejected', 'Inactive'];
const PROJECT_STATUSES = ['Not started', 'In progress', 'On hold', 'Completed'];

/* =====================================================================
   ROUTER
   ===================================================================== */
const ACTIONS = {
  // Public (no login)
  'auth.requestCode': { pub: true, fn: requestCode_ },
  'auth.verify':      { pub: true, fn: verifyCode_ },
  // Any signed-in user
  'auth.me':          { fn: function (s) { return { user: publicUser_(s) }; } },
  'auth.logout':      { fn: logout_ },
  // Mentor (an admin may act for any mentor by sending mentorEmail)
  'mentor.dashboard': { mentor: true, fn: mentorDashboard_ },
  'meeting.create':   { mentor: true, write: true, fn: createMeeting_ },
  'meeting.reschedule': { mentor: true, write: true, fn: rescheduleMeeting_ },
  'meeting.cancel':   { mentor: true, write: true, fn: cancelMeeting_ },
  'meeting.saveReport': { mentor: true, write: true, fn: saveReport_ },
  'remark.add':       { mentor: true, write: true, fn: addRemark_ },
  'remark.delete':    { mentor: true, write: true, fn: deleteRemark_ },
  'project.save':     { mentor: true, write: true, fn: saveProject_ },
  'project.addUpdate': { mentor: true, write: true, fn: addProjectUpdate_ },
  // Admin only
  'admin.data':       { admin: true, fn: adminData_ },
  'admin.setMentorStatus': { admin: true, write: true, fn: setMentorStatus_ },
  'admin.saveStudents': { admin: true, write: true, fn: saveStudents_ },
  'admin.updateStudent': { admin: true, write: true, fn: updateStudent_ },
  'admin.assign':     { admin: true, write: true, fn: assignStudents_ },
};

function handleAction_(req) {
  try {
    const def = ACTIONS[req.action];
    if (!def) throw new Error('Unknown action.');
    let session = null;
    if (!def.pub) {
      session = getSession_(req.token);
      if (def.admin && !session.isAdmin) throw new Error('Only admins can do that.');
      if (def.mentor) session.mentorEmail = actingMentor_(session, req);
    }
    let result;
    if (def.write) {
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { result = def.fn(session, req); } finally { lock.releaseLock(); }
    } else {
      result = def.fn(session, req);
    }
    return Object.assign({ status: 'success' }, result || {});
  } catch (err) {
    console.error(req && req.action, err);
    return { status: 'error', message: String(err && err.message || err), auth: !!(err && err.auth) };
  }
}

/* Which mentor's data is this request about? Mentors: always themselves. Admins: whoever they ask for. */
function actingMentor_(session, req) {
  if (session.isAdmin && req.mentorEmail) {
    const email = String(req.mentorEmail).trim().toLowerCase();
    if (!findMentor_(email)) throw new Error('Mentor not found.');
    return email;
  }
  if (!session.isMentor) throw new Error('Your mentor profile is not approved yet.');
  return session.email;
}

/* =====================================================================
   LOGIN — a 6-digit code sent by email, no passwords
   ===================================================================== */
function requestCode_(s, req) {
  const email = String(req.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Please enter a valid email address.');
  const generic = { message: 'If this email belongs to an approved mentor or an admin, a 6-digit code is on its way. It is valid for 10 minutes.' };

  const cache = CacheService.getScriptCache();
  const countKey = 'otpn_' + email;
  const count = Number(cache.get(countKey) || 0);
  if (count >= 5) throw new Error('Too many codes requested. Please wait 15 minutes and try again.');
  cache.put(countKey, String(count + 1), 900);

  const role = roleFor_(email);
  if (!role.isAdmin && !role.isMentor) return generic;      // never reveal who is registered

  const code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('otp_' + email, JSON.stringify({ h: hash_(code + '|' + email), tries: 0 }), 600);
  MailApp.sendEmail({
    to: email,
    subject: 'Your Setu login code: ' + code,
    name: 'Setu · Sri Sri University',
    htmlBody: emailShell_('Your login code',
      '<p style="margin:0 0 12px">Use this code to sign in to the Setu portal:</p>' +
      '<p style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#1B2A4A;margin:8px 0 16px">' + code + '</p>' +
      '<p style="margin:0;color:#7a6a5e;font-size:13px">It expires in 10 minutes. If you didn\'t ask for it, you can ignore this email.</p>'),
    body: 'Your Setu login code is ' + code + ' (valid for 10 minutes).',
  });
  return generic;
}

function verifyCode_(s, req) {
  const email = String(req.email || '').trim().toLowerCase();
  const code = String(req.code || '').replace(/\D/g, '');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('otp_' + email);
  if (!raw) throw new Error('That code has expired. Please ask for a new one.');
  const rec = JSON.parse(raw);
  if (rec.tries >= 5) { cache.remove('otp_' + email); throw new Error('Too many attempts. Please ask for a new code.'); }
  if (rec.h !== hash_(code + '|' + email)) {
    rec.tries++;
    cache.put('otp_' + email, JSON.stringify(rec), 600);
    throw new Error('That code doesn\'t match. Please check and try again.');
  }
  cache.remove('otp_' + email);

  const props = PropertiesService.getScriptProperties();
  cleanupSessions_(props);
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  props.setProperty('s_' + token, JSON.stringify({ e: email, x: Date.now() + SESSION_DAYS * 864e5 }));
  const session = getSession_(token);
  return { token: token, user: publicUser_(session) };
}

function getSession_(token) {
  const fail = function (m) { const e = new Error(m); e.auth = true; return e; };
  if (!token || !/^[a-f0-9]{64}$/.test(String(token))) throw fail('Please sign in.');
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty('s_' + token);
  if (!raw) throw fail('Your session has ended. Please sign in again.');
  const rec = JSON.parse(raw);
  if (rec.x < Date.now()) { props.deleteProperty('s_' + token); throw fail('Your session has ended. Please sign in again.'); }
  const role = roleFor_(rec.e);
  if (!role.isAdmin && !role.isMentor) throw fail('Your account no longer has access. Please contact the Setu team.');
  return { token: token, email: rec.e, isAdmin: role.isAdmin, isMentor: role.isMentor, name: role.name };
}

function logout_(s) {
  PropertiesService.getScriptProperties().deleteProperty('s_' + s.token);
  return {};
}

function cleanupSessions_(props) {
  const all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('s_') !== 0) return;
    try { if (JSON.parse(all[k]).x < Date.now()) props.deleteProperty(k); } catch (e) { props.deleteProperty(k); }
  });
}

function roleFor_(email) {
  const isAdmin = ADMIN_EMAILS.map(function (a) { return String(a).trim().toLowerCase(); }).indexOf(email) !== -1;
  const m = findMentor_(email);
  return { isAdmin: isAdmin, isMentor: !!(m && m.status === 'Approved'), name: m ? m.name : (isAdmin ? 'Admin' : '') };
}

function publicUser_(s) {
  return { email: s.email, name: s.name, isAdmin: s.isAdmin, isMentor: s.isMentor };
}

function hash_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

/* =====================================================================
   SHEET HELPERS — read/write the tabs above as lists of objects
   ===================================================================== */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function table_(name) {
  const def = TABLES[name];
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1000, def.length).setNumberFormat('@');      // plain text: no surprise date/number conversion
  }
  const headers = def.map(function (c) { return c[1]; });
  const first = sh.getRange(1, 1, 1, def.length).getValues()[0];
  if (first.join('|') !== headers.join('|')) {
    sh.getRange(1, 1, 1, def.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1B2A4A').setFontColor('#FDF6EC');
    sh.setFrozenRows(1);
  }
  return sh;
}

function readAll_(name) {
  const def = TABLES[name], sh = table_(name), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  return sh.getRange(2, 1, n, def.length).getValues().map(function (r, i) {
    const o = { _row: i + 2 };
    def.forEach(function (c, j) { o[c[0]] = cell_(r[j]); });
    return o;
  }).filter(function (o) { return o.id; });
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TIMEZONE, "yyyy-MM-dd'T'HH:mm");
  const s = String(v == null ? '' : v);
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;                       // undo our anti-formula apostrophe
}

function rowValues_(name, obj) {
  return TABLES[name].map(function (c) { return safe_(String(obj[c[0]] == null ? '' : obj[c[0]])); });
}

function insert_(name, obj) {
  const sh = table_(name), row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, TABLES[name].length).setNumberFormat('@').setValues([rowValues_(name, obj)]);
  obj._row = row;
  return obj;
}

function save_(name, obj) {                           // obj must come from readAll_ (has _row)
  table_(name).getRange(obj._row, 1, 1, TABLES[name].length).setNumberFormat('@').setValues([rowValues_(name, obj)]);
  return obj;
}

function newId_(prefix) { return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }
function nowIst_() { return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm"); }
function clip_(v, n) { return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, n); }
function strip_(o) { const c = Object.assign({}, o); delete c._row; return c; }
function ids_(v) { return String(v || '').split(',').map(function (x) { return x.trim(); }).filter(String); }
function isEmail_(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

/* Mentors come from the sign-up "Responses" tab (Code.gs) */
function readMentors_() {
  const sh = getSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const col = function (h) { return HEADERS.indexOf(h); };
  return sh.getRange(2, 1, n, HEADERS.length).getValues().map(function (r, i) {
    const email = String(r[col('Email')]).trim().toLowerCase();
    return {
      _row: i + 2, email: email, name: cell_(r[col('Full Name')]), company: cell_(r[col('Company')]),
      designation: cell_(r[col('Designation')]), experience: cell_(r[col('Experience')]),
      phone: cell_(r[col('Phone')]), domains: cell_(r[col('Domains')]), waysToHelp: cell_(r[col('Ways to Help')]),
      timeCommitment: cell_(r[col('Time Commitment')]), aolConnection: cell_(r[col('AoL Connection')]),
      city: cell_(r[col('City')]), linkedin: cell_(r[col('LinkedIn')]), message: cell_(r[col('Message')]),
      joinedOn: cell_(r[col('Timestamp (IST)')]), status: cell_(r[col('Status')]) || 'Pending',
    };
  }).filter(function (m) { return m.email; });
}
function findMentor_(email) {
  return readMentors_().filter(function (m) { return m.email === email; })[0] || null;
}

function portalUrl_() { return SITE_URL + 'portal.html'; }   // the dashboard page on your site

function setupPortal_() { Object.keys(TABLES).forEach(table_); }

/* =====================================================================
   MENTOR DASHBOARD
   ===================================================================== */
function mentorDashboard_(s) {
  const me = s.mentorEmail;
  const mine = function (r) { return r.mentorEmail === me; };
  const projects = readAll_('Projects').filter(mine);
  const pids = projects.map(function (p) { return p.id; });
  return {
    mentor: strip_(findMentor_(me)),
    students: readAll_('Students').filter(function (x) { return mine(x) && x.status !== 'Inactive'; }).map(strip_),
    meetings: readAll_('Meetings').filter(mine).map(strip_),
    feedback: readAll_('Feedback').filter(mine).map(strip_),
    remarks: readAll_('Remarks').filter(mine).map(strip_),
    projects: projects.map(strip_),
    projectUpdates: readAll_('ProjectUpdates').filter(function (u) { return pids.indexOf(u.projectId) !== -1; }).map(strip_),
    now: nowIst_(),
  };
}

function myStudents_(mentorEmail) {
  return readAll_('Students').filter(function (x) { return x.mentorEmail === mentorEmail && x.status !== 'Inactive'; });
}
function ownMeeting_(s, id) {
  const m = readAll_('Meetings').filter(function (x) { return x.id === id; })[0];
  if (!m || m.mentorEmail !== s.mentorEmail) throw new Error('Meeting not found.');
  return m;
}
function checkStart_(start) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start)) throw new Error('Please choose a date and time.');
  if (start <= nowIst_()) throw new Error('Please choose a time in the future.');
}
function addMinutes_(local, mins) {   // "2026-10-12T15:30" (IST) + minutes → same format
  const d = new Date(new Date(local + ':00+05:30').getTime() + mins * 60000);
  return Utilities.formatDate(d, TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}
function rfc_(local) { return local + ':00+05:30'; }

/* ---------- Meetings ---------- */
function createMeeting_(s, req) {
  const title = clip_(req.title, 120) || 'Setu mentoring session';
  const agenda = clip_(req.agenda, 2000);
  const start = clip_(req.start, 16);
  const duration = Math.max(15, Math.min(240, Number(req.duration) || 60));
  checkStart_(start);

  const all = myStudents_(s.mentorEmail);
  const want = (req.studentIds || []).map(String);
  const students = want.length ? all.filter(function (x) { return want.indexOf(x.id) !== -1; }) : all;
  if (!students.length) throw new Error('No students are assigned to this mentor yet.');

  const mentor = findMentor_(s.mentorEmail);
  const end = addMinutes_(start, duration);
  let meetLink = clip_(req.meetLink, 300), eventId = '';
  if (meetLink && !/^https:\/\/\S+$/.test(meetLink)) throw new Error('The meeting link must start with https://');

  if (!meetLink && CREATE_MEET_LINKS) {
    try {
      const ev = Calendar.Events.insert({
        summary: 'Setu: ' + title + ' — ' + mentor.name,
        description: (agenda ? agenda + '\n\n' : '') + 'Setu industry mentorship · Sri Sri University',
        start: { dateTime: rfc_(start), timeZone: TIMEZONE },
        end: { dateTime: rfc_(end), timeZone: TIMEZONE },
        attendees: [{ email: s.mentorEmail }].concat(students.map(function (x) { return { email: x.email }; })),
        conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
        guestsCanSeeOtherGuests: false,
      }, 'primary', { conferenceDataVersion: 1, sendUpdates: SEND_CALENDAR_INVITES ? 'all' : 'none' });
      eventId = ev.id;
      meetLink = ev.hangoutLink || ((ev.conferenceData && ev.conferenceData.entryPoints || [])
        .filter(function (p) { return p.entryPointType === 'video'; })[0] || {}).uri || '';
    } catch (e) {
      throw new Error('Couldn\'t create a Google Meet link (' + e.message + '). Ask the admin to switch on the Google Calendar API service — or paste your own meeting link.');
    }
  }
  if (!meetLink) throw new Error('Please paste a meeting link.');

  const m = insert_('Meetings', {
    id: newId_('M'), mentorEmail: s.mentorEmail, title: title, agenda: agenda, start: start, end: end,
    duration: duration, meetLink: meetLink, eventId: eventId,
    studentIds: students.map(function (x) { return x.id; }).join(','), status: 'Scheduled',
    createdBy: s.email, createdOn: nowIst_(),
  });
  if (SEND_MEETING_EMAILS) meetingEmails_('new', m, mentor, students);
  return { meeting: strip_(m), emailed: SEND_MEETING_EMAILS ? students.length : 0 };
}

function rescheduleMeeting_(s, req) {
  const m = ownMeeting_(s, req.meetingId);
  if (m.status !== 'Scheduled') throw new Error('Only upcoming meetings can be rescheduled.');
  const start = clip_(req.start, 16);
  checkStart_(start);
  m.duration = Math.max(15, Math.min(240, Number(req.duration) || Number(m.duration) || 60));
  m.start = start;
  m.end = addMinutes_(start, m.duration);
  if (m.eventId) {
    try {
      Calendar.Events.patch({ start: { dateTime: rfc_(m.start), timeZone: TIMEZONE }, end: { dateTime: rfc_(m.end), timeZone: TIMEZONE } },
        'primary', m.eventId, { sendUpdates: SEND_CALENDAR_INVITES ? 'all' : 'none' });
    } catch (e) { console.error('Calendar patch failed', e); }
  }
  save_('Meetings', m);
  if (SEND_MEETING_EMAILS) meetingEmails_('moved', m, findMentor_(m.mentorEmail), studentsByIds_(m.studentIds));
  return { meeting: strip_(m) };
}

function cancelMeeting_(s, req) {
  const m = ownMeeting_(s, req.meetingId);
  if (m.status !== 'Scheduled') throw new Error('Only upcoming meetings can be cancelled.');
  m.status = 'Cancelled';
  if (m.eventId) {
    try { Calendar.Events.remove('primary', m.eventId, { sendUpdates: SEND_CALENDAR_INVITES ? 'all' : 'none' }); }
    catch (e) { console.error('Calendar remove failed', e); }
  }
  save_('Meetings', m);
  if (SEND_MEETING_EMAILS) meetingEmails_('cancelled', m, findMentor_(m.mentorEmail), studentsByIds_(m.studentIds));
  return { meeting: strip_(m) };
}

/* Meeting notes + attendance, rating and feedback for each mentee */
function saveReport_(s, req) {
  const m = ownMeeting_(s, req.meetingId);
  if (m.status === 'Cancelled') throw new Error('This meeting was cancelled.');
  if (m.start > nowIst_()) throw new Error('You can write the report once the meeting has started.');
  m.summary = clip_(req.summary, 5000);
  m.nextSteps = clip_(req.nextSteps, 2000);
  m.status = 'Completed';
  m.reportOn = nowIst_();
  save_('Meetings', m);

  const invited = ids_(m.studentIds);
  const existing = readAll_('Feedback').filter(function (f) { return f.meetingId === m.id; });
  (req.entries || []).forEach(function (e) {
    const sid = String(e.studentId || '');
    if (invited.indexOf(sid) === -1) return;
    const rating = Number(e.rating);
    const row = existing.filter(function (f) { return f.studentId === sid; })[0] || { id: newId_('F'), meetingId: m.id, studentId: sid };
    row.mentorEmail = m.mentorEmail;
    row.attended = e.attended ? 'Yes' : 'No';
    row.rating = e.attended && rating >= 1 && rating <= 5 ? String(Math.round(rating)) : '';   // no rating when absent
    row.feedback = clip_(e.feedback, 2000);
    row.updatedOn = nowIst_();
    if (row._row) save_('Feedback', row); else insert_('Feedback', row);
  });
  return { meeting: strip_(m) };
}

/* ---------- Remarks ---------- */
function addRemark_(s, req) {
  const st = myStudents_(s.mentorEmail).filter(function (x) { return x.id === req.studentId; })[0];
  if (!st) throw new Error('Student not found.');
  const text = clip_(req.remark, 2000);
  if (!text) throw new Error('Please write a remark.');
  const r = insert_('Remarks', { id: newId_('R'), studentId: st.id, mentorEmail: s.mentorEmail, remark: text, createdOn: nowIst_() });
  return { remark: strip_(r) };
}
function deleteRemark_(s, req) {
  const r = readAll_('Remarks').filter(function (x) { return x.id === req.remarkId && x.mentorEmail === s.mentorEmail; })[0];
  if (!r) throw new Error('Remark not found.');
  table_('Remarks').deleteRow(r._row);
  return {};
}

/* ---------- Projects ---------- */
function saveProject_(s, req) {
  const title = clip_(req.title, 150);
  if (!title) throw new Error('Please give the project a title.');
  const mine = myStudents_(s.mentorEmail).map(function (x) { return x.id; });
  const sids = (req.studentIds || []).map(String).filter(function (id) { return mine.indexOf(id) !== -1; });
  const status = PROJECT_STATUSES.indexOf(req.status) !== -1 ? req.status : 'Not started';
  const date = function (v) { v = clip_(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; };
  let p;
  if (req.projectId) {
    p = readAll_('Projects').filter(function (x) { return x.id === req.projectId && x.mentorEmail === s.mentorEmail; })[0];
    if (!p) throw new Error('Project not found.');
  } else {
    p = { id: newId_('P'), mentorEmail: s.mentorEmail, progress: '0', createdOn: nowIst_() };
  }
  Object.assign(p, {
    title: title, description: clip_(req.description, 3000), studentIds: sids.join(','),
    startDate: date(req.startDate), dueDate: date(req.dueDate), status: status, updatedOn: nowIst_(),
  });
  if (status === 'Completed') p.progress = '100';
  if (p._row) save_('Projects', p); else insert_('Projects', p);
  return { project: strip_(p) };
}

function addProjectUpdate_(s, req) {
  const p = readAll_('Projects').filter(function (x) { return x.id === req.projectId && x.mentorEmail === s.mentorEmail; })[0];
  if (!p) throw new Error('Project not found.');
  const progress = Math.max(0, Math.min(100, Math.round(Number(req.progress) || 0)));
  const note = clip_(req.note, 3000);
  if (!note) throw new Error('Please describe the progress.');
  const u = insert_('ProjectUpdates', { id: newId_('U'), projectId: p.id, mentorEmail: s.mentorEmail, progress: String(progress), note: note, createdOn: nowIst_() });
  p.progress = String(progress);
  if (progress === 100) p.status = 'Completed';
  else if (p.status === 'Not started' || p.status === 'Completed') p.status = 'In progress';
  p.updatedOn = nowIst_();
  save_('Projects', p);
  return { update: strip_(u), project: strip_(p) };
}

/* =====================================================================
   ADMIN
   ===================================================================== */
function adminData_() {
  return {
    mentors: readMentors_().map(strip_),
    students: readAll_('Students').map(strip_),
    meetings: readAll_('Meetings').map(strip_),
    feedback: readAll_('Feedback').map(function (f) { return { meetingId: f.meetingId, studentId: f.studentId, attended: f.attended, rating: f.rating, feedback: f.feedback }; }),
    projects: readAll_('Projects').map(strip_),
    now: nowIst_(),
  };
}

function setMentorStatus_(s, req) {
  const email = String(req.email || '').trim().toLowerCase();
  const status = String(req.status || '');
  if (MENTOR_STATUSES.indexOf(status) === -1) throw new Error('Unknown status.');
  const m = findMentor_(email);
  if (!m) throw new Error('Mentor not found.');
  const was = m.status;
  getSheet_().getRange(m._row, STATUS_COL).setValue(status);
  if (status === 'Approved' && was !== 'Approved') {
    try {
      MailApp.sendEmail({
        to: email, name: 'Setu · Sri Sri University',
        subject: 'You\'re approved as a Setu mentor 🌉',
        htmlBody: emailShell_('Welcome aboard, ' + esc_(m.name.split(/\s+/)[0]) + '!',
          '<p style="margin:0 0 14px">Your Setu mentor profile has been approved. Your dashboard is ready — you\'ll see your mentees there as soon as they are assigned, and you can schedule meetings, keep notes and track projects.</p>' +
          button_(portalUrl_(), 'Open my dashboard') +
          '<p style="margin:16px 0 0;color:#7a6a5e;font-size:13px">Sign in with this email address — we\'ll send you a one-time code. No password needed.</p>'),
        body: 'Your Setu mentor profile has been approved. Open your dashboard: ' + portalUrl_(),
      });
    } catch (e) { console.error('Approval email failed', e); }
  }
  return {};
}

/* Add or update students in bulk. A student with an email already on file is updated. */
function saveStudents_(s, req) {
  const list = (req.students || []).slice(0, 1000);
  const existing = readAll_('Students');
  const byEmail = {};
  existing.forEach(function (x) { byEmail[x.email] = x; });
  const approved = approvedEmails_();
  let added = 0, updated = 0;
  const errors = [];
  list.forEach(function (raw, i) {
    const email = clip_(raw.email, 254).toLowerCase();
    const name = clip_(raw.name, 120);
    if (!name || !isEmail_(email)) { errors.push('Row ' + (i + 1) + ': needs a name and a valid email'); return; }
    let mentorEmail = clip_(raw.mentorEmail, 254).toLowerCase();
    if (mentorEmail && approved.indexOf(mentorEmail) === -1) { errors.push('Row ' + (i + 1) + ': mentor ' + mentorEmail + ' is not an approved mentor (left unassigned)'); mentorEmail = ''; }
    const fields = {
      name: name, email: email, rollNo: clip_(raw.rollNo, 40), department: clip_(raw.department, 100),
      programme: clip_(raw.programme, 100), year: clip_(raw.year, 20), phone: clip_(raw.phone, 20), updatedOn: nowIst_(),
    };
    const cur = byEmail[email];
    if (cur) {
      Object.keys(fields).forEach(function (k) { if (fields[k] || k === 'name') cur[k] = fields[k]; });
      if (mentorEmail) cur.mentorEmail = mentorEmail;
      save_('Students', cur);
      updated++;
    } else {
      byEmail[email] = insert_('Students', Object.assign(fields, { id: newId_('S'), mentorEmail: mentorEmail, status: 'Active', addedOn: nowIst_() }));
      added++;
    }
  });
  return { added: added, updated: updated, errors: errors };
}

function updateStudent_(s, req) {
  const st = readAll_('Students').filter(function (x) { return x.id === req.id; })[0];
  if (!st) throw new Error('Student not found.');
  const p = req.patch || {};
  ['name', 'rollNo', 'department', 'programme', 'year', 'phone'].forEach(function (k) {
    if (p[k] != null) st[k] = clip_(p[k], k === 'name' ? 120 : 100);
  });
  if (p.email != null) {
    const e = clip_(p.email, 254).toLowerCase();
    if (!isEmail_(e)) throw new Error('Please enter a valid email.');
    st.email = e;
  }
  if (p.status === 'Active' || p.status === 'Inactive') st.status = p.status;
  if (!st.name) throw new Error('Name is required.');
  st.updatedOn = nowIst_();
  save_('Students', st);
  return { student: strip_(st) };
}

function assignStudents_(s, req) {
  const mentorEmail = String(req.mentorEmail || '').trim().toLowerCase();
  if (mentorEmail && approvedEmails_().indexOf(mentorEmail) === -1) throw new Error('Please choose an approved mentor.');
  const want = (req.studentIds || []).map(String);
  let n = 0;
  readAll_('Students').forEach(function (st) {
    if (want.indexOf(st.id) === -1 || st.mentorEmail === mentorEmail) return;
    st.mentorEmail = mentorEmail;
    st.updatedOn = nowIst_();
    save_('Students', st);
    n++;
  });
  if (mentorEmail && n) {
    const m = findMentor_(mentorEmail);
    try {
      MailApp.sendEmail({
        to: mentorEmail, name: 'Setu · Sri Sri University',
        subject: n + ' new mentee' + (n > 1 ? 's' : '') + ' assigned to you on Setu',
        htmlBody: emailShell_('You have new mentees 🌱',
          '<p style="margin:0 0 14px">Hello ' + esc_(m.name.split(/\s+/)[0]) + ', ' + n + ' student' + (n > 1 ? 's have' : ' has') +
          ' been assigned to you. You can see their details and schedule your first meeting from your dashboard.</p>' + button_(portalUrl_() + '#/mentees', 'See my mentees')),
        body: n + ' students have been assigned to you on Setu: ' + portalUrl_(),
      });
    } catch (e) { console.error('Assignment email failed', e); }
  }
  return { changed: n };
}

function approvedEmails_() {
  return readMentors_().filter(function (m) { return m.status === 'Approved'; }).map(function (m) { return m.email; });
}
function studentsByIds_(csv) {
  const want = ids_(csv);
  return readAll_('Students').filter(function (x) { return want.indexOf(x.id) !== -1; });
}

/* =====================================================================
   EMAILS
   ===================================================================== */
function meetingEmails_(kind, m, mentor, students) {
  const when = humanDate_(m.start) + ', ' + humanTime_(m.start) + ' – ' + humanTime_(m.end) + ' IST';
  const subjects = {
    'new': 'Setu meeting with ' + mentor.name + ' — ' + humanDate_(m.start),
    'moved': 'Rescheduled: Setu meeting with ' + mentor.name + ' — ' + humanDate_(m.start),
    'cancelled': 'Cancelled: Setu meeting with ' + mentor.name + ' — ' + humanDate_(m.start),
  };
  const lead = {
    'new': 'Your industry mentor has scheduled a session with you.',
    'moved': 'Your Setu meeting has a new time.',
    'cancelled': 'This Setu meeting has been cancelled. Your mentor will share a new time soon.',
  }[kind];
  students.forEach(function (st) {
    const first = esc_(st.name.split(/\s+/)[0]);
    let html = '<p style="margin:0 0 14px">Hello ' + first + ', ' + lead + '</p>' +
      '<table role="presentation" style="border-collapse:collapse;margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px">' +
      row_('Mentor', esc_(mentor.name) + (mentor.designation ? ' · ' + esc_(mentor.designation) + (mentor.company ? ', ' + esc_(mentor.company) : '') : '')) +
      row_('Topic', esc_(m.title)) + row_('When', esc_(when)) + '</table>' +
      (m.agenda && kind !== 'cancelled' ? '<p style="margin:0 0 16px;white-space:pre-line"><strong>Agenda</strong><br>' + esc_(m.agenda) + '</p>' : '');
    if (kind !== 'cancelled') html += button_(m.meetLink, 'Join the meeting') +
      '<p style="margin:14px 0 0;font-size:13px;color:#7a6a5e;word-break:break-all">Meeting link: <a href="' + esc_(m.meetLink) + '">' + esc_(m.meetLink) + '</a></p>';
    try {
      MailApp.sendEmail({
        to: st.email, name: 'Setu · Sri Sri University', subject: subjects[kind],
        replyTo: m.mentorEmail,
        htmlBody: emailShell_(kind === 'cancelled' ? 'Meeting cancelled' : 'Your Setu meeting', html),
        body: lead + '\nMentor: ' + mentor.name + '\nTopic: ' + m.title + '\nWhen: ' + when + (kind !== 'cancelled' ? '\nJoin: ' + m.meetLink : ''),
      });
    } catch (e) { console.error('Meeting email failed for ' + st.email, e); }
  });
}

function emailShell_(title, inner) {
  return '<div style="background:#FDF6EC;padding:24px 12px;font-family:Georgia,serif;color:#2E2119">' +
    '<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border-collapse:collapse">' +
    '<tr><td style="background:#1B2A4A;color:#E9B44C;padding:14px 28px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px">SETU · SRI SRI UNIVERSITY</td></tr>' +
    '<tr><td style="padding:28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6">' +
    '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:26px;color:#1B2A4A;font-weight:normal">' + title + '</h1>' + inner +
    '</td></tr></table></div>';
}
function button_(href, label) {
  return '<a href="' + esc_(href) + '" style="display:inline-block;background:#E9B44C;color:#1B2A4A;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px;font-family:Arial,sans-serif">' + esc_(label) + '</a>';
}
function row_(k, v) {
  return '<tr><td style="padding:4px 14px 4px 0;color:#7a6a5e;vertical-align:top">' + k + '</td><td style="padding:4px 0">' + v + '</td></tr>';
}
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }

const MONTHS_ = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS_ = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function humanDate_(local) {          // "2026-10-12T15:30" → "Monday, 12 October 2026"
  const p = local.split(/[-T:]/).map(Number);
  return DAYS_[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] + ', ' + p[2] + ' ' + MONTHS_[p[1] - 1] + ' ' + p[0];
}
function humanTime_(local) {          // "…T15:30" → "3:30 pm"
  const p = local.split('T')[1].split(':').map(Number);
  return ((p[0] + 11) % 12 + 1) + ':' + ('0' + p[1]).slice(-2) + (p[0] < 12 ? ' am' : ' pm');
}
