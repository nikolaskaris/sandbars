# Supabase Setup

## Database Setup

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the SQL script from `schema.sql`

## Authentication Setup

1. In your Supabase dashboard, go to Authentication > Providers
2. Enable Email authentication
3. Configure the site URL to match your deployment URL
4. Add `http://localhost:3000/**` to the redirect URLs for local development

## Environment Variables

After creating your Supabase project, you'll need:
- `NEXT_PUBLIC_SUPABASE_URL`: Your project URL (found in Settings > API)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your anonymous/public key (found in Settings > API)

## Row Level Security

The schema includes RLS policies that ensure:
- Users can only view, create, update, and delete their own favorite locations
- All operations are automatically scoped to the authenticated user
