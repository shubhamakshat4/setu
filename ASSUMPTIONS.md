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
