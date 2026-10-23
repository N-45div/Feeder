# Feeder

A recruiting desk for university enrollment teams. Feeder shows where young people who lean toward a university live, compares that with where its freshmen actually come from, and turns the gap into recruiter travel: which states to work harder, which metros to send people to, and which high schools to visit when they get there, including the ones recruiters usually skip.

For each of 142 four-year universities that draw at least a fifth of their freshmen from out of state, Feeder gives:

- **A state board.** For every state outside the home state: the Fall 2022 first-time freshmen the university drew, what population and distance alone predict, and its pull among people aged 24 and younger in [Qloo](https://qloo.com)'s taste graph. States fall into four groups. *Untapped* states lean the university's way but send fewer freshmen than geography predicts. *Strongholds* lean its way and deliver. *Enrolls without pull* states send students for reasons other than taste, and *Quiet* states do neither.
- **An audience map.** Qloo's national heatmap of young people who lean toward the university, with the campus and the top recruiting metros pinned.
- **A road trip.** The metros of 500,000+ people outside the home state where that pull is strongest. Each opens a metro brief: high schools to visit, rival colleges nearby, and the music and TV young people there like.
- **A visit day.** The top high schools on a street map in driving order, plus an *access stop*: the nearest large public school where many students come from low-income families. One link opens the whole route in Google Maps, and upcoming college fairs in that city are listed beside it.
- **An agent.** "Ask Feeder" answers with the desk's own tools. It plans multi-week recruiter trips, and it can ask Qloo live where young people who like a particular brand, show, film, artist or game lean the university's way. The same tools work inside Claude as an MCP connector.

**Live app:** https://library-blond-delta.vercel.app (free, no sign-in)
**MCP endpoint:** `https://library-blond-delta.vercel.app/api/mcp` (in Claude: Settings → Connectors → add a custom connector)

![The University of Oregon desk: the state board with Idaho flagged as untapped](docs/screenshots/desk.png)

## How it uses Qloo

1. **The university in Qloo.** `/search` with `types=urn:entity:brand`. A match counts only when the entity's name equals the federal (IPEDS) name or one of its listed aliases, ignoring case, a leading "The", punctuation and a campus label. "Ohio State University" resolving to "Ohio State Football" is dropped.
2. **A national heatmap of young people per university.** `/v2/insights` with `filter.type=urn:heatmap`, `signal.interests.entities` set to the university, `signal.demographics.age=24_and_younger` and `filter.location.query=United States`. Each cell carries an affinity and a popularity.
   - **State pull** is the popularity-weighted mean affinity of the cells inside a state (`src/lib/score/pull.ts`).
   - **Metro pull** is the same over cells within 60 km of a metro (`src/lib/score/metros.ts`).
   - **The audience map** draws the top quarter of cells on an Albers projection with Alaska and Hawaii insets.
   - Students are about 18, so the board uses the young audience. The pre-registered test below found it tracks enrollment better than everyone who leans toward the university (alumni and sports fans included).
3. **Metro briefs, fetched once and kept.** Within 40 km of the metro, with the university as the interest signal:
   - `filter.type=urn:entity:place` returns the places people who lean toward the university favour, sorted by name into high schools and colleges (`src/lib/brief/classify.ts`). Place queries stay all-ages: with an age signal, Qloo returns no schools.
   - `urn:entity:artist` and `urn:entity:tv_show` with the 24-and-younger signal give the music and TV young people there like, for outreach and event themes.
4. **Live questions from the agent.** `audience_hotspots` resolves an interest the agent picks (for example Patagonia for "students who love the outdoors") with `/search`. It then asks for one heatmap with the university and that interest together as the signal, and ranks metros by it. For the University of Oregon, adding Patagonia lifts Reno from 22nd to 2nd. Answers are kept, so a repeat question costs nothing (`src/lib/agent/hotspots.ts`).

## The visit day

The day starts at the top-ranked high school and goes to the nearest one next, five stops in all (`src/lib/brief/route.ts`).

One of the five is an access stop: the large public school nearest the route where many students come from low-income families. Research on public universities' out-of-state recruiting (Ozan Jaquette and colleagues) found their visits concentrate on affluent schools, many of them private. Qloo's rankings follow the existing audience, so the day makes room for one such school on purpose.

The access stop comes from the federal Common Core of Data (NCES), through the Urban Institute's Education Data API. A school qualifies if it runs a schoolwide Title I programme. In a state that reports no Title I status (California), it qualifies if at least 40% of its students are eligible for free or reduced-price lunch, the same threshold Title I uses. The page labels which basis applied.

Legs are straight-line kilometres. The "Open the day in Google Maps" link hands Google the whole route, which gives real drive times without a paid directions call. The map is MapLibre GL with OpenFreeMap vector tiles.

College fairs come from Google Events through [SerpApi](https://serpapi.com): one search per metro ("college fair" and the city), shared by every university and kept for three weeks.
- **Kept:** admissions events, such as college fairs and expos, college nights, NACAC fairs, discovery days, HBCU fairs, and financial-aid and FAFSA nights.
- **Dropped:** study-abroad, camp and job fairs, galas and conferences. Past dates drop off on their own.
- **Budget:** searches run under a monthly cap. When it's spent, the brief says so, and metros already searched keep their fairs.

## The agent and MCP

"Ask Feeder" runs on the AI SDK (`streamText`) with Claude Haiku 5.5 through the Vercel AI Gateway. The model chooses the tool calls and writes the answer; every state, metro, school and number comes from a tool:

| Tool | What it does |
|---|---|
| `find_universities` | Find a university by name, city or state |
| `state_board` | Young-audience pull against enrollment for every state, grouped as above |
| `recruiter_metros` | The strongest-pull metros of 500,000+ people outside the home state |
| `metro_brief` | High schools, rival colleges, what young people like there, the visit day with its access stop, and nearby college fairs |
| `audience_hotspots` | Asks Qloo live where young people who lean toward the university and like a given brand, show, film, artist or game live |
| `plan_trips` | Recruiter travel: the strongest metros split west to east across recruiters, then into weeks of nearby stops |
| `get_evidence` | The test results below and their limits |

Trip planning is deterministic: no model decides where anyone goes. Stops in one week stay within 1,200 km of each other. When the weeks can't hold every metro, the weakest stop is dropped and the weeks are regrouped. The same registry is served at `/api/mcp` over streamable HTTP (stateless, no sign-in). The public demo has daily limits on the agent, on new briefs and on live Qloo questions.

## Evidence

The test was written down and committed before it ran ([docs/eval-plan.md](docs/eval-plan.md)). Two amendments were each committed before their own data was fetched. Ground truth is federal enrollment data: IPEDS first-time freshmen by state of residence, Fall 2022, with Fall 2020 as a replication. 124 universities were fixed by rule before any Qloo call on them, and 109 had enough heatmap coverage to score.

Each state score was compared with **gravity**, which is what the state's population and its distance from campus alone predict. Two other arms ran beside Qloo:
- **The assistant arm:** Claude Haiku 5.5 ranked the states from the university's name alone, with no tools or data.
- **The placebo arm:** another university's Qloo scores.

**Does Qloo pull explain what geography misses?** Partial Spearman with the gravity residual, mean over universities, 95% bootstrap intervals:

| Score | Fall 2022 | Fall 2020 |
|---|---|---|
| **Qloo pull, 24 and younger** (amendment 2) | **+0.41** (0.36 to 0.45) | **+0.41** (0.36 to 0.45) |
| Qloo pull, all ages | +0.32 (0.27 to 0.36) | +0.32 (0.27 to 0.37) |
| AI assistant alone | +0.28 (0.25 to 0.31) | +0.27 (0.24 to 0.30) |
| Placebo: another university's young pull | +0.14 (0.09 to 0.20) | +0.15 (0.10 to 0.21) |
| Placebo: another university's all-ages pull | +0.00 (−0.06 to 0.07) | +0.02 (−0.04 to 0.08) |

**Predicting every state, out of sample** (leave one university out, Spearman of predicted against actual):

| Model | Fall 2022 | Fall 2020 |
|---|---|---|
| Population and distance | 0.74 | 0.73 |
| … plus Qloo young pull | 0.78 | 0.77 |
| … plus the assistant | 0.85 | 0.84 |
| … plus both | 0.85 | 0.84 |

What this means:

- **Young-audience pull beats the AI assistant** at explaining what geography misses: +0.13 in 2022 (interval 0.08 to 0.18) and +0.14 in 2020. What young people actually like explains more of where freshmen come from than what an assistant remembers.
- **It beats the all-ages pull** by +0.09 (0.05 to 0.12) in both years. The rule written in advance said the board would switch to it if so, and it has.
- **A caution:** another university's young pull also scores +0.14, so part of the gain is where young people are in general. A university's own young pull still beats that placebo by +0.26 (0.20 to 0.33).
- **For ranking every state outright, the assistant is still better,** and Qloo adds nothing on top of it. So the board shows pull next to real enrollment for a team to read both. It doesn't claim Qloo wins the ranking.

**What this does not establish:**
- Qloo's data is from 2026 and the enrollment data from 2020 and 2022, so this measures alignment, not a forecast.
- Where students come from also reflects past recruiting, alumni, athletics and price, and the test can't separate taste from those.
- Metros, high schools, rival colleges, what resonates and the live interest questions are untested, because federal data has nothing below the state.
- Only first-time freshmen are counted, and Qloo's "24 and younger" is wider than freshmen.

This repository first held another product, Shelf Desk, which picked teen books for students' interests from Qloo's book graph. Its pre-registered test on library checkouts failed: the picks did no better than random. The record is kept in [docs/retired](docs/retired/README.md).

![A visit day in the San Francisco brief: four Qloo-ranked high schools and an access stop, with the college fairs nearby](docs/screenshots/visit-day.png)

## Architecture

- **App:** Next.js 16 (App Router) on Vercel, Tailwind CSS v4, Postgres on Neon, MapLibre GL for the street map.
- **Precomputed data:** state boards, metro pull, the audience map and the public-school list are built ahead of time and loaded into Postgres. Metro briefs and the agent's live questions go to Qloo on first ask and are kept, so later visitors read them from the database. Raw Qloo output stays out of the repository (`data/cache` and `data/raw` are ignored); the public-domain inputs and the evaluation's aggregate results are committed.
- **Tests:** `npm test` runs the Vitest suite (Qloo client and parameters, state pull, metro pull, the board, the brief classifier, the map projection, visit-day routing and access stops, the fair filter and trip planning).

## Run it locally

```bash
npm install
cp .env.example .env.local    # then fill in the values it lists
psql "$DATABASE_URL" -f db/schema.sql

# Build the data: federal and census sources, then Qloo
node scripts/build-data.mjs
node scripts/resolve.mjs
node scripts/resolve-more.mjs
node scripts/heatmaps.mjs && node scripts/heatmaps.mjs --young
npx tsx scripts/score-states.mts && npx tsx scripts/score-states.mts --young
node scripts/state-paths.mjs
npx tsx scripts/load-db.mts
npx tsx scripts/load-cells.mts
node scripts/public-schools.mjs && npx tsx scripts/load-schools.mts

npm run dev
```

To rerun the evaluation: `node analysis/assistant-arm.mjs`, then `python analysis/eval.py`.

## Data and credits

- Taste data: [Qloo](https://qloo.com) Insights API.
- Enrollment and institutions: IPEDS, National Center for Education Statistics (public domain).
- Public high schools: the Common Core of Data, National Center for Education Statistics (public domain), through the Urban Institute's Education Data API.
- Population and places: US Census Bureau (2020 census centres of population, 2023 Gazetteer, 2025 metro estimates).
- State shapes: Natural Earth (public domain).
- Street map: OpenFreeMap tiles from OpenMapTiles and OpenStreetMap contributors.
- College fairs: Google Events results through SerpApi.

Feeder is not affiliated with any university.

Built in coordination with an AI coding assistant, Claude Code.

## License

MIT, see [LICENSE](LICENSE).
