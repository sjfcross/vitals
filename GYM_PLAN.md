# Gym tab — plan

Notes from 2026-10-10, refined 2026-11-02. **Status: v1 built (2026-11-02)** — see README → "Gym tab". The DB migration still has to be applied by hand; the "later" rows below are not built.
Before changing it: read `README.md` and `HANDOFF.md`.

## Decision: build it inside VITALS, use openGym for ideas only

[openGym](https://github.com/DuarteSantos8/openGym) is a mature self-hosted gym tracker (React 19, Node API, JSON-file storage, Docker). Reference only, because:

- **Code is AGPL-3.0.** Copying any of it into VITALS (public repo + public site) would force VITALS to AGPL.
- **Exercise media is proprietary** ("Gym visual", licensed for openGym only). Unusable even with a license change.
- **Self-hosted Docker server.** VITALS has no server (GitHub Pages + Supabase); running it alongside would need a VPS/home server + reverse proxy.

Tradeoff accepted: we maintain it ourselves and won't get openGym's polish (importers, 5,600-exercise library).

## How it will be used (agreed 2026-11-02)

1. **Build the software first**, with the full exercise library browsable — the routine doesn't exist yet.
2. User renews the gym membership and photographs the machines. Claude identifies each machine/exercise and maps it to a library entry (or adds a custom one).
3. **Work out a plan together** → entered as a routine (exercises, sets, reps, start weights, days or rotation).
4. **In the gym:** the app shows today's planned exercises with last session's weights pre-filled; log sets/reps/weight per set; rest timer between sets.
   - **Machine taken → "swap"**: suggest alternatives that hit the same primary muscles (from the library's muscle tags).
   - **Extras**: add any library exercise to the session ad hoc. The plan is the default, not a cage — everything actually done is logged.
5. **After the session, automatically:** HR summary from the Inspire 3 for the session window, progress charts, PR alerts, "time to go heavier" hints from the progression rule.

## Scope

| Feature | When |
|---|---|
| Exercise library: search/filter by muscle + equipment, detail view with animation | v1 |
| Custom exercises (for gym-specific machines not in the library) | v1 |
| Routines — fixed weekdays or A/B/C rotation | v1 |
| Guided session: last weights pre-filled, rest timer, swap (same muscles), ad-hoc extras | v1 |
| Progression rules (linear / double progression) | v1 |
| Estimated 1RM + PR detection, per-exercise progress chart | v1 |
| Session HR summary (avg/max, time in zones) | v1 |
| Muscle map, structural balance ratios, yearly heatmap | later |
| Passkeys, multi-profile, i18n, admin dashboard | skip (single user) |

Stack: same as the rest of VITALS (React 19, Supabase with RLS `auth.uid() = user_id`, recharts, inline styles + `index.css` classes, dark palette from `README.md`). Remember the existing gotchas in `README.md` (GRANTs on new tables for `authenticated`, `user_id DEFAULT auth.uid()`).

## Ties to existing VITALS data

- **HR during a session** — Inspire 3 intraday HR is synced (`sync-hr-intraday`, ~3 s samples), but `heart_rate_intraday` only keeps **48 h**. Decision: **store a per-session summary at session end** (avg/max HR, minutes per zone) on the session row, computed from `heart_rate_intraday` for the session's start/end window. If the session is logged later than 48 h, the summary stays empty.
- **Body weight** — already tracked → relative strength (lift / bodyweight).
- **Recovery** — HRV + resting HR already exist → show next to training load.

## Exercise library + animations

The **whole library** is browsable in the app, not just routine exercises.

1. **free-exercise-db** (GitHub, `yuhonas/free-exercise-db`) — ~800 exercises with `primaryMuscles`, `secondaryMuscles`, `equipment`, `category`, and 2 photos each (start/end). Crossfade the two frames = simple animation. **Verify the license before using it** (believed Unlicense / public domain as of 2026-10-10). Bundle the JSON metadata in the app; load the images on demand (e.g. via jsDelivr from the GitHub repo, pinned to a commit) instead of committing ~1,600 images.
2. **wger.de** — exercise images mostly CC-BY-SA → needs an attribution line in the app. Only if (1) has gaps.
3. **Self-drawn SVG** — animated stick figure of the movement. No licensing, tiny, matches the dark theme. Fallback for custom exercises / gym-specific machines.

Avoid: ExerciseDB / RapidAPI GIF packs (GIF licensing unclear), YouTube frames, equipment-manufacturer images.

## Build notes (for whoever builds v1, incl. a cloud session)

- **Pushing to `main` auto-deploys to the live site** (`.github/workflows/deploy.yml`). Work on a branch and open a PR; never push to `main`.
- **Database:** there is no migrations folder yet. Put the new tables as SQL in `supabase/migrations/<timestamp>_gym.sql` (tables, RLS policies, GRANTs, indexes). It gets applied to the live project from the user's PC after review — do not assume the tables exist.
- **No Supabase credentials in the repo** (`.env.local` is local only). For development without them, give the gym data layer a mock/in-memory mode so the UI can be built and previewed; the real Supabase path is tested locally after merge.
- Keep the gym code in its own files (`src/tabs/Gym*.jsx`, `src/components/gym/`, `src/lib/gym*`), and touch shared files (nav, App.jsx) minimally.

## Open items

- List of exercises in the actual routine — comes after the membership renewal (machine photos).
