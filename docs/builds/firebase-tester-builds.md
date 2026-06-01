# Firebase Tester Builds

This project uses EAS preview builds for tester distribution.
These are standalone tester builds, not Expo development-client builds that require Metro.

## Prerequisites

- Expo/EAS project configured for AutoServe.
- Firebase Android app with package `com.vibez.autoserve`.
- Firebase iOS app with bundle ID `com.vibez.autoserve`.
- Apple Developer Program access for iOS ad hoc signing.
- Registered iOS tester devices before creating an iOS ad hoc build.
- EAS preview environment values:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_API_BASE_URL`
  - `EXPO_PUBLIC_ENABLE_DEMO_DATA=false`
  - Google OAuth client IDs if the auth provider requires them for the preview project.

## Build Commands

```sh
npm run build:android:preview
npm run build:ios:preview
npm run build:preview
```

The Android preview profile creates an APK. The iOS preview profile creates an ad hoc IPA that only installs on registered devices.

## Firebase Upload

The first upload can be done through the Firebase console:

1. Open Firebase App Distribution.
2. Select the Android or iOS Firebase app.
3. Upload the EAS build artifact.
4. Choose the tester group.
5. Include release notes that state whether the build is live Supabase or demo-only.

If using the Firebase CLI later:

```sh
firebase appdistribution:distribute <artifact.apk> --app <firebase_android_app_id> --groups <tester_group>
firebase appdistribution:distribute <artifact.ipa> --app <firebase_ios_app_id> --groups <tester_group>
```

## Pre-Release Smoke Checklist

- Install on a clean Android device.
- Install on a registered iOS device.
- Launch cold and confirm the splash screen clears.
- Allow and deny location permission.
- Browse as guest, open discovery, and open a shop detail.
- Sign up or sign in as a client.
- Add a vehicle and create a booking.
- Sign up or sign in as a vendor.
- Complete or revisit vendor onboarding.
- Verify vendor services, location, bookings list, and booking status actions.
- Verify Google OAuth success and cancellation on both platforms.
- Verify the live Supabase project has all migrations in `supabase/migrations` applied.

## Supabase Migration Order

Apply these SQL files in order to the live tester Supabase project:

1. `auto_create_profile.sql`
2. `add_booking_missing_columns.sql`
3. `bookings_multi_service.sql`
4. `add_vehicle_garage_fields.sql`
5. `add_vendor_onboarding_drafts.sql`
6. `add_vendor_bookings_rpc.sql`
7. `add_update_booking_status_rpc.sql`
8. `add_write_rls_policies.sql`
