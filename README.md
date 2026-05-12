# AutoServe Expo App

AutoServe is a dual-role mobile marketplace built with Expo Router, React Native, and Supabase. This app includes a guest-first client experience plus a vendor operations experience for automotive service providers.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a local env file from `.env.example` and provide your Supabase credentials.

3. Start the app:

```bash
npm run ios
# or
npm run android
```

## Notes

- If Supabase env vars are missing, the app falls back to persisted local demo data so the flows remain usable.
- Google auth is wired through Supabase OAuth and Expo Auth Session. Add your Google client IDs and Supabase redirect settings before testing production auth.
- Schema and seed SQL are in [`supabase/schema.sql`](/Users/sandeepsuri/Documents/Vibez/autoserve-app/supabase/schema.sql) and [`supabase/seed.sql`](/Users/sandeepsuri/Documents/Vibez/autoserve-app/supabase/seed.sql).
