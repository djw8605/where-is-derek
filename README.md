# Where is Derek? 🧭

A public service for the chronically curious: the rough whereabouts of one (1)
Derek, reported with the gravity of a wildlife tracking program.

When Derek is traveling, the map highlights where he is (a whole state counts —
this is a *rough* whereabouts operation). When he isn't, the station reports
him **at rest in his native habitat: Nebraska**.

## Updating the schedule

All travel lives in [`data/schedule.json`](data/schedule.json). Add a trip,
commit, deploy. That's the whole workflow.

```json
{
  "start": "2026-07-19",
  "end": "2026-07-24",
  "location": "Minneapolis, Minnesota",
  "event": "PEARC26 Conference",
  "type": "work"
}
```

- `start` / `end` — inclusive dates, `YYYY-MM-DD`. Whichever trip contains
  today's date (in the viewer's timezone) wins.
- `location` — free text. Rough is fine: `"South Dakota"` zooms to the whole
  state; `"Minneapolis, Minnesota"` zooms to the city. It's geocoded in the
  browser via Mapbox, so anything Mapbox can find works.
- `event` — optional. `"PEARC26 Conference"`, `"Vacation"`, whatever.
- `type` — `"work"` or `"vacation"`. Controls the badge and marker color
  (vacation gets the *do not disturb* treatment).

No trip covering today? The station defaults to **Home** in Nebraska.

## Running locally

```bash
npm install
cp .env.example .env.local   # then paste your Mapbox pk.* token into it
npm run dev
```

Open http://localhost:3000. `.env.local` is gitignored, so your token never
gets committed.

## Deploying

The site is a fully static export (`output: "export"`), so both options below
serve the same build.

### Vercel (easiest)

Push the repo to GitHub, then import it at [vercel.com/new](https://vercel.com/new).
Vercel auto-detects Next.js. Add one environment variable in the project
settings — `NEXT_PUBLIC_MAPBOX_TOKEN` = your `pk.*` token — and deploy. Every
push to `main` redeploys, so updating your location is just editing
`schedule.json` and pushing.

### GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`. Enable it once:

1. **Settings → Secrets and variables → Actions → New repository secret**,
   named `MAPBOX_TOKEN`, value = your `pk.*` token.
2. **Settings → Pages → Source: GitHub Actions**
3. Push to `main`

The workflow builds with `NEXT_PUBLIC_BASE_PATH=/where-is-derek` so assets
resolve under the project path, and injects the token from the secret. If your
repo has a different name, change that value in the workflow (or delete it
entirely if deploying to a `username.github.io` root site).

## Mapbox token

The token is a Mapbox **public** token (`pk.*`), which is bundled into the
client JS at build time — that's how Mapbox maps work, and it's expected. It's
supplied via the `NEXT_PUBLIC_MAPBOX_TOKEN` env var (see above) rather than
committed to source.

Because the token is visible in the browser by design, the real protection is a
**URL restriction**: in [account.mapbox.com](https://account.mapbox.com/access-tokens/),
edit the token and add your production domain (e.g. `derekweitzel.com`) under
"URL restrictions" so it can't be reused on other sites.

---

*Sightings accurate to within one (1) state. Derek is not, legally speaking, tagged.*
