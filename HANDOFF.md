# VITALS — Project Handoff

## What it is
A personal PWA health tracker. 4 tabs: Overview, Nutrition, Activity, Weight. Smart paste meal logger that parses Claude's nutrition analysis output. Installable on mobile. Single user.

**Live:** https://sjfcross.github.io/vitals/  
**Repo:** https://github.com/sjfcross/vitals  
**Local:** `D:\Projects\vitals`

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 + Vite 8 |
| Styling | Tailwind v4 (`@tailwindcss/vite` plugin, `@import "tailwindcss"` in index.css) |
| Database | Supabase (Postgres + Auth) |
| PWA | vite-plugin-pwa + Workbox |
| Deploy | GitHub Actions → GitHub Pages |

---

## Supabase

| | |
|---|---|
| Project URL | `https://rkxorbsusqfhlhrlajlj.supabase.co` |
| Anon key | `sb_publishable_WtmGBuHzra4uafOZe17pbg_jFFL7YCa` |
| Auth | Email/password, email confirm OFF |
| RLS | Enabled on all tables, policy: `auth.role() = 'authenticated'` on ALL ops |

**Tables:** `meals`, `activity`, `weight`, `user_profile`  
**Grants:** ALL granted to `anon` and `authenticated` roles.

Local credentials live in `D:\Projects\vitals\.env.local` (not committed):
```
VITE_SUPABASE_URL=https://rkxorbsusqfhlhrlajlj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_WtmGBuHzra4uafOZe17pbg_jFFL7YCa
```

GitHub Secrets (for CI builds): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — both set in repo settings.

---

## Project Structure

```
D:\Projects\vitals\
├── .env.local                        ← Supabase creds (not committed)
├── .github/workflows/deploy.yml      ← Build + deploy to GitHub Pages on push to main
├── index.html                        ← Entry point, Google Fonts (DM Sans + DM Mono)
├── vite.config.js                    ← base: '/vitals/', Tailwind plugin, PWA config
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx                       ← Auth gate → AppInner → Layout + 4 tabs
    ├── index.css                     ← Full design system (CSS vars + utility classes)
    ├── lib/
    │   └── supabase.js               ← createClient, logs error if env vars missing
    ├── hooks/
    │   ├── useProfile.js             ← user_profile table (targets, height)
    │   ├── useMeals.js               ← meals table + useWeekMeals
    │   ├── useActivity.js            ← activity table + useWeekActivity
    │   └── useWeight.js              ← weight table (30-day window)
    ├── components/
    │   ├── Login.jsx                 ← Email/password login form
    │   ├── Layout.jsx                ← Tab bar + header
    │   ├── CircularRing.jsx          ← SVG progress ring
    │   ├── LogMealSheet.jsx          ← Bottom sheet: paste parser + manual entry
    │   └── OnboardingSheet.jsx       ← First-launch: set height + targets
    └── tabs/
        ├── Overview.jsx              ← Daily summary rings + quick-log
        ├── Nutrition.jsx             ← Meal list + weekly chart
        ├── Activity.jsx              ← Steps + active minutes
        └── Weight.jsx                ← Weight log + trend chart
```

---

## Auth Flow

```
App.jsx
  session === undefined  →  loading spinner ("VITALS")
  session === null       →  <Login />
  session exists         →  <AppInner />
                                ↓
                         useProfile() loads user_profile
                         if no profile → <OnboardingSheet />
```

`getSession()` has full error handling — if Supabase fails it falls through to login instead of hanging.

---

## Smart Paste Meal Logger

In-app: **Log meal → ✨ Paste from Claude**

The parser (`LogMealSheet.jsx`) looks for these keywords (case-insensitive):

| Field | Matches |
|---|---|
| Calories | `calories: 355` |
| Protein | `protein: 15g` |
| Fat | `fat: 16g` or `total fat: 16g` |
| Saturated fat | `saturated: 6g` |
| Carbs | `carbs: 38g` or `carbohydrates: 38g` |
| Sugar | `sugar: 10g` |
| Added sugar | `added sugar: ~2g` |
| Fibre | `fibre: 2g` or `fiber: 2g` |
| Sodium | `sodium: 750mg` |

**Prompt to use in any Claude conversation:**
```
Analyse the nutrition of: [describe your meal]

Reply in this exact format:
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

---

## Design System (`src/index.css`)

**Backgrounds:** `--bg: #0e0f11` · `--card: #161819` · `--elevated: #1e2022`  
**Text:** `--text: #f0eeea` · `--muted: #9ca0a4` · `--very-muted: #6b6f73`  
**Fonts:** DM Sans (body) · DM Mono (numbers/mono)

**Accent colours:**

| Nutrient | Colour |
|---|---|
| Calories | `#e8784a` |
| Sodium | `#5ba4e6` |
| Protein | `#6ec87a` |
| Fat | `#c97fd4` |
| Carbs | `#f0c96a` |
| Fibre | `#5ecfcf` |
| Steps | `#b47fdb` |
| Weight | `#f0c96a` |

**CSS classes:** `.card` · `.card-lg` · `.card-elevated` · `.input` · `.btn-primary` · `.btn-ghost` · `.mono` · `.fade-up` · `.sheet` · `.sheet-backdrop`

---

## Deploy Pipeline

Push to `main` → GitHub Actions builds with secrets → uploads `dist/` → GitHub Pages serves at `/vitals/`.

```bash
# Trigger manually if needed
& "C:\Program Files\GitHub CLI\gh.exe" run rerun <run-id> --repo sjfcross/vitals
& "C:\Program Files\GitHub CLI\gh.exe" run list --repo sjfcross/vitals --limit 5
```

Build locally:
```powershell
cd D:\Projects\vitals
npm run build   # outputs to dist/
npm run dev     # local dev server
```

---

## Infrastructure Notes

- **Git SSL:** Fixed globally — `git config --global http.sslBackend schannel`. Push/pull work without errors.
- **gh CLI:** Installed at `C:\Program Files\GitHub CLI\gh.exe`. Authenticated as `sjfcross`. Not in PATH — call via full path.
- **Claude in Chrome:** MCP extension connected — can take screenshots, run JS, navigate.

---

## Homepage Card (`F:\sjfcross.github.io`)

VITALS has a card on the homepage at `https://sjfcross.github.io`. It's in the "Apps" row at the bottom of the divisions grid.

- **HTML:** `F:\sjfcross.github.io\index.html` — look for `division-card-app`
- **CSS:** `F:\sjfcross.github.io\app.css` — `.division-card-app`, `.card-app-inner`, `.app-title`, `.app-desc`
- **Image:** `F:\sjfcross.github.io\assets\img\vitals.jpg`
- Card shows: image background, light overlay, APP tag, VITALS title, description
- Homepage repo: `https://github.com/sjfcross/sjfcross.github.io`
