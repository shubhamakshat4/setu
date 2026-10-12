# Setting up Setu — step by step

This guide assumes no coding experience. It takes about 30 minutes, start to finish.
You will: **(1)** make a Google Sheet that collects answers, **(2)** connect the page to it, **(3)** put the page online, **(4)** test it.

What's in this folder:

| File | What it is |
|---|---|
| `config.js` | **The 3 main settings** — script URL, site address, contact email |
| `index.html`, `style.css`, `app.js` | The public sign-up page |
| `portal.html`, `portal.css`, `portal.js` | The mentor & admin dashboards (`/portal.html`) |
| `assets/` | Photos, official SSU logo, preview image, icon |
| `apps-script/Code.gs` | Google Sheet program, part 1: sign-up form + settings |
| `apps-script/Portal.gs` | Google Sheet program, part 2: dashboards, meetings, Meet links, emails |

---

## ⭐ Upgrading to the mentor & admin portal (Setu is already live)

Do this once. About 15 minutes.

**A. Update the Apps Script (in your Google Sheet → Extensions → Apps Script)**
1. Click **Code.gs** on the left. Select all, delete, and paste the new `apps-script/Code.gs`.
   At the top, check `ADMIN_EMAIL`, `ADMIN_EMAILS` (everyone who may open the admin dashboard) and `SITE_URL`.
2. Click the **+** next to **Files** → **Script** → name it `Portal` (it becomes `Portal.gs`). Paste in `apps-script/Portal.gs`.
3. **Switch on Google Meet links:** on the left, click the **+** next to **Services** → choose **Google Calendar API** → **Add**.
   (It must appear as `Calendar` under Services.)
4. Save (💾). Choose **`setup`** in the function dropdown → **▶ Run** → accept the new permissions (Calendar + email).
   Your Sheet now has new tabs: **Students, Meetings, Feedback, Remarks, Projects, ProjectUpdates**, and a **Status** column in Responses.
5. **Deploy → Manage deployments → ✏️ → Version: New version → Deploy.** (Same URL — nothing to change on the site.)

**B. Update the website**
6. Upload/push all the new files (including `config.js`, `portal.html`, `portal.css`, `portal.js`, and the new `assets/ssu-logo.png`). Vercel redeploys automatically after a GitHub push.

**C. First use**
7. Open **https://setu-omega-nine.vercel.app/portal.html** → enter an email from `ADMIN_EMAILS` → type the 6-digit code you receive.
8. **Mentors** tab → approve mentors (each gets an email with a dashboard link).
   Existing sign-ups start as **Pending** — nobody gets access until you approve them.
9. **Students** tab → **Bulk import** (paste from Excel/Sheets: `Name, Email, Roll No, Department, Programme, Year, Phone`) → tick students → choose a mentor → **Assign**. The mentor is emailed.
10. Mentors sign in at the same address with their own email and can now schedule meetings — every assigned student gets an email (and a Google Calendar invite) with the Meet link.

### How the portal works — at a glance
| Who | Can do |
|---|---|
| **Mentor** (approved) | See their mentees · schedule / reschedule / cancel meetings (Meet link auto-created, students emailed) · after each meeting write notes + next steps and give each mentee attendance, a 1–5 engagement rating and individual feedback · keep dated remarks on each mentee · create projects and post progress reports |
| **Admin** (in `ADMIN_EMAILS`) | Totals and students-by-department · approve / decline / deactivate mentors · add, import, edit and assign students · consolidated meetings report with filters and **Export CSV** · schedule a meeting for any mentor · open any mentor's dashboard and act on their behalf |

Sign-in is by a one-time code sent to the person's email — no passwords. A login lasts 14 days on a device.

---

## Part 1 — Create the Google Sheet and its script

1. Go to **https://sheets.google.com** (signed in with the Google account that should own the data — ideally an SSU account).
2. Click **Blank spreadsheet** (the big "+").
3. Click the title **"Untitled spreadsheet"** (top-left) and rename it, e.g. `Setu Mentors`.
4. In the menu, click **Extensions → Apps Script**. A new tab opens with a code editor showing a file called `Code.gs`.
   *(You'll also add a second file, `Portal.gs`, and the Google Calendar service — see "Upgrading to the portal" above, steps 2–3.)*
5. In that editor, **select everything** (Ctrl+A / Cmd+A) and **delete** it.
6. On your computer, open `apps-script/Code.gs` from this folder in Notepad (Windows) or TextEdit (Mac). Select all, copy, and **paste** it into the Apps Script editor.
7. Near the top, change the three settings:
   ```js
   const ADMIN_EMAIL = 'your.name@srisriuniversity.edu.in';   // you get a note for each new mentor
   const SEND_EMAILS = true;                                   // false = send no emails at all
   const SITE_URL    = 'https://your-site.netlify.app/';       // fill this in after Part 3; keep the ending "/"
   ```
8. Click the **💾 Save** icon (or Ctrl+S). Name the project `Setu` if asked.

### Authorise it (one time)
9. In the toolbar, find the dropdown next to **▶ Run** / **Debug**. Choose **`setup`**, then click **▶ Run**.
10. A box says **"Authorisation required"** → click **Review permissions** → choose your Google account.
11. You will likely see **"Google hasn't verified this app"**. This is normal for your own scripts. Click **Advanced** → **Go to Setu (unsafe)** → **Allow**.
12. The log at the bottom should say *"Setu is ready."* Go back to your Sheet — there is now a **Responses** tab with a dark header row.

## Part 2 — Publish the script as a web app

13. In the Apps Script tab, click the blue **Deploy** button (top-right) → **New deployment**.
14. Click the ⚙️ gear next to **"Select type"** → choose **Web app**.
15. Fill in:
    - **Description:** `Setu v1`
    - **Execute as:** **Me** (your email)
    - **Who has access:** **Anyone**  ← important; *not* "Anyone with Google account"
16. Click **Deploy**. (Authorise again if asked, same as step 11.)
17. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfy…long…/exec`.
18. Check it works: paste that URL into a new browser tab. You should see `{"count":0}`.

### Connect the page to it
19. Open `config.js` in Notepad/TextEdit:
    ```js
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfy…/exec',   // paste from step 17
    PAGE_URL: '',                                                   // fill in after Part 3
    CONTACT_EMAIL: 'setu@srisriuniversity.edu.in',                  // the address people can write to
    ```
    Keep the quote marks `' '` around each value. Save the file.

> Until `SCRIPT_URL` is filled in, the form works in **Demo mode**: everything looks normal, but nothing is saved, and the thank-you screen shows a yellow "Demo mode" note.

---

## Part 3 — Put the page online (free)

Choose **one** of these. Netlify is the fastest.

### Option A — Netlify (drag and drop, ~3 minutes)
1. Go to **https://app.netlify.com/drop** and sign up (free — "Sign up with email" is fine).
2. Drag the **whole project folder** (the one containing `index.html`) onto the page.
3. After a few seconds you get an address like `https://jolly-moon-123abc.netlify.app`.
4. To choose a nicer name: **Site configuration → Change site name** → e.g. `ssu-setu` → your address becomes `https://ssu-setu.netlify.app`.
5. **To update the site later:** open your site in Netlify → **Deploys** tab → drag the folder into the box that says *"Drag and drop your site output folder here"*.

### Option B — GitHub Pages
1. Create a free account at **https://github.com** and sign in.
2. Top-right **+** → **New repository**. Name: `setu`. Choose **Public**. Click **Create repository**.
3. On the next page click **uploading an existing file**. Drag in all the `.html`, `.css` and `.js` files (including `config.js`) and the `assets` folder (you can skip `apps-script` and the `.md` files). Click **Commit changes**.
4. Go to **Settings → Pages**. Under **Branch** choose **main** and **/ (root)** → **Save**.
5. Wait 1–2 minutes and refresh. Your address appears at the top: `https://YOUR-USERNAME.github.io/setu/`.
6. **To update later:** open the repository → **Add file → Upload files** → drag in the changed files → **Commit changes**.

### After you have your address — three small edits
1. `config.js` → `PAGE_URL: 'https://ssu-setu.netlify.app/'`
2. `index.html` → find `https://YOUR-SITE-URL/` (it appears **4 times**, near the top) and replace each with your address. This makes the WhatsApp preview show the building photo.
3. `apps-script/Code.gs` (in the Apps Script editor) → `SITE_URL` → your address, then **redeploy** (next section).

Re-upload the site after edits 1 and 2.

---

## Changing the script later — redeploy *without* changing the URL

Whenever you edit code in the Apps Script editor, the live web app **does not change** until you redeploy. Do it like this so the URL stays the same:

1. **Deploy → Manage deployments**.
2. Click the ✏️ **pencil** (Edit) on your existing deployment.
3. **Version:** choose **New version**. Click **Deploy**.

✅ Same URL, new code.
❌ Don't use **Deploy → New deployment** for updates — that creates a *different* URL and you'd have to change `SCRIPT_URL` in `config.js` again.

---

## `?ref=` links — see which group brought each mentor

Add `?ref=something` to the end of the link you share. Whatever you put there is saved in the **Source Ref** column, and pre-filled in "How did you hear about Setu?".

| Where you're sharing | Link to send |
|---|---|
| Bhubaneswar teachers group | `https://setu-omega-nine.vercel.app/?ref=bbsr-teachers` |
| Cuttack teachers group | `https://setu-omega-nine.vercel.app/?ref=cuttack-teachers` |
| Bengaluru volunteers group | `https://setu-omega-nine.vercel.app/?ref=blr-volunteers` |
| Delhi NCR teachers | `https://setu-omega-nine.vercel.app/?ref=ncr-teachers` |
| Mumbai / Pune teachers | `https://setu-omega-nine.vercel.app/?ref=mum-pune-teachers` |
| LinkedIn post | `https://setu-omega-nine.vercel.app/?ref=linkedin` |
| Email newsletter | `https://setu-omega-nine.vercel.app/?ref=newsletter` |
| Your personal WhatsApp | `https://setu-omega-nine.vercel.app/?ref=prof-yourname` |

Rules: use letters, numbers and dashes only; no spaces. Keep it short.
After someone signs up, the share buttons on their thank-you screen automatically use `?ref=<their first name>`, so you can also see who spread the word.

Tip: add `#join` to open the form straight away, e.g. `https://setu-omega-nine.vercel.app/?ref=bbsr-teachers#join`.

---

## End-to-end test before you share (10 minutes)

1. Open your live address **on your phone** (paste it into a WhatsApp chat with yourself and tap it — that's how everyone else will open it).
2. Tap **"I'd love to be a mentor 🙏"** and fill the form with your own details. Submit.
3. Within a few seconds:
   - a new row appears in the **Responses** tab of your Sheet;
   - the **Phone** column shows `+91…` (not a number in scientific notation);
   - you receive the **welcome email** (check Spam the first time) and the **admin notification**.
4. Submit again with the **same email** but a different city → the same row updates and **Last Updated** is filled (no duplicate row).
5. Open `YOUR-SCRIPT-URL` in a browser → `{"count":1}`. (The counter on the page stays hidden until there are 10 mentors.)
6. Delete your test rows from the Sheet before launch (select the rows → right-click → **Delete rows**).
7. Paste your link into a WhatsApp chat → the preview should show the building photo and "Setu — Be the bridge between classroom and career". If it doesn't, see Troubleshooting.

See `TEST-CHECKLIST.md` for the full phone checklist.

---

## Troubleshooting

**"Something went wrong, but your answers are saved" / CORS error in the browser console**
- `SCRIPT_URL` must end in `/exec` (not `/dev`), and be inside quotes.
- The deployment must be **Who has access: Anyone**. Deploy → Manage deployments → ✏️ → check it.
- Don't change `'Content-Type': 'text/plain;charset=utf-8'` in `app.js` — that's what avoids CORS problems with Apps Script.
- If you edited `Code.gs`, did you redeploy with **New version**? (See above.)

**"Script function not found" / "Authorisation is required" / "script not authorised"**
- In the Apps Script editor, choose `setup` → **▶ Run** again and accept the permissions.
- Then Deploy → Manage deployments → ✏️ → **New version** → Deploy.
- "Execute as" must be **Me**.

**The form says success but no rows appear**
- Is the thank-you screen showing a yellow **Demo mode** note? Then `SCRIPT_URL` isn't set (or is mistyped) in the `config.js` that's *on the live site* — re-upload it.
- Look at the right Google Sheet — the one you opened Apps Script from — and the **Responses** tab.
- Apps Script editor → **Executions** (clock icon on the left) shows each submission and any error.
- Submissions from the same email **update** the existing row instead of adding a new one.

**Counter stuck at 0 / not showing**
- It's deliberately **hidden until 10 mentors** have joined (change `COUNTER_MIN` in `app.js`).
- Open your `SCRIPT_URL` in a browser: it should show `{"count": N}`. If it shows an error page, re-authorise and redeploy.

**No emails arriving**
- Check Spam. Check `SEND_EMAILS = true` and `ADMIN_EMAIL` is a real address. Redeploy after changes.
- Free Gmail accounts can send ~100 emails/day from scripts; Google Workspace accounts ~1,500.

**WhatsApp preview shows no picture**
- Replace all 4 `https://YOUR-SITE-URL/` in `index.html` with your real address and re-upload.
- WhatsApp caches previews. Test with a fresh variation like `…/?ref=test2`.

**I want to change a colour / wording**
- Colours: top of `style.css`. Form questions: `QUESTIONS` in `app.js`. Page text: `index.html`. WhatsApp message: `SHARE_MESSAGE` in `app.js`.

**Portal: "Couldn't create a Google Meet link"**
- In Apps Script, **Services** must list **Calendar** (Google Calendar API). Add it, run `setup` once, then redeploy with **New version**.
- Meanwhile mentors can open "Use my own meeting link instead" in the scheduling form and paste any Meet/Zoom link.
- Meetings are created on the calendar of the Google account that owns the script; mentors and students are guests.

**Portal: "I didn't get a login code"**
- Only **approved** mentors and emails in `ADMIN_EMAILS` receive codes (others see the same message, for privacy). Approve the mentor in **Admin → Mentors**.
- Check spam. Codes expire after 10 minutes; at most 5 codes per 15 minutes per email.

**Portal: email limits**
- Every meeting sends one email per invited student (plus Google's calendar invite). Free Gmail accounts can send ~100 script emails a day; Google Workspace (SSU) accounts ~1,500. Run the script from an SSU Workspace account if you can.
