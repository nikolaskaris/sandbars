# Sandbars

Customizable surf forecasting for your favorite spots

## Features

- **User Authentication**: Secure login and signup with Supabase Auth
- **Interactive Map**: Explore locations and select surf spots using Mapbox
- **Favorite Locations**: Save and manage your favorite surf spots
- **Surf Forecasts**: Get detailed surf forecasts powered by NOAA (free)
  - Wave height and period from NDBC buoys
  - Wind speed and direction from NWS forecasts
  - Water temperature
  - 72-hour forecast view
  - No API key required!

## Tech Stack

- **Frontend**: Next.js 15 with App Router, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Mapping**: Mapbox GL JS
- **Weather Data**: NOAA (NDBC buoys + NWS forecasts) - Free!
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Accounts for:
  - [Supabase](https://supabase.com)
  - [Mapbox](https://www.mapbox.com)
  - No weather API key needed (uses free NOAA data)

### 1. Clone the Repository

```bash
git clone https://github.com/nikolaskaris/sandbars.git
cd sandbars
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to the SQL Editor and run the schema from `supabase/schema.sql`
3. Configure authentication:
   - Navigate to Authentication > Providers
   - Enable Email authentication
   - Add `http://localhost:3000/**` to the redirect URLs

### 4. Get API Keys

#### Supabase
- Go to Settings > API in your Supabase dashboard
- Copy your `URL` and `anon/public` key

#### Mapbox
- Create an account at [mapbox.com](https://account.mapbox.com)
- Generate a new access token from your [account page](https://account.mapbox.com/access-tokens/)

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Note: Surf forecasts use free NOAA APIs (no key required)
```

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Configure environment variables in Vercel project settings
4. Deploy!

Don't forget to update the `NEXT_PUBLIC_APP_URL` in your environment variables to match your production URL.

### Update Supabase Redirect URLs

After deployment, add your production URL to Supabase:
- Go to Authentication > URL Configuration
- Add `https://your-domain.vercel.app/**` to the redirect URLs

## Project Structure

```
sandbars/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   │   ├── favorites/        # Favorites CRUD endpoints
│   │   └── forecast/         # Surf forecast endpoint
│   ├── auth/                 # Authentication pages
│   ├── dashboard/            # Main dashboard page
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page (redirects)
│   └── globals.css           # Global styles
├── components/               # React components
│   ├── auth/                 # Login/Signup forms
│   ├── favorites/            # Favorites list and forecast card
│   ├── map/                  # Map view and modal
│   └── ui/                   # UI components (Header, etc.)
├── lib/                      # Utility libraries
│   ├── supabase/             # Supabase client configs
│   ├── database.types.ts     # Database types
│   └── noaa.ts               # NOAA API integration (buoys + NWS)
├── types/                    # TypeScript type definitions
├── supabase/                 # Supabase schema and docs
└── public/                   # Static assets
```

## Usage

1. **Sign Up/Login**: Create an account or log in at `/auth`
2. **Add Locations**: Click anywhere on the map to add a favorite surf spot
3. **View Forecasts**: Click on a saved location to see the surf forecast
4. **Manage Favorites**: Delete locations using the trash icon

## Database Schema

The app uses a single `favorite_locations` table with Row Level Security (RLS) enabled:

```sql
CREATE TABLE favorite_locations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name VARCHAR(255),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_at TIMESTAMP
);
```

RLS policies ensure users can only access their own locations.

## API Routes

- `GET /api/favorites` - Get user's favorite locations
- `POST /api/favorites` - Create a new favorite location
- `DELETE /api/favorites/[id]` - Delete a favorite location
- `GET /api/forecast?lat=X&lng=Y` - Get surf forecast for coordinates

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- Weather data provided by [NOAA](https://www.noaa.gov/) (NDBC buoys & NWS forecasts)
- Maps powered by [Mapbox](https://www.mapbox.com)
- Backend infrastructure by [Supabase](https://supabase.com)
- Deployed on [Vercel](https://vercel.com)