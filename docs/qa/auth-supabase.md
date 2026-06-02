# AutoServe — Auth + Supabase Manual Test Cases

Scope: email/password auth, role selection, sign-out, guest browsing, RLS boundaries.
Generated: 2026-05-11 via QA agent review.

---

## TC-001: Guest can browse vendors without signing in

**Steps:** Launch app → Continue as Guest → Discover screen  
**Expected:** Vendor cards visible, "0 results" empty state not shown  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-002: Guest cannot access client-only or vendor-only routes

**Steps:** As guest, attempt to navigate to `/(client)/bookings` or `/(vendor)` directly  
**Expected:** Redirected to `/(auth)` or `/(public)/welcome`  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-003: Sign-up (email confirmation OFF) routes to role selection

**Steps:** Supabase "Confirm email" disabled → tap Sign Up → fill in email/password/name → Create Account  
**Expected:** Navigates to "Choose your AutoServe experience" role screen  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-004: Sign-up (email confirmation ON) shows "check your email" message

**Steps:** Supabase "Confirm email" enabled → tap Sign Up → fill in email/password/name → Create Account  
**Expected:** Stays on auth screen, shows "Check your email to confirm your account before signing in." — does NOT navigate away  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-005: Role selection persists to Supabase and is not re-prompted on re-login

**Steps:** Sign up → pick Client role → sign out → sign back in  
**Expected:** Lands directly on Discover screen, role selection screen never appears  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:** Verify in Supabase Table Editor → profiles that `role = 'client'`

---

## TC-006: Sign-in (returning client) lands on Discover

**Steps:** Sign in with an existing client account  
**Expected:** Bypasses role screen, lands on `/(public)/discover`  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-007: Sign-in (returning vendor) lands on vendor Dashboard

**Steps:** Sign in with an existing vendor account  
**Expected:** Bypasses role screen, lands on `/(vendor)` Dashboard tab  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-008: Vendor cannot access client profile screen

**Steps:** Sign in as vendor → attempt to navigate to `/(client)/profile`  
**Expected:** Redirected away from client routes  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-009: Client sign-out via profile icon

**Steps:** Sign in as client → Discover screen → tap person icon (top-right) → Profile screen → tap Sign Out  
**Expected:** Session cleared, returned to welcome/auth screen  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-010: Vendor sign-out via Profile tab

**Steps:** Sign in as vendor → tap Profile tab → tap Sign Out  
**Expected:** Session cleared, returned to welcome/auth screen  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-011: Unauthenticated navigation to role screen redirects away

**Steps:** Without signing in, deep-link or navigate to `/(auth)/role`  
**Expected:** Immediately redirected to `/(auth)` — role screen never rendered  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:** Tests RouteGate guard + role.tsx useEffect guard

---

## TC-012: Authenticated user sees vendors (RLS authenticated policy)

**Steps:** Sign in as client → Discover screen  
**Expected:** Vendor cards visible (same as guest view)  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:** Exercises the `"vendors are readable by all" to authenticated` policy

---

## TC-013: Authenticated user sees services on vendor detail screen

**Steps:** Sign in → Discover → tap a vendor → view services list  
**Expected:** Services load correctly  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:** Exercises `"services are readable by all" to authenticated` policy

---

## TC-014: Client can create and read their own vehicle

**Steps:** Sign in as client → start booking flow → add vehicle (make/model/year) → confirm  
**Expected:** Vehicle row created in Supabase `vehicles` table with `owner_id = auth.uid()`. Vehicle appears in subsequent booking flows.  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-015: Client cannot read another user's vehicles

**Steps:** Verify in Supabase SQL Editor: `select * from vehicles` as the anon key — should return no rows. As authenticated user, should only return rows where `owner_id = auth.uid()`.  
**Expected:** RLS prevents cross-user vehicle reads  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-016: Client bookings list is empty for new user (not an error)

**Steps:** Sign in as fresh client → navigate to Bookings tab  
**Expected:** Empty state UI, no crash, no error in console  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:**

---

## TC-017: postAuthPath is cleared after successful login (FAIL-01 regression)

**Steps:** (1) As guest, navigate deep into booking flow to trigger auth gate → sign in → land on booking screen. (2) Sign out. (3) Sign in again from welcome screen.  
**Expected:** Step 3 lands on Discover or role screen — NOT on the previous booking deep-link  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:** Known FAIL — ticket filed

---

## TC-018: Vendor dashboard shows vendor's own bookings (FAIL-02 regression)

**Steps:** Sign in as vendor → Dashboard tab  
**Expected:** Vendor bookings appear (or empty state if none) — NOT always-empty in live Supabase mode due to client-scoped `bookings` RLS  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:** Known FAIL — ticket filed. Query logic in `lib/bookings.ts` now resolves owned vendor IDs and filters bookings by `vendor_id`, but `bookings` RLS still only allows client-owned rows (`client_id = auth.uid()`) for `SELECT` and `UPDATE`. In live Supabase mode, vendor dashboard/bookings appear empty; demo mode does not reproduce this.

---

## TC-019: Cancelled Google OAuth flow does not navigate to role screen (WARN-06)

**Steps:** Tap "Continue with Google" → dismiss/cancel the browser  
**Expected:** Returns to auth screen cleanly, no flash of role screen  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:** Known WARN — currently navigates to role screen then bounces back

---

## TC-020: vendor-setup session guard (FAIL-04)

**Steps:** Navigate to `/(auth)/vendor-setup` without a session (e.g. expire session while on screen) → tap "Finish Vendor Setup"  
**Expected:** Error is caught gracefully with an Alert, or user is redirected to auth  
**Actual:** [ ] Pass  [ ] Fail  
**Notes:** Known FAIL — currently throws unhandled promise rejection

---

## Known Open Issues (do not mark pass/fail until fixed)

| ID | Severity | Summary | Ticket |
|---|---|---|---|
| FAIL-01 | FAIL | postAuthPath not cleared after use — stale deep-link on re-login | Filed |
| FAIL-02 | FAIL | Vendor dashboard/bookings remain empty in live Supabase mode because `bookings` RLS is client-scoped; vendor reads and status updates for owned vendor bookings are blocked | Filed |
| FAIL-03 | FAIL | `reviews` table has no RLS enabled — any authenticated user can read/write all reviews | Filed |
| FAIL-04 | FAIL | `vendor-setup.tsx` has no session guard — unhandled throw if session missing | Filed |
| WARN-01 | WARN | Client route boundary allows vendor-role users into `/(client)/...` | Backlog |
| WARN-02 | WARN | Vendor profile Sign Out button rendered unconditionally (no session check) | Backlog |
| WARN-03 | WARN | `bookings` missing DELETE RLS policy; `vehicles` DELETE RLS closed by garage persistence setup | Partially closed |
| WARN-04 | WARN | Vendor cannot INSERT/UPDATE/DELETE their own `services` or `vendors` rows | P1 ticket filed |
| WARN-05 | WARN | `initAuthListener` loading never resolves if `hydrateSupabaseSession` throws | Backlog |
| WARN-06 | WARN | Cancelled Google OAuth still triggers role screen navigation flash | Backlog |
| WARN-07 | WARN | postAuthPath not cleared after role-set navigation in role.tsx | Same fix as FAIL-01 |
