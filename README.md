# AutoServe App

AutoServe is a mobile app for automotive service discovery, booking, and vendor operations.

The app is built with Expo, React Native, Expo Router, and Supabase.

## Features

- Client booking flow
- Vehicle garage management
- Vendor onboarding
- Vendor service and booking management
- Supabase-backed authentication and data

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file from the private project configuration:

```bash
cp .env.example .env
```

Start the Expo development server:

```bash
npx expo start
```

## Environment

This app expects public Expo environment variables for Supabase and API access.

Do not commit secrets, service-role keys, or production credentials to this repository.

## Scripts

```bash
npm test
npm run ios
npm run android
npm run web
```

Preview and production builds are managed through Expo/EAS using private project configuration.

Set `EXPO_PUBLIC_API_BASE_URL` to the deployed backend URL in both the `preview`
and `production` EAS environments before building. It must be an absolute HTTP(S)
URL, for example `https://api.example.com`. Release builds reject missing URLs
and localhost/loopback addresses. The backend must expose
`/api/v1/vehicle-selection/makes`, `/models?make=…`, and `/years?make=…&model=…`,
returning `{ "items": [{ "label": "…", "path": "…" }] }`.
Rebuild after changing this public variable because Expo embeds it in the bundle.
Local development defaults to `http://localhost:3000`; use your computer's LAN
address when testing on a physical device.

## Testing

Run the unit test suite:

```bash
npm test
```

Tests live in `__tests__/`.

## Notes

This repository contains the client and vendor mobile app only.

Internal admin operations are handled by a separate admin portal.

### Bookable booking types (issue #21)

Before testing this app build, apply
`supabase/migrations/20261105000000_bookable_booking_types.sql` after the existing
public vendor view, booking security, and guest booking migrations. It adds current
booking types to discovery and enforces them for slot lookup and booking creation.
Stored booking values remain `shop` and `mobile`.

Run `supabase/tests/bookable_booking_types.sql` as postgres in a disposable test
Supabase database after applying the migration. It covers discovery, slots, client
and guest creation, and stale rejection for fixed, mobile, hybrid, and neither
configurations; all fixtures roll back.
