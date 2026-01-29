# Sandbars

Surf forecasting app combining marine weather APIs with local knowledge via AI.

## Stack
- Next.js 14 (App Router)
- Supabase (auth, postgres, edge functions)
- TypeScript throughout

## Commands
- `npm run dev`: Start dev server
- `npm run build`: Production build
- `npm run lint`: ESLint
- `supabase start`: Local Supabase
- `supabase db push`: Push migrations

## Architecture
- `app/`: Next.js routes and layouts
- `components/`: React components
- `lib/`: Utilities, API clients, Supabase client
- `supabase/`: Migrations and edge functions

## Domain terms
- Spot: A surf break location defined by a latitude/longitude coordinate.
- Forecast window: 14-day prediction period
- Swell: Wave energy from distant storms (period, height, direction)
- Wind: Wind energy (speed, direction)

## APIs
## - NOAA NDBC: Buoy data
## - Open-Meteo: Weather forecasts
## - Surfline (if integrated): Proprietary forecasts

## Conventions
## - Prefer server components; use 'use client' only when needed
- Colocate tests with source files
- Supabase RLS policies for all tables