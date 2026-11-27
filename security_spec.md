# Security Specification — A D S Imóveis Firestore Rules

## 1. Data Invariants
1. **Default-Deny Catch-All**: Every path not explicitly matched is denied for all reads and writes.
2. **Multi-Tenant Isolation**: Every document in `properties`, `developments`, `landingPages`, and `leads` must belong to a valid `tenantId` (`^[a-zA-Z0-9_-]+$`, max 64 chars) matching an existing `/tenants/{tenantId}` document on creation.
3. **Public vs. Private Separation (PII Isolation)**:
   - Public catalog reads on `properties`, `developments`, and `landingPages` are allowed ONLY when `resource.data.published == true` (or for authenticated admins).
   - `leads` contains PII (`name`, `email`, `phone`, `message`). Public visitors can only `create` with `lgpdConsent == true` and `status == 'novo'`; `get`, `list`, `update`, and `delete` on `leads` are strictly restricted to verified admins (`isAdmin()`).
4. **Immutable Ownership & Temporal Integrity**:
   - `createdAt` must equal `request.time` on `create` and remain unchanged on `update`.
   - `updatedAt` must equal `request.time` on `create` and `update`.
   - `ownerId` must equal `request.auth.uid` on `create` (for admin/authenticated writes) and remain immutable on `update`.
5. **Verified Admin Identity**:
   - Admin access requires `request.auth != null` AND either existence in `/admins/$(request.auth.uid)` OR `request.auth.token.email_verified == true` matching the configured admin emails (`nonhu2490@gmail.com`). Unverified emails are always rejected.
6. **Strict Schema & Bounds**:
   - Every string enforces `.size() <= maxLength`, every array enforces `.size() <= MAX`, and `keys().hasAll(...)` + `keys().hasOnly(...)` prevents shadow fields.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Shadow Field Injection on Property Create**: `{ ..., isVerified: true, adminOverride: true }` -> Blocked by `keys().hasOnly(...)`.
2. **Unpublished Property Read by Anonymous Visitor**: `get /properties/draft-1` where `published == false` -> Blocked by `resource.data.published == true || isAdmin()`.
3. **Unauthenticated Property Mutation**: `create` or `update /properties/prop-1` without auth -> Blocked by `isAdmin()`.
4. **Email Spoofing Attack**: Auth token with `email: "nonhu2490@gmail.com"` and `email_verified: false` attempting admin read on `/leads` -> Blocked by `email_verified == true`.
5. **PII Scraping on Leads (`list`)**: Unauthenticated or non-admin user executing `getDocs(collection(db, 'leads'))` -> Blocked by `allow read: if isAdmin()`.
6. **Lead Creation Without LGPD Consent**: `create /leads/lead-1` with `lgpdConsent: false` -> Blocked by `isValidLead` (`data.lgpdConsent == true`).
7. **Lead Status Shortcutting on Create**: Visitor creating a lead with `status: "convertido"` -> Blocked by `data.status == 'novo'` on public create.
8. **ID Poisoning Attack**: `create /properties/<1500-char-invalid-id>` -> Blocked by `isValidId(propertyId)`.
9. **Client Timestamp Forgery**: `create /properties/prop-1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> Blocked by `incoming().createdAt == request.time`.
10. **OwnerId Spoofing on Create**: User attempting to create a property with `ownerId: "victim-uid"` -> Blocked by `incoming().ownerId == request.auth.uid`.
11. **Self-Assigned Admin Escalation**: Non-admin user creating `/admins/$(request.auth.uid)` with `role: "admin"` -> Blocked by `allow write: if isAdmin()`.
12. **Unbounded Array Resource Exhaustion**: Property create with 500 image URLs in `images` -> Blocked by `data.images.size() <= 20`.
