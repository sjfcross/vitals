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
| `activity` | `date`, `steps`, `km`, `active_minutes`, `workout_type`, `workout_duration_min` |
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
  date         date not null unique,   -- wake-up date (local)
  sleep_start  timestamptz not null,
  sleep_end    timestamptz not null,
  duration_min int,                    -- total time in bed
  asleep_min   int,                    -- actual sleep (excl. awake in bed)
  deep_min     int,
  rem_min      int,
  light_min    int,
  awake_min    int,
  stages       jsonb                   -- [{startTime, endTime, type}]
);
```

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

Default: syncs last 30 days. Accepts optional `{ startDate, endDate }` body. Returns `{ synced, rows, upsertError }`.

### Sleep tab UI (Sleep.jsx)

- **Stage timeline**: custom SVG — Y axis labels baked in as `<text>` elements, stage blocks as `<rect>`, thin vertical connector lines between stage transitions (Samsung Health style)
- **Weekly bar**: bars scale to 10h max; duration text rendered inside each bar
- **Stage colours**: Deep `#3a5fa8`, REM `#5ba4e6`, Light `#b47fdb`, Awake `#e8784a`

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
