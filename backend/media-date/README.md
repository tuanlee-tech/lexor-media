# Media Date Backend Handoff

## Backend and Scope

`README-PRODUCTION.md` sections 1-2 identify the media backend as the Cloudflare
Worker `lexor-media-gallery-api` with D1 database `lexor-media-gallery-db`.
`app/lib/api.server.ts` calls that external API; Prisma is not the media database.
The only worker source in this checkout is ignored `_reference/worker/src/index.ts`.
The reference worker, fresh-install schema, and example config have been updated,
but those ignored edits alone will not ship through Git. This directory supplies
the version-controlled handoff: `worker.patch`, `001_media_date.sql`, and tests.
No deployment or remote database operation was performed. The actual production
source may have drifted from this reference; the worker owner must review it.

## API Contract

- `POST /api/admin/media` and `PATCH /api/admin/media/:id` accept `media_date` as
  JSON `null` or a strict `YYYY-MM-DD` string (Gregorian years 0001-9999).
- Impossible dates, timestamps, unpadded dates, whitespace, empty strings,
  non-string values, and dates later than the shop's current date return HTTP 400
  with `{ "error": "media_date must be null or a real YYYY-MM-DD date no later than today in the shop timezone." }`.
- The app sends a date already normalized to the Shopify shop timezone. The
  worker stores that date unchanged, not a timestamp, and does not convert it again.
- The worker independently computes today from its server clock and trusted
  `env.SHOP_TIMEZONE`. Request fields/headers/query parameters such as `today` or
  `timezone` cannot override this. Configure the same IANA timezone as Shopify.
- Missing/invalid `SHOP_TIMEZONE` returns HTTP 500 for otherwise valid non-null
  date writes. There is deliberately no UTC or browser-local fallback. Null
  clearing and writes omitting the field do not require timezone configuration.
- Omitted POST dates and legacy rows are SQL NULL. PATCH omission preserves the
  existing value; explicit `null` clears it. No created-at backfill is performed.
- Public `GET /api/gallery/media` media objects and admin media reads/write
  responses include `media_date: string | null`.
- Public and admin media lists use `media_date DESC NULLS LAST, sort_order ASC,
  created_at DESC, id ASC` in SQL **before** LIMIT/OFFSET. All existing scope,
  type, active, and search filters remain in place. Automatic folder covers use
  the same media order; explicit covers win. Folder/category ordering is unchanged.

This reference has a single shop-wide database and no authenticated per-shop
partition. Use one configured shop timezone per worker/database. Sharing it
between shops with different timezones requires a separate trusted tenant model,
not a client-provided timezone. Keep config synchronized if Shopify's timezone changes.

## Owner Deployment Steps

1. Review the live worker source against the reference. From the actual backend
   root containing `worker/` and `d1/`, check and apply the patch (replace the path):

```sh
git apply --check /path/to/backend/media-date/worker.patch
git apply /path/to/backend/media-date/worker.patch
```

2. Set `SHOP_TIMEZONE` under `[vars]` in the actual worker config, and separately
   in each named environment's vars. This project uses the California headquarters
   timezone; the IANA timezone automatically handles PST and PDT:

```toml
[vars]
SHOP_TIMEZONE = "America/Los_Angeles"
```

3. Before deploying the worker, back up the target D1 database and inspect
   `PRAGMA table_info(media_items)`. For existing databases without the column,
   import `001_media_date.sql` into the owner's next numbered D1 migration and
   apply through their normal local/staging, then production migration process.
   Apply once only: `ALTER TABLE ADD COLUMN` is not idempotent. If the column
   exists already, verify its definition rather than rerunning it. Fresh installs
   use patched `d1/schema.sql` instead, not both. Reapplying a CREATE TABLE schema
   does not migrate an existing table. SQL stores nullable text; calendar and
   trusted-clock validation are enforced by the worker, so direct DB writes must
   enforce the same contract.
4. Run the tests below and the owner's worker typecheck/runtime tests. Regenerate
   binding types with the owner's normal tooling if their worker uses generated Env.
   Deploy the worker only after the migration/config are ready, then release
   app/storefront callers. Existing reference public responses have no explicit
   cache; purge any independently configured CDN cache if applicable.
5. Smoke-test valid/today/future/invalid dates, clearing, omission, page boundaries,
   and automatic versus explicit covers. For rollback, restore the previous
   worker and disable date-writing clients; leave the additive nullable column
   intact to preserve values. Older worker code will not enforce date ordering.

## Verification

From this repository root, with Node 24 (native TypeScript stripping and SQLite):

```sh
node --test backend/media-date/media-date.test.mjs
```

For an applied backend elsewhere, set `BACKEND_ROOT=/absolute/backend/root`.
Tests execute the actual worker handler with a small D1-shaped adapter over
in-memory SQLite, a fixed server clock, and no network. They cover leap years,
invalid input, timezone boundaries/config failures, create/update/read semantics,
ordering before pagination, covers, migration preservation, and exact patch
reverse/reapply parity. They are not a replacement for Cloudflare-runtime tests.

Local result: 4 tests passed. `npm run typecheck` in `_reference/worker` was blocked
by missing `@cloudflare/workers-types` (TS2688); the owner must install the worker's
dependencies and run its typecheck before deployment.

Cloudflare references retrieved before worker changes:

- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
- https://developers.cloudflare.com/workers/configuration/environment-variables/
- https://developers.cloudflare.com/d1/worker-api/prepared-statements/
- https://unpkg.com/@cloudflare/workers-types@latest/index.d.ts
- https://developers.cloudflare.com/d1/reference/migrations/
