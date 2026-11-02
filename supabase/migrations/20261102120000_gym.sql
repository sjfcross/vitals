-- ─────────────────────────────────────────────────────────────────────────────
-- VITALS — Gym tab (v1)
--
-- Tables: gym_settings, gym_custom_exercises, gym_routines, gym_routine_exercises,
--         gym_sessions, gym_sets
--
-- Exercise references (`exercise_id`, `swapped_from_exercise_id`) are TEXT keys:
--   • a free-exercise-db id, e.g. 'Leg_Press'        (bundled library, src/data/)
--   • 'custom:<uuid>' for a row in gym_custom_exercises
-- One key format everywhere keeps swaps / history / PRs simple. Custom exercises are
-- archived (archived = true), never hard-deleted by the app, so old logs keep their name.
--
-- Conventions (README gotchas): RLS `auth.uid() = user_id`, `user_id DEFAULT auth.uid()`,
-- explicit GRANTs to `authenticated`. Child tables carry user_id too and use composite
-- foreign keys (parent_id, user_id) so a row can never point at another user's parent.
--
-- Apply from the user's PC after review (NOT applied by the cloud session):
--   supabase db push --project-ref rkxorbsusqfhlhrlajlj      (or paste into the SQL editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Settings (one row per user) ─────────────────────────────────────────────
create table public.gym_settings (
  user_id               uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  hr_max                smallint not null default 185 check (hr_max between 120 and 230),  -- for HR zones
  default_rest_seconds  smallint not null default 90  check (default_rest_seconds between 0 and 900),
  default_increment_kg  numeric(5,2) not null default 2.5 check (default_increment_kg > 0),
  updated_at            timestamptz not null default now()
);

-- ── Custom exercises (gym-specific machines not in the library) ────────────
create table public.gym_custom_exercises (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at         timestamptz not null default now(),
  name               text not null check (length(trim(name)) between 1 and 120),
  primary_muscles    text[] not null default '{}',     -- same vocabulary as the library
  secondary_muscles  text[] not null default '{}',
  equipment          text,                              -- 'machine', 'cable', 'dumbbell', …
  category           text not null default 'strength',
  mechanic           text check (mechanic in ('compound', 'isolation')),
  force              text check (force in ('push', 'pull', 'static')),
  notes              text,                              -- e.g. "Gym80, seat 4, machine #7"
  based_on           text,                              -- optional library id it resembles (image/animation source)
  archived           boolean not null default false
);
create index gym_custom_exercises_user_idx on public.gym_custom_exercises (user_id);

-- ── Routines ────────────────────────────────────────────────────────────────
-- schedule_type 'weekdays': runs on the ISO weekdays in `weekdays` (1 = Mon … 7 = Sun)
-- schedule_type 'rotation': A/B/C rotation ordered by `rotation_order`; the next routine
--                           after the one last trained is suggested.
create table public.gym_routines (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  name            text not null check (length(trim(name)) between 1 and 80),
  schedule_type   text not null default 'rotation' check (schedule_type in ('weekdays', 'rotation')),
  weekdays        smallint[] not null default '{}'
                    check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  rotation_order  smallint not null default 0,
  notes           text,
  archived        boolean not null default false,
  unique (id, user_id)
);
create index gym_routines_user_idx on public.gym_routines (user_id, rotation_order);

create table public.gym_routine_exercises (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id           uuid not null,
  position             smallint not null default 0,
  exercise_id          text not null check (length(exercise_id) between 1 and 200),
  target_sets          smallint not null default 3  check (target_sets between 1 and 20),
  rep_min              smallint not null default 8  check (rep_min between 1 and 100),
  rep_max              smallint not null default 12 check (rep_max between 1 and 100),
  start_weight_kg      numeric(6,2) check (start_weight_kg >= 0),
  increment_kg         numeric(5,2) not null default 2.5 check (increment_kg > 0),
  progression          text not null default 'double' check (progression in ('linear', 'double')),
  rest_seconds         smallint check (rest_seconds between 0 and 900),   -- null → settings default
  notes                text,
  unique (id, user_id),
  check (rep_max >= rep_min),
  foreign key (routine_id, user_id) references public.gym_routines (id, user_id) on delete cascade
);
create index gym_routine_exercises_routine_idx on public.gym_routine_exercises (routine_id, position);
create index gym_routine_exercises_user_idx    on public.gym_routine_exercises (user_id);

-- ── Sessions ────────────────────────────────────────────────────────────────
-- HR summary is computed client-side at session end from heart_rate_intraday for
-- [started_at, ended_at]. heart_rate_intraday only keeps 48 h, so sessions finished
-- later than that keep NULL HR columns.
create table public.gym_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  routine_id       uuid,                    -- null = free session (extras only)
  routine_name     text,                    -- snapshot, survives routine rename/delete
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,             -- null = in progress
  notes            text,
  hr_avg           smallint,
  hr_max           smallint,
  hr_zone1_min     numeric(5,1),            -- 50–60 % HRmax
  hr_zone2_min     numeric(5,1),            -- 60–70 %
  hr_zone3_min     numeric(5,1),            -- 70–80 %
  hr_zone4_min     numeric(5,1),            -- 80–90 %
  hr_zone5_min     numeric(5,1),            -- 90–100 %
  hr_max_ref       smallint,                -- HRmax the zones were computed with
  hr_sample_count  integer,
  hr_computed_at   timestamptz,
  unique (id, user_id),
  check (ended_at is null or ended_at >= started_at),
  foreign key (routine_id, user_id) references public.gym_routines (id, user_id)
    on delete set null (routine_id)
);
create index gym_sessions_user_started_idx on public.gym_sessions (user_id, started_at desc);
create index gym_sessions_open_idx         on public.gym_sessions (user_id) where ended_at is null;

-- ── Logged sets ─────────────────────────────────────────────────────────────
create table public.gym_sets (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at                timestamptz not null default now(),   -- when the set was logged
  session_id                uuid not null,
  exercise_id               text not null check (length(exercise_id) between 1 and 200),
  set_number                smallint not null check (set_number between 1 and 50),
  weight_kg                 numeric(6,2) not null default 0 check (weight_kg >= 0),
  reps                      smallint not null check (reps between 0 and 500),
  routine_exercise_id       uuid,          -- planned slot this set filled (null for extras)
  swapped_from_exercise_id  text,          -- planned exercise if this one was a swap
  is_adhoc                  boolean not null default false,       -- extra, not in the routine
  foreign key (session_id, user_id) references public.gym_sessions (id, user_id) on delete cascade,
  foreign key (routine_exercise_id, user_id) references public.gym_routine_exercises (id, user_id)
    on delete set null (routine_exercise_id)
);
create index gym_sets_session_idx       on public.gym_sets (session_id, created_at);
create index gym_sets_user_exercise_idx on public.gym_sets (user_id, exercise_id, created_at desc);
create index gym_sets_routine_ex_idx    on public.gym_sets (routine_exercise_id) where routine_exercise_id is not null;

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.gym_settings           enable row level security;
alter table public.gym_custom_exercises   enable row level security;
alter table public.gym_routines           enable row level security;
alter table public.gym_routine_exercises  enable row level security;
alter table public.gym_sessions           enable row level security;
alter table public.gym_sets               enable row level security;

create policy "gym_settings: own rows"          on public.gym_settings          for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gym_custom_exercises: own rows"  on public.gym_custom_exercises  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gym_routines: own rows"          on public.gym_routines          for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gym_routine_exercises: own rows" on public.gym_routine_exercises for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gym_sessions: own rows"          on public.gym_sessions          for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "gym_sets: own rows"              on public.gym_sets              for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Grants (README gotcha: new tables are not readable by `authenticated` otherwise) ──
-- All PKs are uuid (gen_random_uuid), so there are no sequences to grant.
grant select, insert, update, delete on public.gym_settings          to authenticated;
grant select, insert, update, delete on public.gym_custom_exercises  to authenticated;
grant select, insert, update, delete on public.gym_routines          to authenticated;
grant select, insert, update, delete on public.gym_routine_exercises to authenticated;
grant select, insert, update, delete on public.gym_sessions          to authenticated;
grant select, insert, update, delete on public.gym_sets              to authenticated;
