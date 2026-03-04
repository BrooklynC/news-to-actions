# Clerk Permission Audit

**Date:** Feb 2026  
**Scope:** How Clerk is used for auth and org scoping; what we rely on; optional hardening.

---

## 1. What We Use

- **Clerk APIs:** `auth()`, `currentUser()`, `clerkClient().organizations.getOrganization()`, `ClerkProvider`, `OrganizationSwitcher`, `UserButton`, `SignIn`, `SignUp`.
- **We do not use:** Clerk roles, permissions, or custom claims. Authorization is **org-scoped only**: the active org is `auth().orgId` (Clerk org ID); we resolve to internal `Organization.id` and scope all data by it.

---

## 2. Route Protection

| Area | Protection | Notes |
|------|------------|--------|
| `/app(.*)` | `auth.protect()` in middleware | Redirects to sign-in if not authenticated. |
| `/api/cron/run-jobs` | Excluded from Clerk middleware; secret-gated only | Correct: cron must not require Clerk. |
| `/api/topics`, `/api/personas` | No `protect()`; handlers call `auth()` and return 400 if no org | Session comes from Clerk; unauthenticated get 400 "No organization selected." |

**Finding:** App routes are protected. API routes that use Clerk are safe because they check `auth()` and resolve org; unauthenticated callers get 400, not data.

**Done:** Middleware now protects `/api/topics` and `/api/personas` via `auth.protect()` so unauthenticated requests get 401 at the edge (`src/middleware.ts`: `isProtectedApiRoute`).

---

## 3. Org Scoping

- Every server action and API handler that needs an org either:
  - Calls `requireOrgAndUser()` and uses returned `organizationId`, or
  - Calls `auth()`, gets `clerkOrgId`, looks up `Organization` by `clerkOrgId`, and uses `org.id` for Prisma `where: { organizationId: org.id }`.
- **Trust model:** We trust Clerk’s `orgId` from the session. Clerk only lets the user switch to orgs they are a member of, so we rely on **Clerk org membership** as the source of truth for “can this user see this org?”

**Finding:** No missing org-scoping found. All relevant actions and API routes scope by org.

---

## 4. Destructive / Sensitive Actions

- **Observability requeue:** `requeueDeadJob` uses `requireOrgAndUser()` and only loads/updates jobs with `organizationId` in the `where` clause. Users can only requeue jobs in their current org.
- **Data governance (export/delete):** Uses `getOrgAndRedirect()` / org from auth; export and delete are org-scoped.
- **Cron:** Not Clerk-gated; uses `x-cron-secret` only (correct for external scheduler).

**Finding:** Destructive and sensitive operations are gated by org and, where used, by `requireOrgAndUser()`.

---

## 5. Sync and Membership

- `syncDbWithClerk()`: Upserts `User` by `clerkUserId`, upserts `Organization` by `clerkOrgId`, upserts `Membership` (user, org, role `"member"`). Used on app pages so DB stays in sync with Clerk.
- We do **not** read Clerk org roles for authorization; we only sync membership so our DB has a consistent User/Organization/Membership model. Our app does not currently enforce different behavior by role (e.g. admin vs member).

**Finding:** Sync is correct. If you later add role-based features, decide whether to use Clerk roles or our `Membership.role` and document the policy.

---

## 6. Clerk Dashboard / Config (Your Responsibility)

- **Org membership:** Ensure in the Clerk Dashboard that organization membership is managed as intended (e.g. invite-only, no self-service create if that’s not desired).
- **Allowed redirect URLs / domains:** Keep production and staging domains correct.
- **Session / token settings:** Use defaults or documented settings; no custom claims required for current app.

---

## 7. Summary

| Item | Status |
|------|--------|
| App routes protected by middleware | OK |
| Cron excluded from Clerk; secret-gated | OK |
| API routes using auth() and org-scoped | OK |
| Org scoping on all actions and APIs | OK |
| Destructive ops require org + user | OK |
| No use of Clerk roles; org membership is the boundary | OK |
| /api/topics and /api/personas protected in middleware | Done |

**Conclusion:** No permission or org-scoping gaps found. API routes `/api/topics` and `/api/personas` are now protected in middleware. Do not change Clerk configuration (roles, domains, etc.) without an explicit review; this audit documents current behavior only.
