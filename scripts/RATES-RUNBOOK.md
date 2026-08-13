# Rates pipeline — runbook

**What the visitor sees:** the "Tonight's direct rate" strip on the homepage and
per-room prices on the room cards. Fed by `assets/rates.json`, which a GitHub
Action refreshes 4× a day from the hotel's own STAAH booking engine.

## The pipeline

1. `.github/workflows/refresh-rates.yml` runs at ~09:00 / 15:00 / 21:00 / 00:15 IST.
2. It runs `scripts/fetch-rates.mjs`, which asks STAAH (`csbe.staah.net`) for
   tonight's per-room rates. If tonight has no availability (same-night sales
   often close in the evening), it automatically quotes **tomorrow's** night
   instead — `rates.json` then has `"night": "tomorrow"` and the site labels it.
3. If a sellable rate was found, the workflow commits `assets/rates.json` and the
   site deploy picks it up.
4. The front end (`js/main.js`) hides the strip entirely if the file is older
   than 36 h or has no rate — it never shows an empty box.

## The alarms (who finds out, and how)

- **Refresh job health check** — after every run, the workflow fails if
  `rates.json` has no sellable rate or is stale. A failed scheduled workflow
  emails the repo owner.
- **`rates-watchdog.yml`** — every 6 h, independently fetches
  `https://chinmaye.in/assets/rates.json` (what production actually serves) and
  fails if it's stale (>26 h) or empty. This also catches broken deploys and
  GitHub auto-disabling schedules after 60 days without commits.
- Both alarms **open (or update) a GitHub issue titled "🚨 Rate feed alarm"** on
  this repo — so there is a visible, assignable record beyond email.

## Diagnosing a failure (in order)

1. **Open the failed run** (link is in the alarm issue). Read which step failed.
2. **`Network probe` step** shows whether `csbe.staah.net` / `watchmyrate.com`
   were reachable. Non-200s → STAAH-side outage; usually resolves itself. Re-run
   the workflow ("Re-run all jobs") after a few hours.
3. **`Fetch tonight's rates` failed with HTTP 4xx** → STAAH probably rotated the
   public identifiers. Open `https://booking.chinmaye.in` in a browser, view
   DevTools → Network → the `bedataguest` request, and copy the fresh
   `PropertyId`, `X-Api-Key` and RoomIDs into the constants at the top of
   `scripts/fetch-rates.mjs`.
4. **Health check failed with "no sellable rate"** → check the booking engine by
   hand (`https://booking.chinmaye.in`). If rooms ARE bookable for tonight or
   tomorrow but the script says otherwise, STAAH changed their response shape —
   run `node scripts/fetch-rates.mjs` locally and compare with the engine.
   If the hotel really is sold out two nights straight, close the issue; the
   site is correctly hiding the strip.
5. **Watchdog failed but refresh runs are green** → the deploy is stuck:
   the repo has fresh `rates.json` but production doesn't. Check GitHub Pages /
   hosting deploy status for this repo.
6. **No runs at all in the Actions tab for days** → GitHub disabled the schedule
   (happens after 60 days without repo activity). Press "Enable workflow".

## Manual refresh

Actions tab → "Refresh live rates" → Run workflow. Or locally:

```bash
node scripts/fetch-rates.mjs && git add assets/rates.json && git commit -m "rates: manual refresh" && git push
```
