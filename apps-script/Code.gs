/* =====================================================================
   SETU — Google Apps Script backend
   ---------------------------------------------------------------------
   Paste this whole file into Extensions → Apps Script of your Google Sheet.
   Full step-by-step instructions: SETUP.md
   ===================================================================== */

// ⚙️ SETTINGS — edit these three lines
const ADMIN_EMAIL = 'TODO(user)@example.com';   // TODO(user): your email — gets a note for each new mentor
const SEND_EMAILS = true;                        // false = no emails at all (to mentors or to you)
const SITE_URL    = 'https://setu-omega-nine.vercel.app/';   // your live page address, ending in "/"

// Internal settings (normally leave alone)
const SHEET_NAME = 'Responses';
const TIMEZONE   = 'Asia/Kolkata';
const HEADERS = [
  'Timestamp (IST)', 'Full Name', 'Company', 'Designation', 'Experience', 'Phone', 'Email',
  'Domains', 'Ways to Help', 'Time Commitment', 'AoL Connection', 'City', 'LinkedIn',
  'Heard From', 'Message', 'Consent', 'Source Ref', 'User Agent', 'Last Updated',
];
// Payload field → column, in the same order as HEADERS (Timestamp and Last Updated are added by the script)
const FIELDS = [
  'fullName', 'company', 'designation', 'experience', 'phone', 'email',
  'domains', 'waysToHelp', 'timeCommitment', 'aolConnection', 'city', 'linkedin',
  'heardFrom', 'message', 'consent', 'sourceRef', 'userAgent',
];
// Maximum stored length for each field
const MAX_LEN = {
  fullName: 100, company: 150, designation: 150, experience: 10, phone: 13, email: 254,
  domains: 400, waysToHelp: 400, timeCommitment: 60, aolConnection: 60, city: 100,
  linkedin: 300, heardFrom: 200, message: 500, sourceRef: 60, userAgent: 300,
};
const EXPERIENCE_VALUES = ['<3', '3-5', '5-10', '10-20', '20+'];
const PHONE_COL = HEADERS.indexOf('Phone') + 1;
const EMAIL_COL = HEADERS.indexOf('Email') + 1;

/* ---------------------------------------------------------------------
   POST — a new form submission
   The page sends JSON as text/plain (avoids a CORS preflight Apps Script can't answer).
   --------------------------------------------------------------------- */
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // Honeypot: a real person never fills the hidden "website" field. Pretend success, save nothing.
    if (data.website) return json_({ status: 'success' });

    const clean = validate_(data);                // throws a friendly message if something is wrong

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    let isNew;
    try {
      isNew = writeRow_(clean);
    } finally {
      lock.releaseLock();
    }

    if (SEND_EMAILS) sendEmails_(clean, isNew);
    return json_({ status: 'success' });
  } catch (err) {
    console.error(err);
    return json_({ status: 'error', message: String(err && err.message || err) });
  }
}

/* ---------------------------------------------------------------------
   GET — only the number of mentors, for the live counter.
   Never returns any submitted details.
   --------------------------------------------------------------------- */
function doGet() {
  const sheet = getSheet_();
  return json_({ count: Math.max(0, sheet.getLastRow() - 1) });
}

/* ---------------------------------------------------------------------
   Validation (repeats the checks the page already did — never trust the browser)
   --------------------------------------------------------------------- */
function validate_(d) {
  const c = {};
  FIELDS.forEach(function (f) {
    if (f === 'consent') return;
    c[f] = String(d[f] == null ? '' : d[f]).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, MAX_LEN[f] || 200);
  });
  c.email = c.email.toLowerCase();
  c.consent = d.consent === true;

  if (c.fullName.length < 2) throw new Error('Please enter your full name.');
  if (!c.company) throw new Error('Please enter your company.');
  if (!c.designation) throw new Error('Please enter your designation.');
  if (EXPERIENCE_VALUES.indexOf(c.experience) === -1) throw new Error('Please choose your years of experience.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email)) throw new Error('Please check your email address.');

  let digits = c.phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
  else if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) throw new Error('Please check your mobile number.');
  c.phone = '+91' + digits;

  if (!c.consent) throw new Error('Consent is required.');
  return c;
}

/* Stop spreadsheet formula injection: text starting with = + - @ gets a leading apostrophe */
function safe_(v) {
  if (typeof v !== 'string') return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

/* ---------------------------------------------------------------------
   Write — append a new row, or update the existing row for the same email
   Returns true if a new row was added.
   --------------------------------------------------------------------- */
function writeRow_(c) {
  const sheet = getSheet_();
  const now = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

  const values = FIELDS.map(function (f) {
    if (f === 'consent') return c.consent ? 'Yes' : 'No';
    if (f === 'phone') return c.phone;          // written into a plain-text column below, so no apostrophe needed
    return safe_(c[f]);
  });

  // Look for the same email in existing rows
  let existingRow = 0;
  const last = sheet.getLastRow();
  if (last > 1) {
    const emails = sheet.getRange(2, EMAIL_COL, last - 1, 1).getValues();
    for (let i = 0; i < emails.length; i++) {
      if (String(emails[i][0]).trim().toLowerCase() === c.email) { existingRow = i + 2; break; }
    }
  }

  if (existingRow) {
    // Keep the original timestamp, refresh everything else, stamp "Last Updated"
    sheet.getRange(existingRow, PHONE_COL).setNumberFormat('@');
    sheet.getRange(existingRow, 2, 1, values.length + 1).setValues([values.concat([now])]);
    return false;
  }

  const row = last + 1;
  sheet.getRange(row, PHONE_COL).setNumberFormat('@');   // keep "+91…" as readable text
  sheet.getRange(row, 1, 1, HEADERS.length).setValues([[now].concat(values).concat([''])]);
  return true;
}

/* Find (or create) the "Responses" tab with its header row */
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const first = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  if (first.join('') === '' || first[0] !== HEADERS[0]) {
    if (first.join('') !== '') sheet.insertRowBefore(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
      .setFontWeight('bold').setBackground('#1B2A4A').setFontColor('#FDF6EC');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/* ---------------------------------------------------------------------
   Emails — a warm welcome to the mentor, a short note to you
   Email problems never block the submission itself.
   --------------------------------------------------------------------- */
function sendEmails_(c, isNew) {
  const first = c.fullName.split(/\s+/)[0];

  if (isNew) {
    try {
      MailApp.sendEmail({
        to: c.email,
        subject: 'Welcome to Setu, ' + first + ' 🙏',
        name: 'Setu · Sri Sri University',
        replyTo: ADMIN_EMAIL.indexOf('TODO') === 0 ? undefined : ADMIN_EMAIL,
        htmlBody: welcomeHtml_(first),
        body: 'Welcome to the Setu family, ' + first + '! You have just become someone\'s bridge. ' +
              'Our team at Sri Sri University will reach out soon to find a way of mentoring that suits you.',
      });
    } catch (err) { console.error('Welcome email failed: ' + err); }
  }

  if (ADMIN_EMAIL && ADMIN_EMAIL.indexOf('TODO') !== 0) {
    try {
      MailApp.sendEmail({
        to: ADMIN_EMAIL,
        subject: (isNew ? 'New Setu mentor: ' : 'Setu mentor updated: ') + c.fullName,
        body: [
          c.fullName + ' — ' + c.designation + ', ' + c.company + ' (' + c.experience + ' yrs)',
          'Phone: ' + c.phone, 'Email: ' + c.email,
          'Ways to help: ' + (c.waysToHelp || '—'), 'Time: ' + (c.timeCommitment || '—'),
          'Heard from: ' + (c.heardFrom || '—') + (c.sourceRef ? '  [ref=' + c.sourceRef + ']' : ''),
          '', 'Sheet: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
        ].join('\n'),
      });
    } catch (err) { console.error('Admin email failed: ' + err); }
  }
}

function welcomeHtml_(first) {
  const img = SITE_URL.indexOf('YOUR-SITE-URL') === -1 ? SITE_URL + 'assets/og-image.jpg' : '';
  const esc = function (s) { return String(s).replace(/[&<>"']/g, function (ch) { return '&#' + ch.charCodeAt(0) + ';'; }); };
  return '' +
    '<div style="background:#FDF6EC;padding:24px 12px;font-family:Georgia,serif;color:#2E2119">' +
    '<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border-collapse:collapse">' +
    (img ? '<tr><td><img src="' + img + '" width="560" alt="Sri Sri University at dusk" style="display:block;width:100%;height:auto"></td></tr>' : '') +
    '<tr><td style="background:#1B2A4A;color:#E9B44C;padding:14px 28px;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px">SETU · SRI SRI UNIVERSITY</td></tr>' +
    '<tr><td style="padding:28px">' +
    '<h1 style="margin:0 0 12px;font-size:28px;color:#1B2A4A;font-weight:normal">Welcome to the Setu family, ' + esc(first) + '! 🙏</h1>' +
    '<p style="font-size:17px;line-height:1.6;margin:0 0 16px">You\'ve just become someone\'s bridge between classroom and career.</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;margin:0 0 16px;color:#4a3b31">' +
    '<strong style="color:#B85C38">What happens next:</strong> our team at Sri Sri University will reach out soon to find a way of mentoring that suits your time and interests.</p>' +
    '<p style="font-family:Arial,sans-serif;font-size:13px;color:#7a6a5e;margin:24px 0 0;border-top:1px solid #E8D4B0;padding-top:14px">' +
    'You received this because you signed up as a Setu mentor. To have your details removed, simply reply to this email.</p>' +
    '</td></tr></table></div>';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------------------------------------------------------------
   Run this once from the editor (select "setup" → ▶ Run) to authorise the
   script and create the Responses tab. Safe to run again.
   --------------------------------------------------------------------- */
function setup() {
  getSheet_();
  if (SEND_EMAILS) MailApp.getRemainingDailyQuota();   // triggers the email permission prompt
  console.log('Setu is ready. Responses tab: OK. Emails left today: ' + MailApp.getRemainingDailyQuota());
}
