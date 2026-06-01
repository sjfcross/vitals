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
  tabs/
    Overview.jsx       — rings + weekly bar chart + meal list + date nav + Log meal CTA
    Nutrition.jsx      — calorie hero, macro donut, full nutrient table, per-meal breakdown
    Activity.jsx       — step log + date nav
    Weight.jsx         — current weight card, 7/30-day deltas, chart with 1W/4W/All toggle, log form
    BloodPressure.jsx  — latest SYS/DIA card + classification, dual-line chart with 1W/4W/All toggle, log form, recent readings list
  lib/
    supabase.js        — Supabase client init
  main.jsx             — app entry
  App.jsx              — auth gate + tab routing + date state
```

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
