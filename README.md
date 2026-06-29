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

## Testing

Run the unit test suite:

```bash
npm test
```

Tests live in `__tests__/`.

## Notes

This repository contains the client and vendor mobile app only.

Internal admin operations are handled by a separate admin portal.
