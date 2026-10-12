# Assumptions & judgement calls

Every decision I made where the brief was open, why, and how to change it.

## Brand & visuals

| # | Assumption | Why | How to change |
|---|---|---|---|
| 1 | **Colours use the fallback palette** from the brief (terracotta, twilight, gold…), plus one extra: `--maroon #6F2816`, sampled from the SSU logo. | Fetching srisriuniversity.edu.in worked, but the page doesn't expose its brand colours or fonts in a form I could extract. It only gave the logo URL. | Edit the `:root { … }` block at the top of `style.css`. Every colour on the page comes from there. |
| 2 | Also added `--terracotta-dk #96482A` for small text on cream. | Plain terracotta on cream is about 4.4:1, just under the AA minimum of 4.5:1. The darker shade passes. | Same `:root` block. |
| 3 | **Logo:** used your `assets/ssu_logo.png`, trimmed and resized to `assets/ssu-logo.png`, on a soft cream "pill" in the hero. | The logo is maroon on a transparent background and would be unreadable directly over the dark dusk sky. | Replace `assets/ssu-logo.png` (keep the name). To remove the pill, delete the `background` line in `.logo` in `style.css`. |
| 4 | **Hero photo** is your `ssu-building.jfif`, converted to `ssu-building.jpg` (111 KB) and `ssu-building.webp` (70 KB, well under 250 KB). | Browsers handle `.jpg`/`.webp` more reliably than `.jfif`. | Replace both files with a new photo of the same name. If the moon moves, update `MOON` in `app.js`: its x/y position as a fraction of the photo's width and height. |
| 5 | **The source photo is only 724×1024 px.** On desktop I switched to a split layout: text on the left, building on the right, so the photo isn't blown up to full width and blurry. On phones it's full-bleed, as specified. | Upscaling a 724 px image to 1440 px looked soft. | If you get a higher-resolution photo (≥ 1600 px wide), replace the files. To make desktop full-bleed too, delete the "Desktop hero" rules inside `@media (min-width: 900px)` in `style.css`. |
| 6 | **Moon glow position** is calculated in JavaScript from where the moon falls after cropping. The Ken Burns zoom is centred on the moon, so the moon stays still while the building "breathes". | With `object-fit: cover`, the crop is different on every screen size. A fixed CSS position would drift off the moon. | `MOON` constant in `app.js`. |
| 7 | The **OG preview** is `assets/og-image.jpg` (95 KB). A PNG version (`og-image.png`, 480 KB) is also included, as you asked. | WhatsApp is unreliable with preview images over ~300 KB, so the meta tags point at the JPG. | To use the PNG, change `og-image.jpg` → `og-image.png` in the meta tags in `index.html`. |
| 8 | The **divider band** and **closing call to action** reuse the same photo file with a different crop and darkening. The form background is a pre-blurred 6 KB copy (`ssu-building-form.jpg`). | This avoids downloading extra images, and blurring the photo in CSS is slow on phones. | `.band--divider .band__img` / `.band--cta .band__img` `object-position` values in `style.css`. |
| 9 | The **closing CTA headline** "One hour a month. A bridge for a lifetime." is my wording. | The brief gave a button and share row for this section but no headline, and the section looked empty without one. | `index.html`, search `cta-title`. |
| 10 | Small section labels ("Ways to give", "With gratitude") above the headings are my additions. | They create a small-caps rhythm, as requested for letterspaced labels. | `index.html`, `class="label"`; delete the lines to remove them. |
| 11 | **Parallax** only runs on devices with a mouse or trackpad. On phones and tablets the images are static. | As the brief asked: better performance on touch devices. | `initParallax()` in `app.js`. |

## Form behaviour

| # | Assumption | How to change |
|---|---|---|
| 12 | The **consent checkbox** is question 15. "Review my answers" stays disabled until it's ticked, and so does the final **Join Setu 🌉** button on the review screen. | `QUESTIONS` in `app.js` |
| 13 | Required single choices (experience) **don't auto-advance** when tapped. You tap **Next**. | This avoids surprise jumps, including when someone taps the wrong chip and lets them see the "Early-career voices…" note. |
| 14 | For optional questions, the button reads **"Skip →"** while the answer is empty. | `updateChrome()` in `app.js` |
| 15 | After tapping **Edit** on the review screen, the button reads **"Back to review"** and returns there directly. | `app.js` |
| 16 | Experience is stored as the codes you specified (`<3`, `3-5`, …). The chips show both the playful name and the years ("Rising Star · 3–5 yrs"). | `QUESTIONS` → `experience` |
| 17 | Multi-selects are saved into one cell, separated by `; `. "Other" becomes `Other: <their text>`. | `submit()` in `app.js` |
| 18 | The LinkedIn field accepts anything that looks like a web address. `linkedin.com/in/x` is saved as `https://linkedin.com/in/x`. It doesn't insist on linkedin.com. | `normaliseUrl()` in `app.js` |
| 19 | Autosave keeps answers in the browser (localStorage) and resumes at the same question. A saved form is cleared after a successful submit. If the browser blocks storage (some private modes), the form still works without saving. | `save()` in `app.js` |
| 20 | Closing the form (✕, Esc, or the phone's **Back** button) keeps answers and shows "Your answers are saved". The phone Back button closes the form instead of leaving the page. | `openForm()/closeForm()` in `app.js` |
| 21 | `?ref=` values are cleaned to letters, numbers, spaces, `-`, `_` and `.`, with a maximum of 60 characters. The ref is saved in **Source Ref** and pre-fills "How did you hear…" (which people can edit). | `incomingRef` in `app.js` |
| 22 | Share links **before** someone signs up point to the clean page, without passing on the ref the visitor arrived with. **After** signing up, they use `?ref=<FirstName>`. | `shareRef` in `app.js` |
| 23 | **Demo mode:** while `SCRIPT_URL` isn't set, submitting shows the full thank-you flow with a visible yellow "Demo mode — not saved" note. This lets you preview everything before the Sheet exists. | Set `SCRIPT_URL` in `app.js` |
| 24 | Extra: `…/#join` opens the form directly. | `initForm()` in `app.js` |
| 25 | Extra: a **share sheet** (bottom panel) opens from "Pass it on to someone perfect", with WhatsApp / Copy link / Share. | `index.html` `#shareSheet` |

## Backend (Code.gs)

| # | Assumption | How to change |
|---|---|---|
| 26 | A **duplicate email** updates the existing row but keeps the original **Timestamp**. Only the welcome email is skipped on updates; you still get an "updated" note. | `writeRow_()` / `sendEmails_()` |
| 27 | The **Consent** column stores `Yes`. | `writeRow_()` |
| 28 | The phone column is set to plain-text format, so `+91…` stays readable with no apostrophe or formula. Every other value starting with `= + - @` gets an apostrophe. | `safe_()` |
| 29 | The welcome email uses `og-image.jpg` from your live site as its header image, so it only shows once `SITE_URL` is set. It ends with "reply to this email to have your details removed". | `welcomeHtml_()` |
| 30 | The live counter counts **rows** (unique emails), so updates don't inflate it, and stays hidden below 10. | `COUNTER_MIN` in `app.js` |
| 31 | I added a `setup()` function to run once, which authorises the script and creates the Responses tab. | — |

## Content

- All copy from the brief is used exactly as written. No quotes are attributed to Gurudev Sri Sri Ravi Shankar or anyone else, and I've made no claims about SSU beyond the brief.
- The footer privacy note is my wording, based on the brief's instructions: what is collected, why, and how to have it removed.
- The contact address `setu@srisriuniversity.edu.in` is a **placeholder — TODO(user)**. Confirm the address exists before launch; change it in `CONFIG.CONTACT_EMAIL` in `app.js`. The footer updates automatically.

## Things you must supply (TODO(user))

1. `SCRIPT_URL` and `PAGE_URL` in `app.js` (SETUP.md, parts 2–3)
2. `ADMIN_EMAIL` and `SITE_URL` in `Code.gs`
3. ~~Your live address in `index.html` (link previews)~~ — done: https://setu-omega-nine.vercel.app/
4. Confirm `setu@srisriuniversity.edu.in` exists, or change it
5. Optional: a higher-resolution building photo

## Not done / limitations

- I checked page layout and behaviour in headless Chrome at 360, 390, 414, 768 and 1440 px. I haven't run a full Lighthouse audit or tested on a real iPhone or Android phone, so please use `TEST-CHECKLIST.md`.
- The Google Fonts stylesheet loads from Google's servers. On very slow networks, text first shows in a system font, then swaps (`display=swap`).
- The original `ssu-building.jfif` and `ssu_logo.png` are still in `assets/` but aren't used by the page. You can delete them.

---

# Mentor & admin portal — assumptions (added with the portal)

| # | Decision | Why | How to change |
|---|---|---|---|
| P1 | **Same stack: Vercel + Google Apps Script + the same Google Sheet.** New tabs: Students, Meetings, Feedback, Remarks, Projects, ProjectUpdates. | No new accounts, costs or servers. Everything stays visible and exportable in a Sheet you own. Comfortable up to a few thousand rows; beyond that, a real database (e.g. Supabase/Firebase) would be faster. | — |
| P2 | **Login = one-time 6-digit code by email**, no passwords. Sessions last 14 days per device. | Mentors are busy professionals on phones. Codes are hashed, expire in 10 minutes, allow 5 tries, and max 5 codes per 15 min per email. | `SESSION_DAYS` in `Code.gs` |
| P3 | **Admins = emails listed in `ADMIN_EMAILS`** (Code.gs). Set to `akshat.s@srisriuniversity.edu.in` (your contact address). | Simplest secure option; no admin table to manage. | Edit the list and redeploy (New version). |
| P4 | **Mentors need approval.** All existing and new sign-ups start as **Pending**; only **Approved** mentors can sign in. Approving sends them a welcome email with the portal link. | You asked for "mentors who are approved". | Admin → Mentors, or edit the **Status** column in Responses. |
| P5 | **Students don't sign in** (yet). Admin adds them (one by one or bulk paste/CSV); a student with an existing email is updated, not duplicated. Department is free text with suggestions. | The brief described mentor and admin dashboards only; I didn't invent SSU's department list. | — |
| P6 | **One mentor per student.** | Standard mentoring model; keeps "my mentees" unambiguous. | — |
| P7 | **Google Meet links via Google Calendar** (Calendar API service). Events are created on the **script owner's calendar**, with the mentor and invited students as guests; guests can't see each other's emails. | That is the only free, supported way for a script to create Meet links. | `CREATE_MEET_LINKS`, `SEND_CALENDAR_INVITES` in `Code.gs` |
| P8 | Students get **both** our branded email (with the Meet link, agenda and mentor details) **and** Google's calendar invite. | You asked for an email with the Meet link; the calendar invite puts it in their calendar with reminders. | Set `SEND_CALENDAR_INVITES = false` or `SEND_MEETING_EMAILS = false` in `Code.gs`. |
| P9 | Mentors may paste **their own meeting link** (Zoom/Teams/own Meet) instead. | Fallback if the Calendar service is off, or for mentors who prefer their own tools. | — |
| P10 | **Reschedule & cancel** email all invited students; cancelling also removes the calendar event. Only upcoming meetings can be changed. | Keeps students informed. | — |
| P11 | **Meeting report** = notes + next steps + per-mentee attendance, 1–5 "engagement" rating and individual feedback. It can be written once the meeting starts and edited later; saving marks the meeting **Completed**. Absent students get no rating. | Matches "per meeting some report and individual feedback for each mentee". | — |
| P12 | Feedback and remarks are **private to the mentor and admins**, not emailed to students. | Remarks are candid notes. Sharing feedback with students can be added later. | — |
| P13 | **Projects**: title, description, students, start/due dates, status (Not started / In progress / On hold / Completed) and dated **progress reports** with a % slider. A report at 100% marks the project Completed. | "Add projects and their progress report." | — |
| P14 | **Admin can act as any mentor** (Open dashboard) — schedule, report, edit projects on their behalf — with a gold banner showing whose dashboard it is. | "Admin can schedule the meeting, however mainly the mentor schedules." | — |
| P15 | Admin overview charts: **students by department** and **meetings held per month** (last 6). One colour each, values labelled on the bars. | Clear at a glance on a phone. | `adminOverview()` in `portal.js` |
| P16 | **Export CSV** = one row per meeting × student (with that student's attendance, rating and feedback), for the meetings currently filtered. | Easiest to pivot in Excel/Sheets. | `exportMeetingsCsv()` in `portal.js` |
| P17 | All times are **India time (IST)** and stored as text like `2026-10-12T15:30` so the Sheet never reformats them. | Everyone involved is in India. | `TIMEZONE` in `Code.gs` |
| P18 | `portal.html` is marked `noindex` so search engines don't list the login page. | — | — |
| P19 | **The Apps Script is a single file (`Code.gs`)** instead of Code.gs + Portal.gs. | Pasting only one of two files broke the live site ("Script function not found: doGet"); one file can't be half-installed. | — |
| P20 | **Sample data** (`seedDemoData`) uses Gmail plus-addresses of `DEMO_INBOX` (`shubham.akshat4@gmail.com`) so every sample person's login codes and meeting emails reach an inbox you can read. Rows are tagged (`DEMO-…` IDs / `demo-seed`) and removed by `removeDemoData`. | Realistic testing of login and email without creating real accounts. | `DEMO_INBOX` in `Code.gs` |

## Logo
- Your `ssu_logo.png` is **pixel-identical** to the logo on srisriuniversity.edu.in. I've switched to the site's **high-resolution original** (sharper on phones), trimmed and compressed to 27 KB as `assets/ssu-logo.png`. It's shown in its official colours on a white card (not recoloured), on the landing page, portal top bar and sign-in screen.
