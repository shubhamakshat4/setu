/* =====================================================================
   SETU — Industry Mentor Portal · Sri Sri University
   Plain JavaScript, no libraries. Sections are marked with ===== banners.
   ===================================================================== */

/* =====================================================================
   ⚙️  CONFIG — the only part you normally need to edit
   ===================================================================== */
const CONFIG = {
  // TODO(user): paste your Apps Script web-app URL here (see SETUP.md, step 3).
  // While this still contains "PASTE_", the form runs in DEMO MODE and saves nothing.
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw_qhYtOYMJ4hYSnnWW20cQpPGVEQDCzjiMpqQcJRyRS9GkQ8qu11hSHa40gnRFWAZ4Gw/exec',

  // TODO(user): the public address of this page, e.g. 'https://ssu-setu.netlify.app/'
  // Leave empty ('') to use whatever address the page is opened from.
  PAGE_URL: '',

  // TODO(user): confirm the programme's contact address.
  CONTACT_EMAIL: 'setu@srisriuniversity.edu.in',

  // Hide the live counter until at least this many mentors have joined.
  COUNTER_MIN: 10,
};

/* The WhatsApp / share message. {URL} is replaced with the page link. */
const SHARE_MESSAGE =
  "Hey! Sri Sri University is looking for experienced professionals from our Art of Living family to mentor students 🙏 It's called Setu — just ~1 hour a month. Thought of you instantly! Takes 2 minutes: {URL}";

/* =====================================================================
   📝  THE QUESTIONS — one per screen, in this order.
   Edit wording here. `required: true` = mandatory (★).
   ===================================================================== */
const QUESTIONS = [
  { id: 'fullName', type: 'text', required: true,
    q: 'What should we call you? 😊', placeholder: 'Your full name',
    attrs: { autocomplete: 'name', autocapitalize: 'words' },
    validate: v => v.trim().length >= 2 ? '' : 'Could you share your full name? At least 2 letters 😊' },

  { id: 'company', type: 'text', required: true,
    q: 'Where do you work your magic?', placeholder: 'Company or organisation',
    attrs: { autocomplete: 'organization', autocapitalize: 'words' },
    validate: v => v.trim() ? '' : 'Which company? Even “Self-employed” works 🙂' },

  { id: 'designation', type: 'text', required: true,
    q: 'And your role there?', placeholder: 'e.g. Senior Product Manager',
    attrs: { autocomplete: 'organization-title', autocapitalize: 'words' },
    validate: v => v.trim() ? '' : 'Your role, please — a rough title is fine 🙂' },

  { id: 'experience', type: 'single', required: true,
    q: 'How long have you been in the industry?',
    options: [
      { value: '<3',    label: 'Under 3 yrs' },
      { value: '3-5',   label: 'Rising Star',      sub: '3–5 yrs' },
      { value: '5-10',  label: 'Seasoned Pro',     sub: '5–10 yrs' },
      { value: '10-20', label: 'Industry Veteran', sub: '10–20 yrs' },
      { value: '20+',   label: 'Living Legend',    sub: '20+ yrs' },
    ],
    stack: true,
    note: v => v === '<3' ? 'Early-career voices are valuable too! 🌱' : '',
    validate: v => v ? '' : 'Pick the one that fits best 🙂' },

  { id: 'phone', type: 'tel', required: true,
    q: 'Best number to reach you?', placeholder: '98765 43210',
    attrs: { autocomplete: 'tel', inputmode: 'tel' },
    validate: v => phoneError(v) },

  { id: 'email', type: 'email', required: true,
    q: 'And your email?', placeholder: 'you@company.com',
    attrs: { autocomplete: 'email', inputmode: 'email', autocapitalize: 'off', spellcheck: 'false' },
    validate: v => !v.trim() ? 'We’ll need an email to send you the details 🙂'
                 : isEmail(v) ? '' : 'Hmm, that email doesn’t look quite right 🤔' },

  { id: 'domains', type: 'multi',
    q: 'Which domain are you in?', help: 'Pick any that apply.',
    options: ['IT / Software', 'Data & AI', 'Finance & Banking', 'Consulting', 'Marketing & Sales', 'HR',
              'Operations & Supply Chain', 'Product Management', 'Entrepreneurship', 'Other'],
    otherValue: 'Other', otherId: 'domainsOther', otherPlaceholder: 'Tell us your domain' },

  { id: 'waysToHelp', type: 'multi',
    q: 'How would you like to help?', help: 'Even one is plenty.',
    options: ['Career talks', 'Mock interviews & resume reviews', 'Guiding student projects',
              'Internships at your company', 'One-on-one mentoring', 'Open to anything'] },

  { id: 'timeCommitment', type: 'single',
    q: 'How much time could you give?', stack: true,
    options: ['~1 hr/month', '2–3 hrs/month', 'More, I’m excited!', 'Occasional, as available'] },

  { id: 'aolConnection', type: 'single',
    q: 'Your connection with The Art of Living?', stack: true,
    options: ['Teacher', 'Volunteer', 'Participant / practitioner', 'Prefer not to say'] },

  { id: 'city', type: 'text',
    q: 'City you’re based in?', placeholder: 'e.g. Bengaluru',
    attrs: { autocomplete: 'address-level2', autocapitalize: 'words' } },

  { id: 'linkedin', type: 'url',
    q: 'LinkedIn profile?', placeholder: 'linkedin.com/in/yourname',
    attrs: { autocomplete: 'url', inputmode: 'url', autocapitalize: 'off', spellcheck: 'false' },
    validate: v => !v.trim() || normaliseUrl(v) ? '' : 'That doesn’t look like a link yet — e.g. linkedin.com/in/yourname' },

  { id: 'heardFrom', type: 'text',
    q: 'How did you hear about Setu?', placeholder: 'A friend, a WhatsApp group…' },

  { id: 'message', type: 'textarea', max: 500,
    q: 'Anything you’d like to share?', placeholder: 'A thought, an idea, a question… (optional)' },

  { id: 'consent', type: 'consent', required: true,
    q: 'One last thing 🙏',
    label: 'I agree that Sri Sri University may store my details and contact me about the Setu mentorship programme. My details won’t be shared outside SSU without my permission.',
    validate: v => v ? '' : 'Please tick the box so we can stay in touch 🙏' },
];

/* =====================================================================
   🔧  SMALL HELPERS
   ===================================================================== */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer   = matchMedia('(hover: hover) and (pointer: fine)').matches;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const scriptReady = () => /^https:\/\/script\.google(usercontent)?\.com\//.test(CONFIG.SCRIPT_URL);

// localStorage can throw (private mode, blocked storage) — never let that break the page
const store = {
  get(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k)    { try { localStorage.removeItem(k); } catch (e) {} },
};
const SAVE_KEY = 'setu-form-v1';

function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }

/* Indian mobile: 10 digits starting 6–9, optional +91 / 91 / 0 prefix → "+91XXXXXXXXXX" */
function phoneDigits(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
function normalisePhone(v) {
  const d = phoneDigits(v);
  return /^[6-9]\d{9}$/.test(d) ? '+91' + d : '';
}
function phoneError(v) {
  const d = phoneDigits(v);
  if (!d) return 'We’ll need a number to reach you 🙂';
  if (d.length === 9) return 'Hmm, that number looks a digit short 🤔';
  if (d.length < 10) return 'Hmm, that number looks a little short 🤔';
  if (d.length > 10) return 'That looks like a digit or two too many 🤔';
  if (!/^[6-9]/.test(d)) return 'Indian mobile numbers start with 6, 7, 8 or 9 🤔';
  return '';
}

/* Loose URL check: accepts "linkedin.com/in/x" and adds https:// */
function normaliseUrl(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    return /\.[a-z]{2,}$/i.test(u.hostname) ? u.href : '';
  } catch (e) { return ''; }
}

/* ?ref= parameter — tells you which group / person the visitor came from */
const incomingRef = (() => {
  const r = new URLSearchParams(location.search).get('ref') || '';
  return r.replace(/[^\p{L}\p{N} _.\-]/gu, '').slice(0, 60);
})();

function pageUrl(ref) {
  const base = CONFIG.PAGE_URL || (location.origin + location.pathname);
  const u = new URL(base, location.href);
  u.search = '';
  u.hash = '';
  if (ref) u.searchParams.set('ref', ref);
  return u.href;
}

let toastTimer;
function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-shown');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-shown'), ms);
}

/* =====================================================================
   🌙  HERO — image fade-in, moon glow position, word-by-word headline
   ===================================================================== */
function initHero() {
  const img = $('.hero__img');
  const onLoad = () => { img.classList.add('is-loaded'); positionMoon(); };
  if (img.complete && img.naturalWidth) onLoad(); else img.addEventListener('load', onLoad);

  // Wrap every word in a <span> so each can rise in turn
  let wi = 0;
  $$('.words').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.style.setProperty('--wi', wi++);
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  addEventListener('resize', positionMoon, { passive: true });
}

/* The moon sits at a known spot in the photo; work out where that lands on screen
   (after object-fit: cover cropping) so the glow and the Ken Burns zoom centre on it. */
const MOON = { x: 0.4227, y: 0.2627, r: 0.065, w: 724, h: 1024 };
function positionMoon() {
  const media = $('.hero__media'), img = $('.hero__img');
  const cw = media.clientWidth, ch = media.clientHeight;
  const s = Math.max(cw / MOON.w, ch / MOON.h);
  const w = MOON.w * s, h = MOON.h * s;
  const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
  const x = (cw - w) * (isNaN(px) ? 0.5 : px) + MOON.x * w;
  const y = (ch - h) * (isNaN(py) ? 0.5 : py) + MOON.y * h;
  media.style.setProperty('--moon-x', x.toFixed(1) + 'px');
  media.style.setProperty('--moon-y', y.toFixed(1) + 'px');
  media.style.setProperty('--moon-r', (MOON.r * w).toFixed(1) + 'px');
}

/* =====================================================================
   ✨  SCROLL REVEALS, SELF-DRAWING BRIDGE, PARALLAX
   ===================================================================== */
function initReveals() {
  // 80ms stagger between siblings inside [data-stagger]
  $$('[data-stagger]').forEach(group => {
    $$('.reveal', group).forEach((el, i) => el.style.setProperty('--i', i));
  });

  const targets = [...$$('.reveal'), ...$$('.rule'), $('.bridge')];
  if (!('IntersectionObserver' in window)) {
    targets.forEach(el => el.classList.add('is-visible', 'is-drawn'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add(e.target.classList.contains('bridge') ? 'is-drawn' : 'is-visible');
      io.unobserve(e.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  targets.forEach(el => io.observe(el));
}

/* Parallax — desktop only (mouse/trackpad); off on touch devices and for reduced motion */
function initParallax() {
  if (!finePointer || reducedMotion) return;
  const hero = $('[data-parallax="hero"]');
  const bands = $$('[data-parallax="band"]');
  let ticking = false;

  function update() {
    ticking = false;
    const vh = innerHeight;
    if (scrollY < vh * 1.2) hero.style.transform = `translate3d(0, ${(scrollY * 0.35).toFixed(1)}px, 0)`;
    bands.forEach(img => {
      const box = img.parentElement.getBoundingClientRect();
      if (box.bottom < 0 || box.top > vh) return;
      const room = box.height * 0.15;                       // image is 30% taller than its band
      const progress = (box.top + box.height / 2 - vh / 2) / (vh / 2 + box.height / 2); // -1 … 1
      img.style.transform = `translate3d(0, ${(-progress * room).toFixed(1)}px, 0)`;
    });
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

/* =====================================================================
   🔢  LIVE COUNTER — "✨ N mentors have joined Setu"
   Hidden unless the Sheet answers AND N ≥ COUNTER_MIN.
   ===================================================================== */
async function initCounter() {
  if (!scriptReady()) return;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(CONFIG.SCRIPT_URL, { signal: ctrl.signal });
    const data = await res.json();
    const n = Number(data && data.count);
    if (!Number.isFinite(n) || n < CONFIG.COUNTER_MIN) return;
    const box = $('#counter'), num = $('#counterNum');
    box.hidden = false;
    if (reducedMotion) { num.textContent = n; return; }
    const run = () => {
      const t0 = performance.now(), dur = 1800;
      (function tick(t) {
        const p = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - p, 3);
        num.textContent = Math.round(n * eased);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { run(); io.disconnect(); } });
    io.observe(box);
  } catch (e) { /* stay hidden */ }
}

/* =====================================================================
   📣  SHARING — WhatsApp, copy link, Web Share
   ===================================================================== */
let shareRef = '';   // becomes the submitter's first name after they sign up

const ICONS = {
  wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
};

const shareText = () => SHARE_MESSAGE.replace('{URL}', pageUrl(shareRef));

function renderShareRows() {
  $$('[data-share-row]').forEach(row => {
    $$('.share-btn', row).forEach(b => b.remove());

    const wa = document.createElement('a');
    wa.className = 'share-btn share-btn--wa';
    wa.href = 'https://wa.me/?text=' + encodeURIComponent(shareText());
    wa.target = '_blank';
    wa.rel = 'noopener';
    wa.innerHTML = ICONS.wa + '<span>WhatsApp</span>';
    wa.setAttribute('aria-label', 'Share on WhatsApp');
    row.appendChild(wa);

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'share-btn';
    copy.innerHTML = ICONS.copy + '<span>Copy link</span>';
    copy.setAttribute('aria-label', 'Copy link to this page');
    copy.addEventListener('click', copyLink);
    row.appendChild(copy);

    if (navigator.share) {
      const sh = document.createElement('button');
      sh.type = 'button';
      sh.className = 'share-btn';
      sh.innerHTML = ICONS.share + '<span>Share</span>';
      sh.setAttribute('aria-label', 'Share using another app');
      sh.addEventListener('click', () => navigator.share({ title: 'Setu · Sri Sri University', text: shareText() }).catch(() => {}));
      row.appendChild(sh);
    }
  });
}

async function copyLink() {
  const url = pageUrl(shareRef);
  try {
    await navigator.clipboard.writeText(url);
  } catch (e) {
    const ta = document.createElement('textarea');       // older in-app browsers
    ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (err) {}
    ta.remove();
  }
  toast('Copied! ✓');
}

/* Background becomes non-interactive while a dialog is open */
function setBackgroundInert(on) {
  ['.hero', 'main', '.footer', '.skip-link'].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
  });
  document.body.classList.toggle('is-locked', on);
}

function initShareSheet() {
  const sheet = $('#shareSheet');
  let opener = null;
  const close = () => { sheet.hidden = true; setBackgroundInert(false); opener && opener.focus(); };
  $$('[data-open-share]').forEach(b => b.addEventListener('click', () => {
    opener = b;
    sheet.hidden = false;
    setBackgroundInert(true);
    $('.sheet__close', sheet).focus();
  }));
  $$('[data-close-sheet]', sheet).forEach(b => b.addEventListener('click', close));
  sheet.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* =====================================================================
   🧾  THE FORM — one question per screen
   ===================================================================== */
const REVIEW = QUESTIONS.length;              // index of the review screen
const state = { step: 0, answers: {}, returnToReview: false, submitted: false, pushedHistory: false };
let stepEls = [];
let busy = false;

const overlay = () => $('#formOverlay');

function buildSteps() {
  const wrap = $('#steps');
  wrap.innerHTML = '';
  stepEls = QUESTIONS.map((q, i) => {
    const el = document.createElement('div');
    el.className = 'step';
    el.hidden = true;
    el.tabIndex = -1;
    el.style.outline = 'none';
    el.dataset.step = i;
    const req = q.required ? ' <span class="req" aria-hidden="true">★</span>' : '';
    const reqSr = q.required ? '<span class="visually-hidden"> (required)</span>' : '';
    const count = `<p class="step__count">${i + 1} of ${QUESTIONS.length}${q.required ? '' : ' · optional'}</p>`;
    const help = q.help ? `<p class="step__help" id="help-${q.id}">${q.help}</p>` : '';
    const err = `<p class="error" id="err-${q.id}" aria-live="polite"></p>`;
    const described = `err-${q.id}${q.help ? ' help-' + q.id : ''}`;
    let html = '';

    if (['text', 'email', 'tel', 'url'].includes(q.type)) {
      const attrs = Object.entries(q.attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
      const type = q.type === 'url' ? 'text' : q.type;       // "url" type is too strict on phones
      html = `${count}<label class="step__q" for="f-${q.id}">${q.q}${req}${reqSr}</label>${help}
        <input class="input" id="f-${q.id}" name="${q.id}" type="${type}" placeholder="${q.placeholder || ''}"
               data-qid="${q.id}" ${attrs} enterkeyhint="next" aria-describedby="${described}" ${q.required ? 'aria-required="true"' : ''}>
        ${err}`;
    } else if (q.type === 'textarea') {
      html = `${count}<label class="step__q" for="f-${q.id}">${q.q}</label>
        <textarea class="input" id="f-${q.id}" name="${q.id}" maxlength="${q.max}" rows="5" placeholder="${q.placeholder || ''}"
                  data-qid="${q.id}" aria-describedby="${described} cc-${q.id}"></textarea>
        <p class="charcount" id="cc-${q.id}"><span>0</span> / ${q.max}</p>${err}`;
    } else if (q.type === 'single' || q.type === 'multi') {
      const inputType = q.type === 'single' ? 'radio' : 'checkbox';
      const chips = q.options.map((o, k) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return `<label class="chip"><input type="${inputType}" name="${q.id}" value="${opt.value}" data-qid="${q.id}" id="f-${q.id}-${k}">
                <span>${opt.label}${opt.sub ? ` <small>${opt.sub}</small>` : ''}</span></label>`;
      }).join('');
      const other = q.otherId ? `<input class="input other-input" id="f-${q.otherId}" data-qid="${q.otherId}" type="text"
                     placeholder="${q.otherPlaceholder}" aria-label="${q.otherPlaceholder}" hidden>` : '';
      html = `${count}<fieldset class="step__field" aria-describedby="${described}">
          <legend class="step__q">${q.q}${req}${reqSr}</legend>${help}
          <div class="chips ${q.stack ? 'chips--stack' : ''}">${chips}</div>${other}
        </fieldset><div class="note-slot" aria-live="polite"></div>${err}`;
    } else if (q.type === 'consent') {
      html = `${count}<p class="step__q" id="q-${q.id}">${q.q}</p>
        <label class="consent"><input type="checkbox" id="f-${q.id}" data-qid="${q.id}" aria-describedby="err-${q.id}" aria-required="true">
        <span>${q.label}</span></label>${err}`;
    }
    el.innerHTML = html;
    wrap.appendChild(el);
    return el;
  });

  // Review screen
  const rv = document.createElement('div');
  rv.className = 'step';
  rv.hidden = true;
  rv.tabIndex = -1;
  rv.style.outline = 'none';
  rv.innerHTML = `<p class="step__count">Review</p>
    <p class="step__q">Everything look right?</p>
    <ul class="review" id="reviewList"></ul>
    <div class="submit-error" id="submitError" role="alert" hidden></div>`;
  wrap.appendChild(rv);
  stepEls.push(rv);
}

/* Put saved answers back into the inputs */
function fillFields() {
  const a = state.answers;
  QUESTIONS.forEach(q => {
    if (['text', 'email', 'tel', 'url', 'textarea'].includes(q.type)) {
      const el = $(`#f-${q.id}`);
      el.value = a[q.id] || '';
      if (q.type === 'textarea') $(`#cc-${q.id} span`).textContent = el.value.length;
    } else if (q.type === 'single') {
      $$(`input[name="${q.id}"]`).forEach(r => { r.checked = r.value === a[q.id]; });
      showNote(q);
    } else if (q.type === 'multi') {
      const arr = a[q.id] || [];
      $$(`input[name="${q.id}"]`).forEach(c => { c.checked = arr.includes(c.value); });
      if (q.otherId) {
        const o = $(`#f-${q.otherId}`);
        o.value = a[q.otherId] || '';
        o.hidden = !arr.includes(q.otherValue);
      }
    } else if (q.type === 'consent') {
      $(`#f-${q.id}`).checked = !!a[q.id];
    }
  });
}

function showNote(q) {
  if (!q.note) return;
  const slot = $('.note-slot', stepEls[QUESTIONS.indexOf(q)]);
  const msg = q.note(state.answers[q.id]);
  slot.innerHTML = msg ? `<p class="note">${msg}</p>` : '';
}

/* Read a changed input into state.answers */
function onFieldChange(e) {
  const el = e.target;
  const id = el.dataset.qid;
  if (!id) return;
  const q = QUESTIONS.find(x => x.id === id);
  if (!q) {                                   // an "Other" free-text box
    state.answers[id] = el.value;
  } else if (q.type === 'multi') {
    state.answers[id] = $$(`input[name="${id}"]:checked`).map(c => c.value);
    if (q.otherId) {
      const o = $(`#f-${q.otherId}`);
      const on = state.answers[id].includes(q.otherValue);
      if (on && o.hidden) { o.hidden = false; if (e.type === 'change') o.focus(); }
      if (!on) o.hidden = true;
    }
  } else if (q.type === 'single') {
    state.answers[id] = el.value;
    showNote(q);
  } else if (q.type === 'consent') {
    state.answers[id] = el.checked;
  } else {
    state.answers[id] = el.value;
    if (q.type === 'textarea') $(`#cc-${id} span`).textContent = el.value.length;
  }
  if (q) setError(q, '');
  save();
  updateChrome(false);
}

function setError(q, msg) {
  const err = $(`#err-${q.id}`);
  if (err) err.textContent = msg;
  const input = $(`#f-${q.id}`);
  if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

function validateStep(i) {
  const q = QUESTIONS[i];
  if (!q || !q.validate) return true;
  const v = state.answers[q.id];
  const msg = q.validate(typeof v === 'string' ? v : (v || ''));
  setError(q, msg);
  if (msg) {
    const input = $(`#f-${q.id}`) || $(`input[name="${q.id}"]`);
    input && input.focus({ preventScroll: true });
  }
  return !msg;
}

const isEmpty = v => v == null || v === '' || v === false || (Array.isArray(v) && !v.length);

/* Progress bar, milestone microcopy, button labels */
function updateChrome(announce = true) {
  const i = state.step, q = QUESTIONS[i];
  const pct = i >= REVIEW ? 100 : Math.round((i / QUESTIONS.length) * 100);
  $('#progressBar').style.width = pct + '%';

  const ms = $('#milestone');
  ms.textContent = i >= 12 ? 'Almost done! 🎉' : i >= 7 ? 'Halfway there ✨' : i >= 1 ? 'Great start!' : '';

  const back = $('#backBtn'), next = $('#nextBtn');
  back.style.visibility = i === 0 ? 'hidden' : 'visible';
  next.disabled = false;
  if (i === REVIEW) {
    next.textContent = 'Join Setu 🌉';
    next.disabled = !state.answers.consent;
  } else if (state.returnToReview) {
    next.textContent = 'Back to review';
  } else if (q.type === 'consent') {
    next.textContent = 'Review my answers';
    next.disabled = !state.answers.consent;
  } else if (!q.required && isEmpty(state.answers[q.id])) {
    next.textContent = 'Skip →';
  } else {
    next.textContent = 'Next →';
  }

  if (announce) {
    $('#stepAnnouncer').textContent = i === REVIEW
      ? 'Review your answers'
      : `Question ${i + 1} of ${QUESTIONS.length}: ${q.q}`;
  }
}

function focusStep() {
  const el = stepEls[state.step], q = QUESTIONS[state.step];
  if (q && ['text', 'email', 'tel', 'url', 'textarea'].includes(q.type)) {
    $(`#f-${q.id}`).focus({ preventScroll: true });
  } else {
    el.focus({ preventScroll: true });
  }
}

function showStep(i, dir) {
  state.step = i;
  const el = stepEls[i];
  if (i === REVIEW) renderReview();
  el.hidden = false;
  el.classList.remove('anim-in-next', 'anim-in-prev');
  void el.offsetWidth;                                   // restart the animation
  el.classList.add(dir < 0 ? 'anim-in-prev' : 'anim-in-next');
  $('#steps').scrollTop = 0;
  updateChrome();
  focusStep();
  save();
}

function go(to, dir) {
  if (busy || to === state.step || to < 0 || to > REVIEW) return;
  busy = true;
  const from = stepEls[state.step];
  const out = dir < 0 ? 'anim-out-prev' : 'anim-out-next';
  from.classList.remove('anim-in-next', 'anim-in-prev');
  from.classList.add(out);
  setTimeout(() => {
    from.hidden = true;
    from.classList.remove(out);
    showStep(to, dir);
    busy = false;
  }, reducedMotion ? 0 : 220);
}

function next() {
  if (busy) return;
  if (state.step === REVIEW) return submit();
  if (!validateStep(state.step)) return;
  if (state.returnToReview) { state.returnToReview = false; return go(REVIEW, 1); }
  go(state.step + 1, 1);
}
function back() {
  if (state.returnToReview) state.returnToReview = false;
  go(state.step - 1, -1);
}

/* Readable answer for the review list */
function displayAnswer(q) {
  const v = state.answers[q.id];
  if (isEmpty(v)) return '';
  if (q.id === 'experience') return (q.options.find(o => o.value === v) || {}).label + (v === '<3' ? '' : ` (${q.options.find(o => o.value === v).sub})`);
  if (q.id === 'phone') return normalisePhone(v) || v;
  if (q.type === 'consent') return 'Yes, I agree';
  if (Array.isArray(v)) {
    return v.map(x => (q.otherId && x === q.otherValue && state.answers[q.otherId]) ? `Other: ${state.answers[q.otherId]}` : x).join(', ');
  }
  return v;
}

function renderReview() {
  const list = $('#reviewList');
  list.innerHTML = '';
  QUESTIONS.forEach((q, i) => {
    const li = document.createElement('li');
    const rq = document.createElement('span'); rq.className = 'rq';
    rq.textContent = q.type === 'consent' ? 'Consent' : q.q.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '').trim();
    const ra = document.createElement('span');
    const ans = displayAnswer(q);
    ra.className = 'ra' + (ans ? '' : ' empty');
    ra.textContent = ans || 'Skipped';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.className = 'edit'; edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit: ${rq.textContent}`);
    edit.addEventListener('click', () => { state.returnToReview = true; go(i, -1); });
    li.append(rq, ra, edit);
    list.appendChild(li);
  });
}

/* ---------- autosave ---------- */
function save() {
  if (state.submitted) return;
  store.set(SAVE_KEY, { answers: state.answers, step: state.step, t: Date.now() });
}

/* ---------- open / close ---------- */
function openForm() {
  const ov = overlay();
  if (!ov.hidden) return;
  if (state.submitted) resetForm();            // a fresh form after a previous sign-up
  ov.hidden = false;
  setBackgroundInert(true);
  $('#mentorForm').hidden = false;
  $('.form-top').hidden = false;
  $('#thanks').hidden = true;
  stepEls.forEach(s => (s.hidden = true));
  showStep(state.step, 1);
  try { history.pushState({ setuForm: true }, ''); state.pushedHistory = true; } catch (e) {}
}

function hideForm() {
  const ov = overlay();
  if (ov.hidden) return;
  ov.hidden = true;
  setBackgroundInert(false);
  stopConfetti();
  state.pushedHistory = false;
  if (!state.submitted && Object.keys(state.answers).some(k => !isEmpty(state.answers[k]))) {
    toast('Your answers are saved — come back any time ✨');
  }
  const opener = $('[data-open-form]');
  opener && opener.focus({ preventScroll: true });
}

function closeForm() {
  // If we added a history entry, going "back" closes the form (so the phone's Back button works too)
  if (state.pushedHistory && history.state && history.state.setuForm) history.back();
  else hideForm();
}

function resetForm() {
  state.answers = incomingRef ? { heardFrom: incomingRef } : {};
  state.step = 0;
  state.returnToReview = false;
  state.submitted = false;
  fillFields();
  QUESTIONS.forEach(q => setError(q, ''));
  $('#submitError').hidden = true;
}

/* ---------- submit ---------- */
async function submit() {
  if (!state.answers.consent) return;
  const btn = $('#nextBtn'), backBtn = $('#backBtn'), err = $('#submitError');
  // Re-check every mandatory answer before sending
  for (let i = 0; i < QUESTIONS.length; i++) {
    const q = QUESTIONS[i];
    if (q.validate && q.validate(typeof state.answers[q.id] === 'string' ? state.answers[q.id] : (state.answers[q.id] || ''))) {
      state.returnToReview = true;
      go(i, -1);
      setTimeout(() => validateStep(i), 300);
      return;
    }
  }

  err.hidden = true;
  btn.classList.add('is-loading');
  btn.textContent = 'Building your bridge… 🌉';
  btn.disabled = true;
  backBtn.disabled = true;

  const a = state.answers;
  const domains = (a.domains || []).map(d => (d === 'Other' && a.domainsOther) ? `Other: ${a.domainsOther.trim()}` : d);
  const payload = {
    fullName: (a.fullName || '').trim(),
    company: (a.company || '').trim(),
    designation: (a.designation || '').trim(),
    experience: a.experience || '',
    phone: normalisePhone(a.phone),
    email: (a.email || '').trim().toLowerCase(),
    domains: domains.join('; '),
    waysToHelp: (a.waysToHelp || []).join('; '),
    timeCommitment: a.timeCommitment || '',
    aolConnection: a.aolConnection || '',
    city: (a.city || '').trim(),
    linkedin: normaliseUrl(a.linkedin),
    heardFrom: (a.heardFrom || '').trim(),
    message: (a.message || '').trim().slice(0, 500),
    consent: a.consent === true,
    sourceRef: incomingRef,
    userAgent: navigator.userAgent.slice(0, 300),
    website: $('#website').value,                  // honeypot
  };

  let demo = false;
  try {
    if (!scriptReady()) {
      demo = true;
      console.warn('[Setu] DEMO MODE — SCRIPT_URL is not set in app.js, nothing was saved.', payload);
      await sleep(1400);
    } else {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // "simple" request → no CORS preflight
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!data || data.status !== 'success') throw new Error((data && data.message) || 'Unknown error');
    }
  } catch (e) {
    console.error('[Setu] submit failed:', e);
    err.textContent = 'Something went wrong, but your answers are saved. Please try again.' +
      (e && e.message && !/fetch|network|abort|json|unexpected/i.test(e.message) ? ` (${e.message})` : '');
    err.hidden = false;
    btn.classList.remove('is-loading');
    backBtn.disabled = false;
    updateChrome(false);
    return;
  }

  // 🎉 Success
  btn.classList.remove('is-loading');
  backBtn.disabled = false;
  state.submitted = true;
  store.del(SAVE_KEY);
  const firstName = payload.fullName.split(/\s+/)[0].slice(0, 30);
  shareRef = firstName;
  renderShareRows();
  showThanks(firstName, demo);
}

function initForm() {
  buildSteps();

  // Restore a half-filled form
  const saved = store.get(SAVE_KEY);
  if (saved && saved.answers) {
    state.answers = saved.answers;
    state.step = Math.min(Math.max(0, saved.step | 0), REVIEW);
  }
  if (incomingRef && !state.answers.heardFrom) state.answers.heardFrom = incomingRef;
  fillFields();

  const form = $('#mentorForm');
  form.addEventListener('input', onFieldChange);
  form.addEventListener('change', onFieldChange);
  form.addEventListener('submit', e => { e.preventDefault(); next(); });
  form.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.isComposing) return;
    if (e.target.tagName === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;   // new line in the message box
    if (e.target.tagName === 'BUTTON') return;
    e.preventDefault();
    if (!$('#nextBtn').disabled) next();
  });
  $('#nextBtn').addEventListener('click', next);
  $('#backBtn').addEventListener('click', back);

  $$('[data-open-form]').forEach(b => b.addEventListener('click', openForm));
  $('#closeForm').addEventListener('click', closeForm);
  $$('[data-close-form]').forEach(b => b.addEventListener('click', closeForm));
  overlay().addEventListener('keydown', e => { if (e.key === 'Escape') closeForm(); });
  addEventListener('popstate', () => { if (!overlay().hidden) hideForm(); });

  if (location.hash === '#join') openForm();      // direct link straight into the form
}

/* =====================================================================
   🎉  THANK-YOU — confetti + shareable badge
   ===================================================================== */
let badgeBlob = null;

function showThanks(firstName, demo) {
  $('#mentorForm').hidden = true;
  $('.form-top').hidden = true;
  $('[data-first-name]').textContent = firstName;
  $('#demoNote').hidden = !demo;
  const t = $('#thanks');
  t.hidden = false;
  t.scrollTop = 0;
  $('#thanksTitle').setAttribute('tabindex', '-1');
  $('#thanksTitle').focus({ preventScroll: true });
  startConfetti();
  makeBadge(firstName);
}

/* --- Slow gold confetti (hand-written, no library) --- */
let confettiRaf = null;
function startConfetti() {
  if (reducedMotion) return;
  const c = $('#confetti'), ctx = c.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr;
  const colours = ['#E9B44C', '#F3CF7A', '#FDF6EC', '#D98E6A', '#E8D4B0'];
  const pieces = Array.from({ length: Math.min(160, Math.round(innerWidth / 3)) }, () => ({
    x: Math.random() * W, y: -Math.random() * H * 0.9,
    w: (5 + Math.random() * 6) * dpr, h: (9 + Math.random() * 8) * dpr,
    vy: (0.7 + Math.random() * 1.1) * dpr, sway: Math.random() * Math.PI * 2, swaySpeed: 0.01 + Math.random() * 0.02,
    rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.06,
    colour: colours[(Math.random() * colours.length) | 0],
  }));
  const start = performance.now(), life = 7500;
  cancelAnimationFrame(confettiRaf);
  (function frame(now) {
    const age = now - start;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = age > life - 1500 ? Math.max(0, (life - age) / 1500) : 1;
    pieces.forEach(p => {
      p.y += p.vy; p.sway += p.swaySpeed; p.rot += p.vr;
      const x = p.x + Math.sin(p.sway) * 24 * dpr;
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.sway * 2));           // gentle paper flutter
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (age < life) confettiRaf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  })(start);
}
function stopConfetti() {
  cancelAnimationFrame(confettiRaf);
  const c = $('#confetti');
  c.getContext('2d').clearRect(0, 0, c.width, c.height);
}

/* --- 1080×1080 "I'm a Setu Mentor" badge --- */
function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

async function makeBadge(firstName) {
  const S = 1080;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  try { await Promise.all([document.fonts.load('600 100px "Cormorant Garamond"'), document.fonts.load('italic 500 80px "Cormorant Garamond"'), document.fonts.load('600 26px Inter')]); } catch (e) {}

  // Background: the building at dusk, darkened
  ctx.fillStyle = '#1B2A4A';
  ctx.fillRect(0, 0, S, S);
  try {
    const img = await loadImage('assets/ssu-building.jpg');
    const scale = S / img.width, h = img.height * scale;
    ctx.drawImage(img, 0, -0.1 * h, S, h);
  } catch (e) { /* plain twilight if the photo can't load */ }
  let g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, 'rgba(27,42,74,.25)');
  g.addColorStop(0.45, 'rgba(27,42,74,.55)');
  g.addColorStop(0.62, 'rgba(27,42,74,.92)');
  g.addColorStop(1, 'rgba(27,42,74,.98)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Moonlight glow (moon is ~ (457, 250) at this crop)
  g = ctx.createRadialGradient(457, 250, 10, 457, 250, 240);
  g.addColorStop(0, 'rgba(255,240,205,.45)');
  g.addColorStop(1, 'rgba(233,180,76,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // Thin gold frame
  ctx.strokeStyle = 'rgba(233,180,76,.7)';
  ctx.lineWidth = 3;
  roundRect(ctx, 36, 36, S - 72, S - 72, 34);
  ctx.stroke();

  // Gold bridge motif
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#E9B44C';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(300, 640); ctx.quadraticCurveTo(540, 500, 780, 640); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(260, 640); ctx.lineTo(820, 640); ctx.stroke();
  ctx.lineWidth = 3;
  for (let x = 348; x <= 732; x += 48) {
    const t = (x - 300) / 480, y = 640 * (1 - t) * (1 - t) + 2 * t * (1 - t) * 500 + 640 * t * t;
    ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, 636); ctx.stroke();
  }

  // Text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#E9B44C';
  fitText(ctx, firstName, 'italic 500', 96, '"Cormorant Garamond", Georgia, serif', 820);
  ctx.fillText(firstName, S / 2, 760);

  ctx.fillStyle = '#FDF6EC';
  fitText(ctx, 'I’m a Setu Mentor 🌉', '600', 104, '"Cormorant Garamond", Georgia, serif', 900);
  ctx.fillText('I’m a Setu Mentor 🌉', S / 2, 870);

  ctx.fillStyle = '#E8D4B0';
  ctx.font = '600 26px Inter, system-ui, sans-serif';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
  ctx.fillText('SRI SRI UNIVERSITY · INDUSTRY MENTORSHIP', S / 2, 960);

  c.toBlob(blob => {
    badgeBlob = blob;
    const url = URL.createObjectURL(blob);
    $('#badgeImg').src = url;
    $('#downloadBadge').href = url;
  }, 'image/png');
}

function fitText(ctx, text, weight, size, family, maxW) {
  do { ctx.font = `${weight} ${size}px ${family}`; size -= 4; } while (ctx.measureText(text).width > maxW && size > 30);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function initBadgeButtons() {
  $('#downloadBadge').addEventListener('click', e => { if (!badgeBlob) { e.preventDefault(); toast('Your badge is still being made…'); } });
  $('#shareBadge').addEventListener('click', async () => {
    if (!badgeBlob) return toast('Your badge is still being made…');
    const file = new File([badgeBlob], 'setu-mentor-badge.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: shareText() }); } catch (e) { /* cancelled */ }
    } else {
      $('#downloadBadge').click();
      toast('Badge downloaded — share it anywhere! 🌉');
    }
  });
}

/* =====================================================================
   🚀  START
   ===================================================================== */
function applyContactEmail() {
  $$('[data-contact-email]').forEach(a => {
    a.href = 'mailto:' + CONFIG.CONTACT_EMAIL;
    if (a.textContent.includes('@')) a.textContent = CONFIG.CONTACT_EMAIL;
  });
}

initHero();
initReveals();
initParallax();
initCounter();
renderShareRows();
initShareSheet();
initForm();
initBadgeButtons();
applyContactEmail();
