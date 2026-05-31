# VITALS — Project Handoff

## What This Is

VITALS is a personal PWA health tracker. It runs on GitHub Pages, uses Supabase for the database, and is built with React + Vite. Single user. No backend server — all queries go direct from the browser to Supabase via the JS client.

Live: deployed to GitHub Pages (repo: vitals under the user's GitHub account).
Local dev: `D:\Projects\vitals` — run with `npm run dev`.

---

## Tech Stack

- **Frontend:** React 18, Vite, Recharts (charts only)
- **Database:** Supabase (Postgres + auth + RLS)
- **Auth:** Supabase email/password — single user, sessions persisted in localStorage
- **Hosting:** GitHub Pages via `gh-pages` branch
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

### `weight_logs`, `activity_logs`, `profiles`
Standard single-user tables. Not relevant to meal logging.

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
    useWeight.js       — weight log data
  tabs/
    Overview.jsx       — rings + weekly bar chart + today's meal list + Log meal CTA
    Nutrition.jsx      — calorie hero, macro donut, full nutrient table, per-meal breakdown
    Activity.jsx       — step log
    Weight.jsx         — weight chart
  lib/
    supabase.js        — Supabase client init
  main.jsx             — app entry
  App.jsx              — auth gate + tab routing
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
- `useActivity.js`, `useWeight.js`, `useProfile.js`
- `Activity.jsx`, `Weight.jsx`
- `vite.config.js`, `index.css`
- RLS policies
- Any Supabase table other than `meals`

---

## Edge Cases

| Case | Behaviour |
|---|---|
| Old meal rows (no description) | `meal.description` is `null` — Overview shows nothing; Nutrition falls back to `m.name` |
| Paste without a Description line | Regex returns `''`, saved as `null` |
| Very long description | `maxLength={120}` on the input; no DB constraint |
| Description contains quotes | Supabase client handles escaping |
