# Simplify storefront configuration

- Move the currently published configuration to `Merchant.storefrontConfig`; migrations retain the highest published version, fall back to the latest version, and remove draft/version tables. Unpublished drafts and history are intentionally removed.
- Expose one merchant-owned configuration read/write path; validate featured products transactionally and keep storefront profile fields authoritative.
- Replace draft/publish/rollback UI with a confirmed save that immediately updates the public storefront; remove preview and history paths.
- Update seeds and regression tests; generate Prisma client and run targeted unit and local-test-database integration checks. Apply the migration only to the explicitly approved local database and verify the public configuration before and after.
