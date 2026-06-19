# VITALS — Project Handoff

## What This Is

VITALS is a personal PWA health tracker. It runs on GitHub Pages, uses Supabase for the database, and is built with React + Vite. Single user. No backend server — all queries go direct from the browser to Supabase via the JS client.

Live: deployed to GitHub Pages (repo: vitals under the user's GitHub account).
Local dev: `D:\Projects\vitals` — run with `npm run dev`.

---

## Tech Stack

- **Frontend:** React 19, Vite, Recharts (charts only)
- **Database:** Supabase (Postgres + auth + RLS)
- **Auth:** Supabase email/password — single user, sessions persisted in localStorage
- **Hosting:** GitHub Pages via GitHub Actions (`deploy.yml`) — auto-deploys on every push to `main`
- **Styling:** Plain inline styles + a small `index.css` with utility classes (`.card`, `.input`, `.btn-primary`, `.btn-ghost`, `.mono`, `.sheet`, `.sheet-backdrop`)

---

## Database Schema (Supabase)

### `meals`
| Column | Type | Nullable |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| date | date | NOT NULL |
| time | time | |
| name | text | — meal label the user types |
| description | text | YES — AI-generated plain-English label, e.g. "double espresso" |
| emoji | text | |
| source | text | `'manual'` or `'claude'` |
| calories | int | |
| protein_g | numeric | |
| fat_g | numeric | |
| fat_saturated_g | numeric | |
| carbs_g | numeric | |
| sugar_g | numeric | |
| sugar_added_g | numeric | |
| fiber_g | numeric | |
| sodium_mg | int | |
| calcium_mg | numeric | |
| iron_mg | numeric | |
| potassium_mg | numeric | |
| vitamin_c_mg | numeric | |
| vitamin_d_ug | numeric | |

RLS policy: `auth.role() = 'authenticated'` covers all columns — no changes needed when adding columns.

### `weight`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users (default auth.uid()) |
| date | date | NOT NULL |
| time | time | |
| weight_kg | numeric | |

### `blood_pressure`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users (default auth.uid()) |
| date | date | NOT NULL |
| time | time | NOT NULL |
| systolic | integer | NOT NULL |
| diastolic | integer | NOT NULL |
| pulse | integer | nullable |
| created_at | timestamptz | default now() |

RLS: enabled, policy `auth.uid() = user_id` for all operations on both tables.

### `activity`, `user_profile`
Standard single-user tables.

---

## Claude Paste Format

When asking Claude to analyse a meal, use this prompt:

```
Analyse the nutrition of: [describe your meal]

Reply in this exact format:
Description: [short plain-English label, e.g. "double espresso" or "beef burger with fries"]
Calories: [number] kcal
Protein: [number]g
Fat: [number]g
Saturated: [number]g
Carbs: [number]g
Sugar: [number]g
Added sugar: ~[number]g
Fibre: [number]g
Sodium: [number]mg
```

`Description:` goes first — the parser uses a multiline anchored regex and hits it before any nutrient lines.

---

## Key Files

```
src/
  components/
    LogMealSheet.jsx   — paste parser, manual form, Supabase insert
    Login.jsx          — auth screen
    OnboardingSheet.jsx — first-run profile setup
    CircularRing.jsx   — SVG ring chart component
    Layout.jsx         — tab bar + page wrapper
  hooks/
    useMeals.js        — fetch/add/delete meals; uses select('*') so new columns auto-appear
    useProfile.js      — user profile/targets
    useActivity.js     — step/activity data
    useWeight.js       — all-time weight data; computes delta7, delta30
    useBloodPressure.js — all-time BP data; latest reading
    useRecoveryTrends.js — last 30 days of HRV/SpO2/resting HR from activity table
  tabs/
    Overview.jsx       — rings + weekly bar chart + meal list + date nav + Log meal CTA
    Nutrition.jsx      — calorie hero, macro donut, full nutrient table, per-meal breakdown
    Activity.jsx       — step log + date nav
    Sleep.jsx          — sleep chart + RECOVERY 30D section (HRV, resting HR)
    Weight.jsx         — current weight card, 7/30-day deltas, chart with 1W/4W/All toggle, log form
    BloodPressure.jsx  — latest SYS/DIA card + classification, dual-line chart with 1W/4W/All toggle, log form, recent readings list
  lib/
    supabase.js        — Supabase client init
  main.jsx             — app entry
  App.jsx              — auth gate + tab routing + date state + sync buttons (syncSteps, syncExtras, syncSleep, syncHrIntraday)
```

---

## Google Health / Fitbit Sync

All sync runs as Supabase Edge Functions, triggered manually from the app (buttons in App.jsx). OAuth credentials stored as Supabase secrets.

### Edge functions (`supabase/functions/`)
| Function | What it does |
|---|---|
| `sync-steps` | Fetches daily step count from Google Health `steps` dailyRollUp → `activity` table |
| `sync-extras` | Fetches distance, active_minutes, resting_hr_bpm, hrv_rmssd, spo2_pct → `activity` table. Resting HR lags in Google Health by a few days, so the `nightly-sync-extras` pg_cron job (jobid 1) re-runs this nightly at 01:00 UTC to backfill — `select * from cron.job_run_details where jobid=1`. Can also be re-run manually anytime. ⚠️ Has a latent NULL-overwrite upsert bug. See README "Known latent bug". |
| `sync-sleep` | Fetches sleep sessions from Google Health → `sleep` table |
| `probe-health` | Debug/exploration function — currently probes HR data shape (see below) |

Deploy command: `npx supabase functions deploy <name> --project-ref rkxorbsusqfhlhrlajlj --no-verify-jwt`

### Confirmed Google Health HR data (probed 2026-06-07)

**Daily rollup (`heart-rate` dailyRollUp):**
- Returns `beatsPerMinuteAvg` (float), `beatsPerMinuteMax` (int), `beatsPerMinuteMin` (int) per day ✅
- Currently only `beatsPerMinuteAvg` is saved to `activity.resting_hr_bpm` — min/max not yet stored

**Intraday raw (`heart-rate` list endpoint):**
- ~1–2 second granularity from Inspire 3 (PASSIVELY_MEASURED via FITBIT platform)
- API returns newest-first, no server-side time filter — must paginate and stop at cursor
- 200 points = ~7 minutes of data → a full day is ~40,000+ points
- Field shape per point:
```json
{
  "heartRate": {
    "sampleTime": {
      "physicalTime": "2026-06-07T14:21:27Z",
      "utcOffset": "3600s",
      "civilTime": { "date": { "year": 2026, "month": 6, "day": 7 }, "time": { "hours": 15, "minutes": 21, "seconds": 27 } }
    },
    "beatsPerMinute": "108"
  },
  "dataSource": { "recordingMethod": "PASSIVELY_MEASURED", "device": { "displayName": "Inspire 3" }, "platform": "FITBIT" }
}
```

---

## HR Intraday Feature — FULLY WORKING (as of 2026-06-08)

The redesign described in earlier drafts is **done and shipped** — the section below reflects the live implementation.

**Infrastructure:**
- `heart_rate_intraday` table with RLS, unique constraint on `(user_id, timestamp)`, index on `(user_id, timestamp DESC)`
- `pgrst.db_max_rows = 50000` set on `authenticator` role
- Grants on table and sequence for `anon`, `authenticated`, `service_role`
- `get_hr_3min_chart(since_ts timestamptz)` RPC — 3-min buckets, returns `(h timestamptz, avg_bpm smallint, max_bpm smallint)`. **This is the one the UI uses.** `get_hr_hourly_chart` still exists but is no longer called.
- `sync-hr-intraday` edge function — cursor-based incremental sync, 5s bucket downsampling, 48h pruning, page_size=1000. Fixed a CPU-limit issue (status 546) by removing a second pass over rawPoints.

**UI (live):**
- `src/hooks/useHeartRateIntraday.js` — `useHeartRateIntraday()` calls `get_hr_3min_chart` + `fetchHrZoom(centerMs)` (raw 5s query for 3h window)
- `src/tabs/Activity.jsx` — one continuous AreaChart across 24h at 3-min resolution, with 24 alternating hour-wide background bands; click any point/band to zoom into that hour at 5s resolution; back button returns to overview
- `src/App.jsx` — `syncHrIntraday()` wired as `onSyncHr` prop to Activity

### Key facts to remember
- Data: 48h sliding window in `heart_rate_intraday` (~34,560 rows max at steady state); chart queries last 24h only
- Edge function timeout: 60s — first sync covers 24h only; subsequent syncs are incremental (fast)
- `fetchHrZoom(centerMs)` queries `heart_rate_intraday` directly, window = centerMs ±1h/+2h (3h total), returns `{ x: unixMs, bpm: number }[]`
- `useHeartRateIntraday()` calls `get_hr_3min_chart` RPC, returns `{ x: unixMs, avg: number, max: number }[]`

### Colour palette reminder
| Token | Value | Usage |
|---|---|---|
| HR / systolic | `#e87a8a` | heart rate line + area |
| Card bg | `#161819` | `.card` |
| Elevated bg | `#1e2022` | inputs, inner cards |
| Muted text | `#9ca0a4` | labels |
| Subtle text | `#6b6f73` | secondary info |

---

## LogMealSheet — How It Works

Two entry modes selectable from a card picker:

**Paste from Claude**
1. User pastes Claude's output into a textarea.
2. `parsePaste(text)` fires on every keystroke once text > 20 chars.
3. Regex extracts `description` plus all nutrient fields.
4. `setMode('form')` auto-triggers — user lands on the review form.
5. A `"…description…"` preview line shows in monospace if description was parsed.
6. User fills in the meal name + emoji, adjusts any numbers, saves.

**Manual entry**
Standard form with a DESCRIPTION field at the top (optional, maxLength 120), MEAL NAME (required), emoji picker, time, and a nutrient grid.

**Save**
`handleSave` builds a meal object and calls `onSave(meal)` → `useMeals.addMeal()` → Supabase insert. `description` is saved as `null` when empty.

### Parser regexes (in `parsePaste`)

```js
const description = text.match(/^description[:\s]+(.+)$/im)?.[1]?.trim() ?? ''
// all nutrients use case-insensitive float/int extraction
```

---

## Date Navigation (Overview + Activity)

`date` is state in `AppInner` (`useState(TODAY)`), defaulting to today's date. It's passed down to Overview and Activity as `date`, with `today` (the constant) and `onDateChange` (setter) alongside.

Both tabs have an identical date nav row at the top:
- Shows `TODAY` (accent colour) or `MMM D, YYYY` (muted) depending on selected date
- 📅 button triggers a hidden `<input type="date" max={today}>` via a ref — opens native OS date picker
- `Back to today` button appears when browsing a past day
- Section labels update dynamically — e.g. `MAY 30 — MEALS` / `MAY 30 — ACTIVITY`

`useMeals`, `useActivity`, and `useWeekMeals`/`useWeekActivity` are all already reactive to `date` — no changes needed in the hooks. Activity form resets via `useEffect` when `activity` changes (i.e. when date changes).

Nutrition tab always shows the currently selected date's meals since it shares the same `meals` prop from App.

---

## Overview Tab — Meal List

Each meal card shows:
- Emoji (left)
- **Name** (primary, required — user-entered)
- **Description** (secondary line, muted colour — AI-generated, only shown when present)
- Time + ✨ AI badge (if source === 'claude')
- Calories + sodium (right)

---

## Nutrition Tab — Per-Meal Table

The "PER MEAL" breakdown table shows `m.description || m.name` in the Meal column — AI-logged meals show the natural-language label; manual meals show the user's name.

---

## useMeals — No Changes Needed for New Columns

Uses `select('*')` — any new column added to the DB automatically comes back in the data.

---

## What You Don't Touch

- `Login.jsx`, `OnboardingSheet.jsx`
- `useProfile.js`
- `vite.config.js`
- RLS policies

---

## Blood Pressure Tab

### Classification logic (in `BloodPressure.jsx`)
| Label | Condition |
|---|---|
| Normal | sys < 120 and dia < 80 |
| Elevated | sys 120–129 and dia < 80 |
| High (Stage 1) | sys 130–139 or dia 80–89 |
| High (Stage 2) | sys ≥ 140 or dia ≥ 90 |
| Hypertensive Crisis | sys > 180 or dia > 120 |

### Chart
Dual-line recharts chart — systolic (`#e87a8a`) and diastolic (`#5ba4e6`). Reference lines at 120 (systolic normal ceiling) and 80 (diastolic normal ceiling). Range toggle: 1W / 4W / All.

### BP input auto-advance
- Systolic → Diastolic: auto-focuses after 3 digits
- Diastolic → Pulse: auto-focuses after 2 digits
- Implemented via `useRef` (`diaRef`, `pulseRef`) + `onChange` length check

### Known issue
Chart is hidden when `entries.length <= 1`. With only 1 data point you can't draw a line, so the chart card doesn't render. Fix: always show the chart card but with a placeholder message when there's only 1 point.

---

## Weight Tab

- Loads **all-time** data (no 30-day cap) — range toggle filters in the component.
- delta7 and delta30 are computed in `useWeight.js` by finding the earliest entry on or after the cutoff date.
- Chart also hidden when `entries.length <= 1` (same issue as BP above).

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Old meal rows (no description) | `meal.description` is `null` — Overview shows nothing; Nutrition falls back to `m.name` |
| Paste without a Description line | Regex returns `''`, saved as `null` |
| Very long description | `maxLength={120}` on the input; no DB constraint |
| Description contains quotes | Supabase client handles escaping |
