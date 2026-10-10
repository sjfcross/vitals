# Gym tab — plan (not started)

Notes from 2026-10-10 for when gym training starts again. Nothing here is built yet.
Before building: read `README.md`, then propose tables + a v1 scope.

## Decision: build it inside VITALS, use openGym for ideas only

[openGym](https://github.com/DuarteSantos8/openGym) is a mature self-hosted gym tracker (React 19, Node API, JSON-file storage, Docker). Reference only, because:

- **Code is AGPL-3.0.** Copying any of it into VITALS (public repo + public site) would force VITALS to AGPL.
- **Exercise media is proprietary** ("Gym visual", licensed for openGym only). Unusable even with a license change.
- **Self-hosted Docker server.** VITALS has no server (GitHub Pages + Supabase); running it alongside would need a VPS/home server + reverse proxy.

Tradeoff accepted: we maintain it ourselves and won't get openGym's polish (importers, 5,600-exercise library).

## Scope

| Feature (from openGym's list) | When |
|---|---|
| Routines — fixed weekdays or A/B/C rotation | v1 |
| Guided session: last weights pre-filled, rest timer | v1 |
| Progression rules (linear / double progression) | v1 |
| Estimated 1RM + PR detection | v1 |
| Muscle map, structural balance ratios, yearly heatmap | later |
| Passkeys, multi-profile, i18n, admin dashboard | skip (single user) |

Stack: same as the rest of VITALS (React 19, Supabase with RLS `auth.uid() = user_id`, recharts). Remember the existing gotchas in `README.md` (GRANTs on new tables, `user_id DEFAULT auth.uid()`).

## Ties to existing VITALS data

- **HR during a session** — Inspire 3 intraday HR is already synced at 5 s resolution, but `heart_rate_intraday` only keeps **48 h**. Either store a per-session summary at session end (avg/max HR, time in zones) or keep rows that fall inside workout windows.
- **Body weight** — already tracked → relative strength (lift / bodyweight).
- **Recovery** — HRV + resting HR already exist → show next to training load.

## Exercise animations — only for the exercises actually in the routine

Workflow: give Claude the exercise name or a **photo of the machine** → it identifies the machine/exercise (for cable stations and multi-use machines, also say which exercise) → finds a matching image under a usable license, or flags it to be drawn. Verify each file's license before committing it.

Sources, best first (licenses as remembered on 2026-10-10 — re-check when fetching):

1. **free-exercise-db** (GitHub, `yuhonas/free-exercise-db`) — ~800 exercises, 2 photos each (start/end). Believed public domain (Unlicense). Crossfade the two frames = simple animation.
2. **wger.de** — open-source workout app; exercise images mostly CC-BY-SA → needs an attribution line in the app.
3. **Wikimedia Commons** — some animated exercise GIFs under CC licenses; patchy coverage.
4. **Self-drawn SVG** — Claude draws an animated stick-figure SVG of the movement. No licensing, tiny, matches the dark theme. Fallback for anything not found above.

Avoid: ExerciseDB / RapidAPI GIF packs (GIF licensing unclear), YouTube frames, equipment-manufacturer images.

## Open items

- List of exercises in the actual routine (names and/or machine photos).
- Session HR: summary-at-end vs. retained rows — decide when designing tables.
