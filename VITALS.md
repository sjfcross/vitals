# VITALS

Personal health tracker PWA. Single user. Live at https://sjfcross.github.io/vitals/

## Stack

React 19 + Vite + Supabase (auth + DB) — deployed via GitHub Actions to GitHub Pages.

## Tabs & data

| Tab | What it tracks | Source |
|---|---|---|
| Overview | Daily summary across all categories | derived |
| Nutrition | Meals — calories, full macros, 5 micronutrients (Ca, Fe, K, vit C, vit D) | manual / Claude paste |
| Activity | Steps, distance, active minutes, resting HR | Fitbit → Google Health sync |
| Weight | Weight in kg | manual |
| Blood Pressure | Systolic, diastolic, pulse | manual |
| Sleep | Duration, deep/REM/light/awake minutes | Fitbit → Google Health sync |

## Meal logging

Two modes: **Paste from Claude** (paste Claude's nutrition analysis, fields auto-fill) or **manual entry**. Uses a Claude Project with a system prompt that outputs a fixed parseable format.

Parser extracts: calories, protein, fat, sat. fat, carbs, sugar, added sugar, fibre, sodium, calcium, iron, potassium, vitamin C, vitamin D.

## Supabase

- Project: `rkxorbsusqfhlhrlajlj`
- Tables: `meals`, `activity`, `weight`, `blood_pressure`, `sleep`, `user_profile`
- All tables have RLS — authenticated users only
- Edge functions: `sync-steps`, `sync-sleep`, `sync-extras` (distance, active minutes, resting HR)

## Design

Dark theme — bg `#0e0f11`, cards `#161819`. DM Sans + DM Mono. Colour per metric: calories orange, sodium blue, protein green, fat purple, carbs yellow.
