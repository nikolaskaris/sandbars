# Sandbars - Claude Instructions

## Project Overview

Sandbars is a surf forecasting web app built with Next.js 15, MapLibre, and Supabase.
- **Frontend:** Next.js + React + TypeScript
- **Map:** MapLibre GL JS
- **Data:** WaveWatch III forecasts (NOAA), NDBC buoy observations
- **Storage:** Supabase Storage (GeoJSON files)
- **CI/CD:** GitHub Actions

## Common Commands

```bash
# Development
npm run dev              # Start dev server (Turbopack)
npm run dev:clean        # Clean .next cache + start dev server
npm run build            # Production build

# Testing
npx playwright test      # Run all tests
npx playwright test --headed  # Run with visible browser
npx tsc --noEmit         # Type check without building

# Cache issues (if dev server errors)
rm -rf .next node_modules/.cache
npm run dev
```

## Git Workflow

**IMPORTANT:** Do not run git push — it often stalls waiting for auth.

When asked to commit/push:
1. Stage and commit the changes
2. Show the user the commit command that was run
3. Tell the user to run `git push origin main` themselves
4. Do NOT attempt git push

```bash
# Correct workflow:
git add -A
git status  # Show what's staged
git commit -m "descriptive message"
# STOP HERE - tell user to push manually
```

**Commit message format:**
- Use present tense ("Add feature" not "Added feature")
- Be specific ("Fix time slider now label" not "Fix bug")
- Reference component/area ("Update WaveMap zoom behavior")

## Project Structure

```
sandbars/
├── app/                    # Next.js app router
│   └── page.tsx           # Main app entry, view state management
├── components/
│   ├── WaveMap.tsx        # Main map component
│   ├── TimeSlider.tsx     # Forecast time control
│   ├── SpotPanel.tsx      # 16-day forecast sidebar
│   ├── SearchBar.tsx      # Location search
│   ├── NavBar.tsx         # Navigation tabs
│   ├── LayerToggle.tsx    # Wave/Wind/Period toggle
│   ├── VectorOverlay.tsx  # Wind/swell direction arrows
│   └── FavoritesPage.tsx  # Saved locations
├── lib/
│   ├── wave-utils.ts      # FORECAST_HOURS, types, utilities
│   ├── favorites.ts       # localStorage favorites
│   └── config.ts          # Supabase URLs, constants
├── scripts/
│   ├── download-grib-files.sh    # Fetch NOAA data
│   ├── convert-grib-to-geojson.py # GRIB → GeoJSON
│   └── upload-to-supabase.js     # Upload to storage
├── tests/
│   └── smoke.spec.ts      # Playwright E2E tests
├── .github/workflows/
│   ├── playwright.yml     # Test on push
│   └── update-forecasts.yml # Data pipeline cron
└── CLAUDE.md              # This file
```

## Key Files to Know

| File | Purpose |
|------|---------|
| `lib/wave-utils.ts` | FORECAST_HOURS array, shared types |
| `lib/config.ts` | Supabase URL, storage paths |
| `components/WaveMap.tsx` | Core map logic, data fetching |
| `app/page.tsx` | App state, view switching, callbacks |

## Data Pipeline

- **Schedule:** Runs 4h after NOAA model runs (4:00, 10:00, 16:00, 22:00 UTC)
- **Forecast hours:** 105 files (3-hourly f000-f240, 6-hourly f246-f384)
- **Storage:** Supabase bucket `forecasts/wave-data-f{XXX}.geojson`

**To manually trigger:**
GitHub → Actions → Update Forecast Data → Run workflow

## Planning Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Phase 1 Testing | `/home/claude/PHASE_1_TESTING_PLAN.md` | Manual test checklist |
| Phase 2 Planning | `/home/claude/PHASE_2_PLANNING.md` | Tasks, bugs, priorities |

When bugs are found during testing, add them to Phase 2 Planning under "Phase 1 Bugs & Issues".

## Generating Prompts

When the user asks for a "prompt" for a task, format it as:

```
TASK: [One-line description]

PROBLEM/CONTEXT:
[Why this is needed]

IMPLEMENTATION:

STEP 1: [Action]
[Code or instructions]

STEP 2: [Action]
[Code or instructions]

VERIFY:
1. [How to test it worked]
2. [Expected outcome]

COMMIT:
git add [files]
git commit -m "[message]"
# Tell user to push manually
```

## Common Issues & Fixes

**Next.js cache corruption:**
```bash
rm -rf .next node_modules/.cache
npm run dev
```

**Playwright WebGL tests fail:**
These require headed mode. Skip in CI, run locally with `--headed`.

**GitHub Actions push rejected (workflow scope):**
User needs to update their token with `workflow` scope at github.com/settings/tokens

**"Cannot find module" errors:**
Usually means a package isn't installed or files were deleted.
```bash
rm -rf node_modules package-lock.json
npm install
```

## Style Guidelines

- Use TypeScript strict mode
- Prefer functional components with hooks
- Use `data-testid` attributes for test selectors
- Keep components focused — extract to new files when >200 lines
- Use lib/wave-utils.ts for shared types and constants
