# VITALS

Personal health tracker PWA. Tracks nutrition, activity, sleep, weight, and blood pressure. Mobile-first dark UI, lives at `/vitals/` on GitHub Pages.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | React 19 + Vite 8 |
| Database / Auth | Supabase (Postgres + Row Level Security) |
| Styling | CSS variables + inline styles (`src/index.css`), Tailwind v4 plugin active but no utility classes used |
| Charts | Recharts (ComposedChart for BP/Weight, BarChart for weekly bars, PieChart for macro donut) |
| Date handling | dayjs |
| PWA | vite-plugin-pwa (autoUpdate, standalone display, service worker) |
| Deploy | GitHub Pages at `/vitals/` |

---

## Project layout

```
src/
  App.jsx               — root, auth gate, ErrorBoundary, "today" state
  main.jsx              — React entry point
  index.css             — all design tokens (CSS vars), component classes, animations

  lib/
    supabase.js         — supabase client (reads VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)

  hooks/
    useProfile.js       — user_profile row (height, calorie/sodium/protein/steps targets)
    useMeals.js         — meals table for a given date; useWeekMeals for weekly bar chart
    useActivity.js      — activity table for a given date; useWeekActivity for weekly bar chart
    useSleep.js         — sleep table for a given date; useWeekSleep for weekly bar chart
    useWeight.js        — full weight history, 7-day and 30-day deltas
    useBloodPressure.js — full BP history

  tabs/
    Overview.jsx        — daily rings (cal/sodium/protein), steps, weekly calorie bar, meal list
    Nutrition.jsx       — macro donut, full nutrient table, per-meal breakdown
    Activity.jsx        — (tab label: "Move") steps ring, weekly steps bar, activity log form
    Sleep.jsx           — sleep duration + stage timeline chart, weekly sleep bars, Fitbit sync
    Weight.jsx          — current weight, BMI, 7/30-day delta cards, trend chart, log form
    BloodPressure.jsx   — latest reading, trend chart, log form, doctor view

  components/
    Layout.jsx          — sticky header, tab bar, safe-area insets
    Login.jsx           — email/password sign-in
    OnboardingSheet.jsx — first-run profile setup (height + targets)
    LogMealSheet.jsx    — paste-from-Claude or manual meal entry sheet
    CircularRing.jsx    — SVG progress ring (used for cal/sodium/protein on Overview)
    DoctorView.jsx      — full-screen BP log table with 30-day averages
```

---

## Database tables (Supabase)

All tables have Row Level Security — users can only see their own rows.

| Table | Key columns |
|---|---|
| `user_profile` | `height_cm`, `target_calories`, `target_sodium_mg`, `target_protein_g`, `target_steps` |
| `meals` | `date`, `time`, `name`, `description`, `emoji`, `source`, `calories`, `protein_g`, `fat_g`, `fat_saturated_g`, `carbs_g`, `sugar_g`, `sugar_added_g`, `fiber_g`, `sodium_mg` |
| `activity` | `date`, `steps`, `km`, `active_minutes`, `workout_type`, `workout_duration_min`, `resting_hr_bpm`, `hrv_rmssd`, `spo2_pct` |
| `sleep` | `date` (wake-up date), `sleep_start`, `sleep_end`, `duration_min`, `asleep_min`, `deep_min`, `rem_min`, `light_min`, `awake_min`, `stages` (JSONB) |
| `weight` | `date`, `time`, `weight_kg` |
| `blood_pressure` | `date`, `time`, `systolic`, `diastolic`, `pulse`, `notes` |

---

## Auth flow

`App` checks `supabase.auth.getSession()` on mount and subscribes to `onAuthStateChange`. Session state is tri-state: `undefined` (loading splash) → `null` (show Login) → session object (show AppInner). Subscription is cleaned up on unmount.

---

## How data flows

Each domain hook (`useMeals`, `useActivity`, etc.) owns its own Supabase fetches and local state. Hooks expose `addEntry`/`save`/`deleteMeal` mutators that do optimistic local updates and return `{ error }` for callers to handle. The weekly bar chart hooks (`useWeekMeals`, `useWeekActivity`) are separate and expose a `reload` function — tabs call this after mutations so the chart updates immediately.

---

## Key design decisions

**`today` state, not a constant** — `today` is a React state in `AppInner` that refreshes on `visibilitychange`. Prevents "Back to today" and date picker `max` from going stale if the PWA is open past midnight.

**Optimistic deletes with rollback** — `deleteMeal` immediately removes the row from local state and rolls back to a snapshot if the Supabase delete fails.

**One point per day on charts** — Weight chart shows the most recent reading per day; BP chart shows the first reading per day (with extra readings as faint scatter dots).

**Y axis auto-fits for weight** — Weight chart domain is computed from the actual data in the selected range, padded 30% and rounded to nearest 5 kg. BP chart uses fixed medical range (60–220 mmHg).

**Paste-to-log meals** — `parsePaste` in `LogMealSheet` regex-extracts nutrition fields from Claude's text output. Triggers automatically when paste exceeds 20 characters. No API call — purely client-side regex.

**BP input auto-advance** — In the BP log form (`BloodPressure.jsx`), the systolic field auto-focuses diastolic after 3 digits, and diastolic auto-focuses pulse after 2 digits. Implemented via `useRef` + `onChange` length check.

**ErrorBoundary** — wraps `AppInner` as a class component. Catches render errors and shows a retry screen instead of a blank app.

---

## Local dev

```bash
cd D:\Projects\vitals
npx vite --port 5173
# open http://localhost:5173/vitals/
```

Env file: `.env.local` (not committed)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## Deploy

```bash
npm run build
# push dist/ to gh-pages branch, or let CI handle it
```

Base path is `/vitals/` (set in `vite.config.js`). PWA manifest points `start_url` to `/vitals/`.

---

## Google Health API — gotchas summary

Two things that will waste hours if you don't know them upfront:

1. **Type names are kebab-case in the URL path.** `active-minutes`, `heart-rate`, `resting-heart-rate` — not underscores. `steps` and `distance` happen to have no separator so they look the same either way, which hides this rule until you try a multi-word type. Wrong format gives `INVALID_PARENT_DATA_TYPE_COLLECTION` with no hint about casing.

2. **`active-minutes` has a hard 14-day window limit.** The API returns `INVALID_ROLLUP_QUERY_DURATION` if `window_size_days × number_of_days > 14`. The default 30-day range trips this every time. Cap `active-minutes` requests to a 14-day window.

---

## Google Health API integration (Fitbit sync)

The "Sync Fitbit" button in the Activity tab pulls step data from Google Health Connect via a Supabase Edge Function. The user's Fitbit data flows into Google Health on the phone, and we read it server-side.

### How it works

```
Phone (Fitbit app) → Google Health Connect → Google Health API (v4)
                                                       ↓
                                          Supabase Edge Function (sync-steps)
                                                       ↓
                                          activity table (upsert by date)
```

### OAuth setup (server-side only, refresh token flow)

We use a **long-lived refresh token** — no user-facing OAuth popup. The edge function exchanges the refresh token for a short-lived access token on every invocation.

Three secrets stored in Supabase Edge Function env vars (Dashboard → Edge Functions → sync-steps → Secrets):

| Secret | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_REFRESH_TOKEN` | Long-lived refresh token obtained once via OAuth playground |

Token refresh call:
```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id=...&client_secret=...&refresh_token=...&grant_type=refresh_token
```
Returns `{ access_token, expires_in, token_type }`. The access token is valid for ~1 hour.

**To get the initial refresh token:** use [Google OAuth Playground](https://developers.google.com/oauthplayground) with scope `https://www.googleapis.com/auth/health.activity.read` and check "Use your own OAuth credentials".

### Google Health API v4 — steps daily rollup

Endpoint:
```
POST https://health.googleapis.com/v4/users/me/dataTypes/steps/dataPoints:dailyRollUp
Authorization: Bearer <access_token>
Content-Type: application/json
```

Request body uses **civil date-time objects** plus `window_size_days: 1` for daily bucketing (both are required — API updated June 2026):
```json
{
  "range": {
    "start": {
      "date": { "year": 2026, "month": 6, "day": 1 },
      "time": { "hours": 0, "minutes": 0, "seconds": 0 }
    },
    "end": {
      "date": { "year": 2026, "month": 6, "day": 3 },
      "time": { "hours": 23, "minutes": 59, "seconds": 59 }
    }
  },
  "window_size_days": 1
}
```

Response shape:
```json
{
  "rollupDataPoints": [
    {
      "civilStartTime": {
        "date": { "year": 2026, "month": 6, "day": 1 },
        "time": { "hours": 0, "minutes": 0, "seconds": 0 }
      },
      "steps": { "countSum": "8432" }
    }
  ]
}
```

Key gotchas:
- `steps.countSum` is a **string**, not a number — must `parseInt()`
- Date comes from `civilStartTime.date`, not an ISO string
- Days with zero steps are omitted from the response entirely
- The API is `health.googleapis.com` (Health Connect), not the older Fitness REST API (`www.googleapis.com/fitness`)
- **June 2026 breaking change:** `window_size_days: 1` is now required alongside `range`. Previously the request only needed `range`; after a Google Health Connect update the endpoint returns 400 `INVALID_ARGUMENT` without this field. Value `1` = daily buckets (matches the old per-day behaviour).

### Edge function: `sync-steps`

Located in Supabase (project `rkxorbsusqfhlhrlajlj`), deployed as `sync-steps` (verify_jwt: false so the frontend can call it directly).

Default behaviour: syncs last 30 days. Can be overridden:
```js
// App.jsx — syncSteps()
fetch(`${SUPABASE_URL}/functions/v1/sync-steps`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}' // or JSON.stringify({ startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' })
})
```

Returns:
```json
{ "synced": 14, "rows": [...], "upsertError": null }
```

### Supabase upsert pattern

The `activity` table has a **unique constraint on `date`**. The upsert uses `onConflict: 'date'` so re-syncing is safe — it updates steps without touching manually-entered fields (`km`, `active_minutes`, `workout_type`, etc.).

```js
await supabase
  .from('activity')
  .upsert(rows, { onConflict: 'date' })
```

Where `rows` is `[{ date: 'YYYY-MM-DD', steps: 8432 }, ...]`.

**Important:** the edge function uses `SUPABASE_SERVICE_ROLE_KEY` (not the anon key) because it writes to a table with RLS. Service role bypasses RLS — never expose it client-side.

### To redeploy the edge function

The source lives at `supabase/functions/sync-steps/index.ts` (deploy via Supabase CLI or paste into Dashboard editor):
```bash
supabase functions deploy sync-steps --project-ref rkxorbsusqfhlhrlajlj
```

---

## Google Health API integration — distance, active minutes, HRV, SpO2, resting HR (sync-extras)

`sync-extras` fetches all activity-derived metrics and upserts them into the `activity` table without touching `steps`.

### Data types — all verified working (Fitbit Inspire 3, as of 2026-06-04)

| Column | API data type | Endpoint | Response field | Notes |
|---|---|---|---|---|
| `km` | `distance` | `dailyRollUp` | `distance.millimetersSum` | Divide by 1,000,000 for km |
| `active_minutes` | `active-minutes` | `dailyRollUp` | `activeMinutes.activeMinutesRollupByActivityLevel[*].activeMinutesSum` | Sum across all levels; 14-day cap |
| `resting_hr_bpm` | `heart-rate` | `dailyRollUp` | `heartRate.beatsPerMinuteAvg` | Daily average HR |
| `hrv_rmssd` | `heart-rate-variability` | `list` (paginated) | `heartRateVariability.rootMeanSquareOfSuccessiveDifferencesMilliseconds` | Averaged per day; Google Health only retains ~1 night of raw points |
| `spo2_pct` | `oxygen-saturation` | `list` (paginated) | `oxygenSaturation.percentage` | Min per day (catches overnight dips); readings below 80% filtered as artifacts |

### Data type name gotcha — sampleTime path

HRV and SpO2 data points from the `list` endpoint nest the sample time under the type key, not at top level:
```
dp.heartRateVariability.sampleTime.civilTime.date   ✓
dp.sampleTime.civilTime.date                        ✗ (doesn't exist)
```
The code auto-detects the key by iterating `Object.keys(dp)` and skipping `dataSource`.

### active-minutes 14-day cap

The API rejects requests where `window_size_days × days_in_range > 14`. `sync-extras` automatically clamps `startDate` to 13 days before `endDate` for the `active-minutes` fetch. Distance has no such limit.

### What's NOT available from Fitbit Inspire 3

Probed 2026-06-04 — these either don't exist or return 0 data points:
- `vo2-max` — valid type, 0 data (Inspire 3 doesn't estimate VO2 max)
- `body-fat` — valid type, 0 data (no Aria scale)
- `respiratory-rate`, `breathing-rate`, `respiration-rate` — invalid type names (not in this API)

### SpO2 — synced but not displayed

Probed 2026-06-06. Full histogram of ~1,989 raw points revealed two completely separate populations:
- **50%** — 514 readings, pure sensor dropout artifacts
- **74–91%** — ~130 scattered readings, motion artifacts
- **92–99%** — 1,283 real readings, peaking at 93–94%

Cutoff is clearly at 92%. However, 93–94% overnight is slightly below clinical normal (95–100%), which could indicate mild sleep apnea or sensor error (±2–3%). Data quality not good enough to display meaningfully. **SpO2 removed from the recovery trends graph** (`Sleep.jsx`, `useRecoveryTrends.js`). Still stored in `activity.spo2_pct` for future reference.

### OAuth — full scope list (all 3 required)

```
https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly
https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly
https://www.googleapis.com/auth/googlehealth.sleep.readonly
```

**To re-generate the refresh token:**
1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground)
2. Gear icon → "Use your own OAuth credentials" → enter Client ID + Secret
3. Make sure `https://developers.google.com/oauthplayground` is in Authorized redirect URIs in Google Cloud Console → Credentials → OAuth client
4. Paste all 3 scopes, click "Authorize APIs" → sign in → grant access
5. Click "Exchange authorization code for tokens" → copy `refresh_token`
6. Update `GOOGLE_REFRESH_TOKEN` — it's a **project-wide** Edge Function secret, so one update covers every function (sync-steps, sync-extras, sync-sleep, sync-hr-intraday, …). No per-function step.
   - CLI: `supabase secrets set GOOGLE_REFRESH_TOKEN='1//…' --project-ref rkxorbsusqfhlhrlajlj` (needs `SUPABASE_ACCESS_TOKEN` set), or set it in Dashboard → Project Settings → Edge Functions → Secrets.
   - Verify: POST any sync function; a 500 with `invalid_grant: Token has been expired or revoked` means the refresh token is dead (e.g. revoked, or app left in "Testing" status where Google expires refresh tokens after 7 days).

### Edge function: `sync-extras`

Source: `supabase/functions/sync-extras/index.ts`. Deployed with `verify_jwt: false`.
```bash
supabase functions deploy sync-extras --project-ref rkxorbsusqfhlhrlajlj --no-verify-jwt
```

Default: 30-day window (active-minutes capped to 14). HRV/SpO2 paginate through all available points via `page_size=200` + `page_token`. Returns `{ synced, rows, upsertError }`.

### Troubleshooting: resting HR (or any metric) goes stale in the recovery graph

**Symptom:** the recovery graph shows resting HR (or HRV) flat-lining / blank for the most recent few days while other metrics are current. Confirm with:
```sql
select date, resting_hr_bpm, hrv_rmssd from activity order by date desc limit 14;
```
If recent rows have `resting_hr_bpm = null` but older rows have values, it's this issue.

**Root cause — data latency, not a code bug.** Google Health computes the daily `heart-rate` rollup with a few days' lag. `sync-extras` re-fetches the full 30-day window and upserts on every run, but it only fires when the app is opened (`App.jsx` → `syncExtras`); there is **no scheduled job**. So if no sync runs after Google backfills the value, the day stays `null` in our table forever.

**Fix (immediate):** just re-run the function — it backfills the whole window:
```powershell
$h = @{ Authorization = "Bearer <ANON_KEY>"; "Content-Type"="application/json" }
Invoke-RestMethod -Uri "https://rkxorbsusqfhlhrlajlj.supabase.co/functions/v1/sync-extras" -Method Post -Headers $h -Body '{"startDate":"2026-06-01","endDate":"2026-06-10"}'
```
Then refresh the app. (Verified 2026-06-10: re-running backfilled 06-05→06-10 resting HR that the daily syncs had missed.)

**Fix (permanent) — DONE 2026-06-10:** a `pg_cron` job (`nightly-sync-extras`, jobid 1) calls `sync-extras` every night at **01:00 UTC (03:00 CEST)** via `pg_net`, so the 30-day window stays current regardless of when the app is opened. Inspect / manage it:
```sql
select jobid, schedule, jobname, active from cron.job where jobname = 'nightly-sync-extras';
select * from cron.job_run_details where jobid = 1 order by start_time desc limit 5;  -- did it fire?
select id, status_code, content::jsonb->>'synced' as synced, error_msg
  from net._http_response order by id desc limit 5;                                   -- what the function returned
-- to remove: select cron.unschedule('nightly-sync-extras');
```
**Gotcha:** `net.http_post` defaults to a **5000 ms timeout**, but `sync-extras` takes ~8s (paginated Google calls). The job sets `timeout_milliseconds := 30000` — don't drop that or every run will time out (the function may still finish server-side, but you lose the status/response). Extensions required: `pg_cron` + `pg_net` (both enabled).

### ⚠️ Known latent bug: upsert can NULL-overwrite a good value

`sync-extras` builds per-date row objects and only sets a metric key when a value was found (`if (bpm != null) ensureDate(date).resting_hr_bpm = ...`). It then calls `supabase.from('activity').upsert(rows, { onConflict: 'date' })`.

supabase-js defaults to `defaultToNull: true`, and PostgREST builds the column list from the **union of keys across the whole batch**. So if one date in the batch has `resting_hr_bpm` and another (recent, still-lagging) date omits it, the column enters the statement and the omitting row sends `NULL` — the `ON CONFLICT DO UPDATE` then writes `NULL` over any existing good value for that date.

- **Not** the cause of the "stale resting HR" symptom above (that's latency). This is a separate regression risk: low frequency, but it can *erase* data.
- For it to bite: a date must already hold a good value, then come back empty from Google in a *later* batch that also contains that metric for other dates.

**Recommended fix — COALESCE upsert via an RPC** (a missing metric can then never erase an existing one):
```sql
create or replace function upsert_activity(rows jsonb)
returns void language sql as $$
  insert into activity as a (date, km, active_minutes, resting_hr_bpm, hrv_rmssd, spo2_pct)
  select (r->>'date')::date, (r->>'km')::numeric, (r->>'active_minutes')::int,
         (r->>'resting_hr_bpm')::int, (r->>'hrv_rmssd')::numeric, (r->>'spo2_pct')::numeric
  from jsonb_array_elements(rows) r
  on conflict (date) do update set
    km             = coalesce(excluded.km,             a.km),
    active_minutes = coalesce(excluded.active_minutes, a.active_minutes),
    resting_hr_bpm = coalesce(excluded.resting_hr_bpm, a.resting_hr_bpm),
    hrv_rmssd      = coalesce(excluded.hrv_rmssd,      a.hrv_rmssd),
    spo2_pct       = coalesce(excluded.spo2_pct,       a.spo2_pct);
$$;
```
Then call `supabase.rpc('upsert_activity', { rows })` instead of `.upsert()`. Before committing, verify the exact PostgREST missing-key behavior for the installed `@supabase/supabase-js` version rather than assuming.

---

## Google Health API integration — sleep

Sleep data is synced via a separate edge function (`sync-sleep`) into the `sleep` table.

### Sleep API endpoint

Unlike steps (which uses `dailyRollUp`), sleep uses a plain **GET list** with no date params:
```
GET https://health.googleapis.com/v4/users/me/dataTypes/sleep/dataPoints
Authorization: Bearer <access_token>
```

Returns all sleep data points available. Filter by date range in the function after fetching. Same OAuth secrets as `sync-steps` — no extra scopes needed beyond what's already in the refresh token (`googlehealth.sleep.readonly` is already included).

Key discovery: `sleep` does **not** support `dailyRollUp`. Attempting it returns a 400 with:
```
"DailyRollup is not supported for data type sleep — allowed: list, get, reconcile, create, update, batchDelete"
```

### Sleep response shape

```json
{
  "dataPoints": [{
    "sleep": {
      "interval": {
        "startTime": "2026-06-02T23:08:00Z",
        "startUtcOffset": "3600s",
        "endTime": "2026-06-03T06:36:00Z",
        "endUtcOffset": "3600s"
      },
      "type": "STAGES",
      "stages": [
        { "startTime": "2026-06-02T23:08:00Z", "endTime": "2026-06-02T23:14:30Z", "type": "AWAKE" },
        { "startTime": "2026-06-02T23:14:30Z", "endTime": "2026-06-02T23:30:30Z", "type": "LIGHT" },
        ...
      ],
      "summary": {
        "minutesInSleepPeriod": "448",
        "minutesAsleep": "429",
        "minutesAwake": "19",
        "stagesSummary": [
          { "type": "AWAKE", "minutes": "18", "count": "3" },
          { "type": "LIGHT", "minutes": "282", "count": "15" },
          { "type": "DEEP",  "minutes": "46",  "count": "8" },
          { "type": "REM",   "minutes": "101", "count": "6" }
        ]
      }
    }
  }]
}
```

Key gotchas:
- All `minutes` values in `summary` are **strings** — must `parseInt()`
- `startUtcOffset` is a string like `"3600s"` — strip the `s` and parse as seconds to compute local time
- Sleep sessions span two calendar days; we use the **wake-up date** (local time) as the record's `date`
- Stage types: `AWAKE`, `LIGHT`, `DEEP`, `REM` (all caps)
- **Multiple sessions per day (naps):** a single wake-up date can legitimately have more than one session — a night plus one or more daytime naps. We keep them all. The conflict target is `(date, sleep_start)` (not `date`), and within each wake-date the longest-`asleep_min` session is flagged as the night (`is_nap = false`) while the rest are naps (`is_nap = true`). Because each row has a distinct `sleep_start`, a single `upsert()` never hits `ON CONFLICT DO UPDATE command cannot affect row a second time` (code `21000`). ⚠️ *History:* before 2026-06-19 this was a dedup-by-date that kept only the highest `asleep_min` and silently discarded every nap — Google had them all along. If you ever see only one session per day again, check that the `(date, sleep_start)` unique constraint still exists.
- Do **not** use a POST body to pass a date range to the sleep endpoint — POST is treated as `CreateDataPoint` (write operation) and returns 403 `ACCESS_TOKEN_SCOPE_INSUFFICIENT` because the refresh token is read-only.

### Date assignment

```js
const endLocal  = new Date(interval.endTime)              // UTC wake-up time
const offsetSec = parseInt(interval.endUtcOffset)         // e.g. 3600 from "3600s"
const wakeLocal = new Date(endLocal.getTime() + offsetSec * 1000)
const date      = wakeLocal.toISOString().split('T')[0]   // "YYYY-MM-DD" local wake-up date
```

### Supabase table: `sleep`

```sql
create table public.sleep (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  date         date not null,          -- wake-up date (local)
  sleep_start  timestamptz not null,
  sleep_end    timestamptz not null,
  duration_min int,                    -- total time in bed
  asleep_min   int,                    -- actual sleep (excl. awake in bed)
  deep_min     int,
  rem_min      int,
  light_min    int,
  awake_min    int,
  stages       jsonb,                  -- [{startTime, endTime, type}]
  is_nap       boolean not null default false,  -- false = main night, true = daytime nap
  constraint sleep_date_start_key unique (date, sleep_start)  -- multiple sessions/day coexist
);
```

> Migration `sleep_allow_naps_per_day` (2026-06-19) added `is_nap` and replaced the old `unique(date)` with `unique(date, sleep_start)`.

RLS policy: `auth.uid() is not null` (any authenticated user). Both `authenticated` and `service_role` need SELECT/INSERT/UPDATE grants — run:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sleep TO service_role;
```

### Edge function: `sync-sleep`

Source: `supabase/functions/sync-sleep/index.ts`. Deploy:
```bash
supabase functions deploy sync-sleep --project-ref rkxorbsusqfhlhrlajlj --no-verify-jwt
```

Default: syncs last 30 days. Accepts optional `{ startDate, endDate }` body. Returns `{ synced, upsertError }`.

Pipeline:
1. GET all sleep data points (no date filter — API returns everything)
2. Map each data point to a row, assigning `date` from the local wake-up time
3. **Group by wake-date and flag sessions** — within each date the longest `asleep_min` becomes the night (`is_nap = false`), all others become naps (`is_nap = true`). Nothing is discarded.
4. Filter to the requested date window using `sleep_end`
5. Upsert with `onConflict: 'date,sleep_start'`

### Sleep tab UI (Sleep.jsx)

- **Stage timeline**: custom SVG — Y axis labels baked in as `<text>` elements, stage blocks as `<rect>`, thin vertical connector lines between stage transitions (Samsung Health style). Extracted into a reusable `SleepDetail` component (header + timeline) so the nap overlay can reuse it.
- **Weekly bar**: bars scale to 10h max; duration text rendered inside each bar. Counts nights only (`useWeekSleep` filters `is_nap = false`).
- **Naps**: `useSleep(date)` returns `{ sleep, naps }` — the night row plus a sorted array of nap rows for that day. A `☀️ N naps · <total>` button under the night graph opens `NapView`, a full-screen overlay rendering each nap with the same `SleepDetail` timeline, tied to the open day. Days with only naps (no night) show a view-naps button in the empty state.
- **Stage colours**: Deep `#3a5fa8`, REM `#5ba4e6`, Light `#b47fdb`, Awake `#e8784a`

### Recovery trends section (Sleep tab)

Below the weekly sleep bar, a **RECOVERY — 30 DAYS** card shows SVG line charts for HRV, SpO₂, and resting HR. Powered by `useRecoveryTrends(date)` hook (`src/hooks/useRecoveryTrends.js`) which fetches the last 30 days of `resting_hr_bpm`, `hrv_rmssd`, `spo2_pct` from the `activity` table.

- Section only renders if there are 2+ rows with any recovery data
- Each metric only renders its chart if at least one non-null value exists
- "Not enough data yet" shown for metrics with < 2 data points
- HRV: purple `#b47fdb`, unit ms RMSSD — averaged across all readings per day
- SpO₂: blue `#5ba4e6`, unit % min — minimum per day (catches overnight dips), artifact filter rejects readings < 80%
- Resting HR: red `#e87a8a`, unit bpm avg — from `heart-rate` daily rollup

**HRV data availability note:** Google Health only retains ~1 night of raw HRV data points (the list endpoint returns up to ~156 points, all from last night). Historical HRV accumulates one day at a time as you sync. SpO₂ has full paginated history available.

---

## Google Health API integration — intraday heart rate (planned)

> ✅ **SHIPPED 2026-06-08 — this section is historical.** The intraday HR feature is live; see HANDOFF.md "HR Intraday Feature — FULLY WORKING" for the as-built implementation (`sync-hr-intraday`, `get_hr_3min_chart`, Activity.jsx 24h chart). The build plan below is kept for context only.

### What's confirmed

Probed 2026-06-06 via `probe-health` edge function. The `heart-rate` dataPoints list endpoint returns raw samples from the Inspire 3 at ~3-second intervals:

```json
{
  "dataSource": { "recordingMethod": "PASSIVELY_MEASURED", "device": { "displayName": "Inspire 3" }, "platform": "FITBIT" },
  "heartRate": {
    "sampleTime": {
      "physicalTime": "2026-06-06T20:10:15Z",
      "utcOffset": "3600s",
      "civilTime": { "date": { "year": 2026, "month": 6, "day": 6 }, "time": { "hours": 21, "minutes": 10, "seconds": 15 } }
    },
    "beatsPerMinute": "81"
  }
}
```

~28,800 points per day. Pagination required (`page_size=200` + `page_token`). The `start_time` query param is **invalid** — filter by date after fetching.

### Tiered storage plan

| Tier | Retention | Resolution | Rows (steady state) |
|---|---|---|---|
| Raw | 0–48h | ~3s samples | ~57,600 |
| Aggregated | 48h+ | 3 numbers (min/max/avg) written to `activity` | 0 extra |

57,600 rows is trivial for Postgres — no slowdowns. Index on `(user_id, timestamp)` is sufficient; single-digit ms query time.

No minute-tier needed. Once raw rows age past 48h, compute daily min/max/avg → write to `activity.hr_min`, `activity.hr_max`, `activity.resting_hr_bpm` → delete raw rows. The `heart_rate_intraday` table stays permanently small.

### UI — two views via toggle (48H | 30D)

- **48H**: continuous curve, every ~3s sample, timestamp on X — shows spikes in detail (spider incidents etc.)
- **30D**: one band per day showing min/max range + avg line, date on X — shows recovery/stress patterns over the month. Just a query on `activity` columns, no extra data needed.

### Build plan

1. **Supabase migration**: new `heart_rate_intraday` table (`id`, `timestamp timestamptz`, `bpm smallint`, `user_id uuid`); add `hr_min smallint`, `hr_max smallint` columns to `activity`
2. **Edge function `sync-hr-intraday`**: paginate today's raw points → upsert; for rows >48h old compute daily min/max/avg → write to `activity` → delete raw rows
3. **UI**: HR chart in Activity tab with 48H/30D toggle — 48H is recharts AreaChart on raw points, 30D is ComposedChart (area for range band + line for avg), colour `#e87a8a`

---

## Color palette

| Metric | Color |
|---|---|
| Calories | `#e8784a` |
| Sodium | `#5ba4e6` |
| Protein | `#6ec87a` |
| Fat | `#c97fd4` |
| Carbs | `#f0c96a` |
| Steps | `#b47fdb` |
| Weight | `#f0c96a` |
| BP systolic | `#e87a8a` |
| BP diastolic | `#5ba4e6` |
| Normal/good | `#6ec87a` |
| Warning | `#f0c96a` |
| Danger | `#e8784a` / `#ff5a5a` |
| Sleep (accent) | `#5ba4e6` |
| Sleep — Deep | `#3a5fa8` |
| Sleep — REM | `#5ba4e6` |
| Sleep — Light | `#b47fdb` |
| Sleep — Awake | `#e8784a` |
