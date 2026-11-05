# Issue 26: vendor catalogue and navigation QA

Integration target: `fix/ui-issues`. Do not merge into the default branch.

## Preview setup

Apply `supabase/migrations/20261105000000_preserve_service_catalogue_order.sql`
to the preview database before running the new app. The migration establishes a
deterministic baseline ordered by vendor ID and service ID because old rows have
no ordering metadata. New services append using a database sequence; title,
price, duration, image, description, and active edits omit the order column.
Both owner catalogue and public shop detail explicitly sort by that column.

Existing backend files are ignored by this repository. Only this new migration
is included in the change. Legacy SQL fixtures were copied from the shared
workspace solely to run the existing tests.

## Automated checks

Run from the issue worktree with installed project dependencies:

```sh
NODE_ENV=test npm test -- --runInBand --silent
npx tsc --noEmit
npm run lint
```

Regression coverage includes keystroke-by-keystroke service title input through
Add and Edit forms, trimming on submission, preserving existing image and
description, successive edits against a simulated server that moves updated
rows, and actual AsyncStorage rehydration of the demo catalogue. Identity tests
cover signed-out callers, mismatched owners, inactive shops, account changes
while loading, and shared query caching. Navigation tests use the installed tab
router and rendered Back controls, including direct-link hardware fallback.

These checks do not replace a live Postgres migration run or Android rendering.

## Android acceptance checks (pending)

Use 320 x 640, 360 x 800, and 412 x 915 logical screen sizes. Repeat the narrow
size with enlarged system text (approximately 130%).

- Dashboard and profile show the signed-in owner's active published shop name.
  Use a long name containing descenders, such as “Happy Valley Garage”. Sign out
  and sign in as another owner; no previous shop name should appear.
- Tap Edit Services on the dashboard. Its button aligns with the card edges;
  catalogue cards use the same border, padding, and width from first to last.
- Inspect “My services”, category labels, prices, and “Edit service” for clipped
  y/g/p/q/j descenders. On narrow screens, the edit action stacks below booking
  information, and all controls remain reachable.
- Add “  Full  Synthetic Oil Change  ” one character at a time. Save and reopen:
  the title is “Full  Synthetic Oil Change”, retaining both interior spaces.
- Change the first, last, and middle service prices, then titles and durations.
  Toggle availability. Pull to refresh and force-stop/relaunch. Order remains
  stable. Reopen public shop detail and confirm the same relative order for
  active services. Existing descriptions and images remain intact.
- Open a booking detail from Bookings, after visiting another vendor tab.
  Visible and Android hardware Back return to Bookings. Open detail directly:
  both Back controls fall back to vendor Bookings. Repeat while detail is loading
  and for an unavailable booking.

Device QA could not run in this sandbox: ADB cannot bind its server socket and
no running Android emulator is exposed through the UI tools. The migration has
not been applied to a live database in this session.
