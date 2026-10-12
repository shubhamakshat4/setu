# Setu — manual test cases

Work through these on a **phone** (opened from WhatsApp where noted) and on a **laptop**.
Mark each row ✅ / ❌ and note anything odd in the last column.

---

## 0. Before you start (one time)

1. In your Google Sheet → **Extensions → Apps Script**: the project must have **one file, `Code.gs`**, containing the whole new `apps-script/Code.gs`. Delete any `Portal.gs`.
2. **Services → + → Google Calendar API → Add.**
3. Function dropdown → **`setup`** → ▶ Run → allow permissions.
4. Function dropdown → **`seedDemoData`** → ▶ Run. The log ends with the list of test accounts.
5. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.**
6. Open https://script.google.com/macros/s/AKfycby_QOdKOadC5VlmD67rb_IGkLhIy1cwjR5s1_zMfMFz2ieidJgm2Dyh8jAElYLYgh-3TA/exec → you should see `{"count":5}` (or more if real people have signed up).

## Test accounts

There are **no passwords**. Enter the email at **https://setu-omega-nine.vercel.app/portal.html** and type the 6-digit code that arrives by email.
All sample addresses are Gmail "plus addresses", so **every code and every sample email lands in `shubham.akshat4@gmail.com`**. Check the **To:** line to see who it was for.

| Role | Email to sign in with | Can sign in? | What you'll see |
|---|---|---|---|
| **Admin** | `akshat.s@srisriuniversity.edu.in` | ✅ | Admin dashboard (it's in `ADMIN_EMAILS`) |
| **Mentor** — Priya Sharma (Infosys) | `shubham.akshat4+setu-priya@gmail.com` | ✅ | 4 mentees, 2 completed meetings, 1 report pending, 1 upcoming, 1 project at 45% |
| **Mentor** — Rahul Mehta (HDFC Bank) | `shubham.akshat4+setu-rahul@gmail.com` | ✅ | 3 mentees, 1 completed, 1 upcoming, 1 cancelled, 1 project not started |
| Pending mentor — Ananya Iyer | `shubham.akshat4+setu-ananya@gmail.com` | ❌ until approved | — |
| Pending mentor — Karthik Nair | `shubham.akshat4+setu-karthik@gmail.com` | ❌ until approved | — |
| Rejected mentor — Sneha Patil | `shubham.akshat4+setu-sneha@gmail.com` | ❌ | — |

> To use your Gmail as an admin too, add `'shubham.akshat4@gmail.com'` to `ADMIN_EMAILS` at the top of Code.gs and redeploy (New version).

**Sample students.** Their emails look like `shubham.akshat4+setu-s-asha@gmail.com`, so meeting emails to them also reach your Gmail.

| Student | Department | Programme · Year | Mentor |
|---|---|---|---|
| Asha Patel | Faculty of Management | MBA · 1 | Priya |
| Rohit Das | Faculty of Management | BBA · 3 | Priya |
| Meera Iyer | Faculty of Engineering | B.Tech CSE · 2 | Priya |
| Kiran Rao | Faculty of Engineering | B.Tech CSE · 3 | Priya |
| Sana Khan | Faculty of Management | B.Com · 2 | Rahul |
| Arjun Mishra | Faculty of Agriculture | B.Sc Agriculture · 3 | Rahul |
| Pooja Sahu | Faculty of Humanities | BA Economics · 1 | Rahul |
| Vikram Jena | Faculty of Engineering | B.Tech ECE · 1 | — (unassigned) |
| Nisha Behera | Faculty of Humanities | BA Psychology · 2 | — (unassigned) |
| Dev Kumar | Faculty of Management | MBA · 1 | — (unassigned) |

**Sample meetings.** Dates are relative to the day you ran `seedDemoData`.

| ID | Mentor | Title | When | State |
|---|---|---|---|---|
| DEMO-M1 | Priya | Getting started: goals for the semester | 21 days ago | Completed + report |
| DEMO-M2 | Priya | Resume clinic | 7 days ago | Completed + report |
| DEMO-M3 | Priya | Mock interviews — round 1 | yesterday 7 pm | **Report pending** |
| DEMO-M4 | Priya | Careers in product management | in 5 days, 6 pm | Upcoming |
| DEMO-M5 | Rahul | Banking careers 101 | 10 days ago | Completed + report |
| DEMO-M6 | Rahul | Project kick-off: credit-risk mini study | in 3 days, 5 pm | Upcoming |
| DEMO-M7 | Rahul | Guest session (cancelled) | 3 days ago | Cancelled |

> Sample meetings use the placeholder link `https://meet.google.com/new`. Meetings **you** schedule during testing get a real Meet link.

---

## A. Public sign-up page — https://setu-omega-nine.vercel.app

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| A1 | Send the link to yourself on WhatsApp | Preview shows the building photo and "Setu — Be the bridge between classroom and career" | | |
| A2 | Open it on your phone | Building at dusk fills the screen; official SSU logo (on a white card) top-left; **Mentor login** top-right; "Setu" rises in word by word | | |
| A3 | Scroll the whole page | Sections fade in; the gold bridge draws itself; no sideways scrolling | | |
| A4 | Tap **Mentor login** | Opens `/portal.html` sign-in | | |
| A5 | Tap **I'd love to be a mentor 🙏** → tap Next on an empty name | Friendly error; you can't move on | | |
| A6 | Phone `98765 4321` | "Hmm, that number looks a digit short 🤔" | | |
| A7 | Fill in all questions with a **new** email; submit | "Building your bridge… 🌉", then confetti, a welcome message with your first name, and your badge | | |
| A8 | Check the Sheet → **Responses** | New row; Phone shows `+91…`; **Status = Pending** | | |
| A9 | Check the inboxes | Welcome email to the new mentor; notification to `ADMIN_EMAIL` with an "Approve in the admin dashboard" link | | |
| A10 | Submit again with the same email but a different city | Same row updated; **Last Updated** filled; Status unchanged | | |
| A11 | Open the link with `?ref=test-group` | "How did you hear about Setu?" is pre-filled `test-group`; Source Ref saved | | |
| A12 | Half-fill the form, close the tab, reopen the link | Answers are still there | | |

## B. Sign-in

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| B1 | Portal → enter `akshat.s@srisriuniversity.edu.in` → **Send me a code** | Code screen appears; the email "Your Setu login code: 123456" arrives within a minute | | |
| B2 | Enter the code | You land on **Setu at a glance** (admin) | | |
| B3 | Sign out (avatar → Sign out) → sign in with the Priya email | Code arrives in your Gmail (To: …+setu-priya); you land on "Namaste, Priya 🙏" | | |
| B4 | Sign in with the **Ananya** (pending) email | Same neutral message, but **no code** arrives | | |
| B5 | Sign in with an unknown email, e.g. `nobody@example.com` | Same neutral message, no code (we never reveal who is registered) | | |
| B6 | Request a code, then type a wrong code | "That code doesn't match…" | | |
| B7 | Type a wrong code 5 times | "Too many attempts. Please ask for a new code." The real code no longer works | | |
| B8 | Request a code, wait 11 minutes, enter it | "That code has expired…" | | |
| B9 | Tap **Send me a code** 6 times quickly for one email | 6th try: "Too many codes requested. Please wait 15 minutes…" | | |
| B10 | Sign in, close the browser, reopen `/portal.html` | Still signed in (sessions last 14 days) | | |
| B11 | **Resend code** within 30 seconds | Asks you to wait; after 30 s a new code is sent | | |
| B12 | Open `/portal.html#/admin` while signed in as **Priya** | Redirected to her own Home (mentors can't see admin pages) | | |

## C. Admin — overview (sign in as admin)

| # | Steps | Expected (with only sample data) | ✅/❌ | Notes |
|---|---|---|---|---|
| C1 | Overview tiles | **2** active mentors (2 awaiting approval) · **10** students (3 not yet assigned) · **3** meetings held · **2** upcoming | | |
| C2 | "Students by department" chart | Management 4 · Engineering 3 · Humanities 2 · Agriculture 1 | | |
| C3 | "Meetings held per month" | Bars for this month (and last month if the seed dates cross a month) | | |
| C4 | Mentor activity table | Priya: 4 mentees, 2 held, 1 upcoming, **1 report due**, 1 project · Rahul: 3, 1, 1, 0, 1 | | |
| C5 | "Awaiting approval" list | Ananya and Karthik with **Approve** buttons | | |

## D. Admin — mentors

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| D1 | Open **Mentors** | Opens on the **Pending** tab (2); tabs show counts for All / Pending / Approved / Rejected / Inactive | | |
| D2 | Expand **Profile details** on Ananya | Email, phone, domains, ways to help, time, Art of Living connection, LinkedIn, message | | |
| D3 | **Approve** Ananya | Toast "Approved — they've been emailed a dashboard link"; "You're approved as a Setu mentor 🌉" arrives (To: …+setu-ananya) with an **Open my dashboard** button | | |
| D4 | Sign in as Ananya | Works now; her dashboard says mentees will appear soon | | |
| D5 | **Decline** Karthik | Moves to Rejected; he still can't sign in | | |
| D6 | Approved tab → **Mark inactive** on Ananya | If she is signed in, her next action says her account no longer has access | | |
| D7 | Approved tab → **Open dashboard** on Priya | Gold banner "Admin view of Priya Sharma's dashboard"; you see her Home | | |
| D8 | Press **Back to admin** | Returns to Mentors | | |

## E. Admin — students

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| E1 | Open **Students** | 10 students; mentor column shows Priya / Rahul / "Unassigned" | | |
| E2 | Search "meera" | Only Meera Iyer | | |
| E3 | Department filter → Faculty of Engineering | Meera, Kiran, Vikram | | |
| E4 | Mentor filter → Unassigned | Vikram, Nisha, Dev | | |
| E5 | **+ Add student** with name + your own `+test1` Gmail address, department "Faculty of Sciences", mentor Priya | Appears in list; Priya gets "1 new mentee assigned" email | | |
| E6 | **+ Add student** with an invalid email | Error shown; nothing saved | | |
| E7 | **Bulk import**: paste 3 rows from a Google Sheet (Name, Email, Roll No, Department, Programme, Year, Phone) | Preview says "3 students found"; after import, toast "3 added, 0 updated" | | |
| E8 | Bulk import the **same** 3 rows again | "0 added, 3 updated" (no duplicates) | | |
| E9 | Bulk import a row with no email | That row is reported as skipped; others import | | |
| E10 | Bulk import via **Choose file** (.csv) | Same as E7 | | |
| E11 | Tick Vikram + Nisha → choose Rahul → **Assign** | Toast "2 students assigned — mentor notified"; Rahul gets an email | | |
| E12 | Tick a student → "— Remove mentor —" → Assign | Student becomes Unassigned | | |
| E13 | **Edit** Meera → change Year to 3 → Save | Saved; shows "B.Tech CSE · 3" | | |
| E14 | Edit a student → Status **Inactive** | Disappears from the mentor's mentee list; still visible to admin with an "Inactive" pill | | |
| E15 | New department typed in E5 | Now appears in the department filter and the overview chart | | |

## F. Admin — meetings report & scheduling

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| F1 | Open **Meetings** | 7 meetings, newest first; tiles: Meetings / Completed / Attendance % / Avg. engagement | | |
| F2 | Status filter → Report pending | Only "Mock interviews — round 1" | | |
| F3 | Mentor filter → Rahul; date range | List and tiles update | | |
| F4 | Expand **Report & individual feedback** on "Resume clinic" | Notes, next steps, and 4 students with Attended/Absent, stars and feedback | | |
| F5 | **Export CSV** → open in Excel/Sheets | One row per meeting × student; columns include notes and each student's feedback; Indian names/₹/emoji display correctly | | |
| F6 | **+ Schedule meeting** → Mentor: Rahul → tomorrow 5 pm, 30 min → Schedule | Toast "Meeting scheduled — 3 students emailed"; real `meet.google.com/xxx-xxxx-xxx` link | | |
| F7 | Check Gmail | 3 branded emails (To: …+setu-s-sana / arjun / pooja) **and** Google Calendar invites; the **Join the meeting** button opens Google Meet | | |
| F8 | Check the script owner's Google Calendar | Event "Setu: … — Rahul Mehta" with Meet link; guests = Rahul + 3 students | | |
| F9 | Schedule for a mentor and untick all students | "Please invite at least one student." | | |

## G. Mentor — home & mentees (sign in as Priya)

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| G1 | Home | "Namaste, Priya 🙏"; next meeting "Careers in product management" with "in 5 days" and **Join meeting**; tiles 4 / 2 / 1 / 1 | | |
| G2 | "Reports waiting for you" | Shows "Mock interviews — round 1" → **Write report** | | |
| G3 | **Mentees** | 4 cards with department, attendance ("Attended 2/2 meetings") and stars | | |
| G4 | Open Kiran | Attendance "1 of 2 meetings (50%)" (absent in the first meeting) | | |
| G5 | Add a remark on Asha → **Save remark** | Appears at the top of the timeline with date/time; Remarks tab in the Sheet has the row | | |
| G6 | Delete that remark (confirm) | Removed from page and Sheet | | |
| G7 | Meeting feedback section on Asha | Lists both completed meetings with stars and feedback | | |
| G8 | Projects section on Asha | "Campus feedback app" at 45% | | |
| G9 | Tap email / phone on a mentee | Opens mail app / dialer | | |

## H. Mentor — meetings

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| H1 | **+ Schedule meeting** → topic, date in 2 days, 45 min, agenda, keep all 4 ticked → Schedule | Toast; opens the meeting page with **Join meeting**; each of the 4 students gets an email + calendar invite | | |
| H2 | Try a time in the past | "Please choose a time in the future." | | |
| H3 | Untick 2 students and schedule | Only 2 emails sent; meeting shows "2 students" | | |
| H4 | Open "Use my own meeting link" → paste `https://zoom.us/j/123` | Meeting saved with that link; emails contain it; no Calendar event created | | |
| H5 | Own link `zoom.us/j/123` (no https) | "The meeting link must start with https://" | | |
| H6 | Upcoming meeting → **Copy link** | "Link copied ✓" | | |
| H7 | **Reschedule** "Careers in product management" to another day | Students get "Rescheduled: …"; calendar event moves; page shows the new time | | |
| H8 | **Cancel meeting** on one you created (confirm) | Students get "Cancelled: …"; calendar event removed; card shows Cancelled; no Join button | | |
| H9 | Open "Mock interviews — round 1" (report pending) | Report form: notes, next steps, and a card per mentee with an Attended switch, ★ rating and feedback box | | |
| H10 | Switch **Attended** off for Rohit | His stars fade (no rating for absent students) | | |
| H11 | Fill notes, rate others, write feedback → **Save report** | "Report saved ✓"; status → Completed; Feedback tab has 4 rows; Rohit's rating is empty | | |
| H12 | Reopen the same meeting → change a rating → **Update report** | Feedback rows updated (not duplicated) | | |
| H13 | Open an upcoming meeting | No report form yet; message says you can write it once the meeting starts | | |
| H14 | Past meetings list | Completed meetings show a snippet of notes; Rahul's cancelled meeting is not in Priya's list | | |

## I. Mentor — projects

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| I1 | **Projects** | "Campus feedback app" 45% In progress; due date shown | | |
| I2 | Open it | Description, students (Asha, Meera), 2 progress reports newest first | | |
| I3 | **+ Progress report** → slider to 70% → note → Save | Bar shows 70%; new report on top; ProjectUpdates row added | | |
| I4 | **Edit project** → add Kiran, set due date in the past | Kiran listed; card shows **Overdue** | | |
| I5 | **+ New project** with no title | "Please give the project a title." | | |
| I6 | New project → status Completed | Progress jumps to 100% | | |
| I7 | Progress report at 100% | Status becomes Completed | | |

## J. Admin acting for a mentor

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| J1 | Admin → Mentors → Open dashboard (Rahul) → schedule a meeting | Works; meeting appears on Rahul's own dashboard; Created By = admin email in the Meetings tab | | |
| J2 | In admin view, write a report on a past Rahul meeting | Saved under Rahul | | |
| J3 | In admin view, go to `#/admin` | Banner disappears; back to admin | | |

## K. Security & permissions

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| K1 | Sign in as Priya; try to open `#/meeting/DEMO-M6` (Rahul's) | "Meeting not found." | | |
| K2 | Sign in as Priya; open `#/mentee/DEMO-S5` (Sana, Rahul's) | "This student isn't in your list." | | |
| K3 | Admin marks Priya **Inactive** while Priya is signed in on another device | Priya's next click shows "no longer has access" and returns to sign-in | | |
| K4 | Open the script URL in a browser | Only `{"count":N}` — no names or emails | | |
| K5 | Sign-up with City `=HYPERLINK("x")` | Sheet shows it as plain text, not a formula | | |
| K6 | Sign out | Returns to sign-in; Back button doesn't reveal data | | |

## L. Phone, layout & accessibility

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| L1 | Portal on a phone | Bottom menu with icons; tap targets comfortable; no sideways scroll | | |
| L2 | Pop-up forms on a phone | Slide up from the bottom; keyboard doesn't hide the Save button | | |
| L3 | Tables (students, mentor activity) on a phone | Become stacked cards with labels | | |
| L4 | Laptop ≥ 900 px | Left sidebar; tables as tables | | |
| L5 | Keyboard only (Tab / Enter / Esc) | Every button reachable; Esc closes pop-ups; gold focus ring visible | | |
| L6 | Phone "Reduce motion" on | No zooming/confetti; content simply appears | | |
| L7 | Slow network (Chrome DevTools → Slow 4G) | Shimmering placeholders while loading; no errors | | |
| L8 | Turn off Wi-Fi and press Save on a form | "Couldn't reach the server…" — your typing is kept | | |

## M. Emails (check look & links on a phone)

| # | Email | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| M1 | Login code | Big 6-digit code; expires in 10 min | | |
| M2 | Mentor approved | Name, **Open my dashboard** button works | | |
| M3 | Mentees assigned | Count of students; **See my mentees** opens the Mentees page after sign-in | | |
| M4 | Meeting scheduled (student) | Mentor name + role + company, topic, date/time in IST, agenda, **Join the meeting**; replying goes to the mentor | | |
| M5 | Rescheduled / Cancelled | Correct new time / cancellation text | | |
| M6 | Welcome email (public sign-up) | Building image header, warm text, mentions the dashboard after approval | | |

## N. Clean-up before launch

| # | Steps | Expected | ✅/❌ | Notes |
|---|---|---|---|---|
| N1 | Apps Script → **`removeDemoData`** → ▶ Run | Log "Sample data removed." | | |
| N2 | Check every tab | No `DEMO-…` rows, no `+setu-` emails; your real sign-ups untouched | | |
| N3 | Delete your own test sign-ups/students by hand | Header rows kept | | |
| N4 | Delete test events from the script owner's Google Calendar | — | | |
| N5 | Script URL shows the real count | `{"count":N}` | | |
