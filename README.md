# AutoServe

AutoServe is a dual-role mobile marketplace built with Expo Router, React Native, and Supabase. It includes a guest-first client experience for discovering and booking automotive services, plus a vendor operations experience for service providers.

- **Bundle ID / Package**: `com.vibez.autoserve`
- **App scheme**: `autoserve://`
- **EAS project**: `a0bb91f4-a7a8-47b6-8540-d07e96bf9a86`

---

## Prerequisites

- Node 20+
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli` (for cloud builds)
- Xcode 16+ (iOS native builds)
- Android Studio (Android native builds)
- Apple Developer Program membership (TestFlight and ad hoc builds)
- Firebase project with App Distribution enabled (tester builds)
- Supabase project with schema applied (see [Supabase Setup](#supabase-setup))

---

## Getting Started

```bash
npm install
cp .env.example .env   # fill in your Supabase credentials
npx expo start
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (`https://xxx.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL |
| `EXPO_PUBLIC_ENABLE_DEMO_DATA` | Set `true` to show local demo vendors when Supabase is not configured |

For EAS cloud builds, configure these in the EAS dashboard under environment variables for each profile.

---

## Local Development

```bash
# Start Metro bundler (Expo Go)
npx expo start

# Native iOS build (requires Xcode + matching simulator runtime)
npx expo run:ios

# Native Android build
npx expo run:android
```

> Google OAuth requires a native build — it will not work in Expo Go.

---

## Builds

### Preview — Firebase Tester Builds

Standalone APK/IPA builds distributed internally via Firebase App Distribution. Not Expo development clients.

```bash
npm run build:android:preview   # Android APK
npm run build:ios:preview       # iOS IPA (ad hoc — requires registered device UDIDs)
npm run build:preview           # Both platforms
```

After the EAS build completes, upload the artifact to Firebase App Distribution:

1. Open [Firebase Console](https://console.firebase.google.com) → your project → **App Distribution**.
2. Select the Android or iOS app.
3. Upload the `.apk` or `.ipa`.
4. Select a tester group and add release notes.

Or via Firebase CLI:

```bash
firebase appdistribution:distribute <artifact.apk> \
  --app <firebase_android_app_id> \
  --groups <tester_group>

firebase appdistribution:distribute <artifact.ipa> \
  --app <firebase_ios_app_id> \
  --groups <tester_group>
```

See [`docs/builds/firebase-tester-builds.md`](docs/builds/firebase-tester-builds.md) for the full pre-release checklist and required Supabase migration order.

---

### TestFlight Builds

TestFlight uses the `production` EAS profile, which produces an App Store-signed IPA.

```bash
# 1. Build
npx eas-cli build --profile production --platform ios

# 2. Submit to App Store Connect
npx eas-cli submit --profile production --platform ios
```

Then in [App Store Connect](https://appstoreconnect.apple.com):

1. Navigate to your app → **TestFlight**.
2. The build appears after processing (typically 5–15 min).
3. Add internal testers (instant) or external testers (requires Apple review on first submission).

---

### Production Builds

```bash
# Build both platforms
npx eas-cli build --profile production --platform all

# Submit to stores
npx eas-cli submit --profile production --platform ios
npx eas-cli submit --profile production --platform android
```

Ensure store listings, screenshots, and privacy policy URLs are complete in App Store Connect and Google Play Console before submitting.

---

## Supabase Setup

Apply `supabase_setup.sql` to your Supabase project via the SQL Editor, or apply individual migration files in this order:

1. `auto_create_profile.sql`
2. `add_booking_missing_columns.sql`
3. `bookings_multi_service.sql`
4. `add_vehicle_garage_fields.sql`
5. `add_vendor_onboarding_drafts.sql`
6. `add_vendor_bookings_rpc.sql`
7. `add_update_booking_status_rpc.sql`
8. `add_write_rls_policies.sql`

Also add `autoserve://auth/callback` to **Supabase → Authentication → URL Configuration → Redirect URLs** to enable Google OAuth.

> If Supabase env vars are missing, the app falls back to local demo data so flows remain usable during development.

---

## Testing

```bash
npm test
```

Unit tests are in `__tests__/`.
