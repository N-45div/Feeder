-- Feeder: everything the app reads at request time, so visitors never wait on (or spend) bulk API calls.

create table if not exists universities (
  unitid integer primary key,
  name text not null,
  qloo_entity_id text not null,
  qloo_name text not null,
  city text not null,
  state text not null,
  state_fips integer not null,
  lat double precision not null,
  lon double precision not null,
  control text,
  website text,
  first_time_2022 integer not null,
  home_2022 integer not null,
  out_share_2022 double precision not null,
  -- In the pre-registered test set (strict name match, not one of the ten pilot universities).
  in_test boolean not null
);

-- The state board: Fall 2022 freshmen, what geography predicts, Qloo pull and the recruiting group (src/lib/score/board.ts).
create table if not exists state_board (
  unitid integer not null references universities(unitid) on delete cascade,
  state text not null,
  fips integer not null,
  freshmen integer not null,
  expected integer not null,
  pull double precision not null,
  grp text not null,
  gap integer not null,
  primary key (unitid, state)
);

create table if not exists metros (
  cbsa text primary key,
  name text not null,
  city text not null,
  states text[] not null,
  pop2025 integer not null,
  lat double precision not null,
  lon double precision not null
);

-- Pull around each metro from the same heatmap (src/lib/score/metros.ts).
create table if not exists metro_pull (
  unitid integer not null references universities(unitid) on delete cascade,
  cbsa text not null references metros(cbsa) on delete cascade,
  pull double precision not null,
  cells integer not null,
  distance_km integer not null,
  primary key (unitid, cbsa)
);

-- A metro brief, fetched from Qloo on first view and kept: high schools, nearby colleges and what resonates.
create table if not exists metro_briefs (
  unitid integer not null references universities(unitid) on delete cascade,
  cbsa text not null references metros(cbsa) on delete cascade,
  fetched_at timestamptz not null default now(),
  high_schools jsonb not null,
  colleges jsonb not null,
  hooks jsonb not null,
  primary key (unitid, cbsa)
);

-- Daily request counts for the public demo's limits. Keys hold hashed addresses only.
create table if not exists usage_counts (
  key text not null,
  day date not null,
  count integer not null default 0,
  primary key (key, day)
);

-- The audience map: each university's heatmap cells with affinity of 0.5 or more, already projected onto the app's map
-- (src/lib/geo/project.ts) as [x, y, affinity]. Derived from Qloo output, so kept in the database, never in git.
create table if not exists audience_cells (
  unitid integer primary key references universities(unitid) on delete cascade,
  cells jsonb not null
);

-- Upcoming college fairs near a metro, from Google Events through SerpApi (src/lib/brief/events.ts). Shared by every university.
create table if not exists metro_events (
  cbsa text primary key references metros(cbsa) on delete cascade,
  fetched_at timestamptz not null default now(),
  events jsonb not null
);
