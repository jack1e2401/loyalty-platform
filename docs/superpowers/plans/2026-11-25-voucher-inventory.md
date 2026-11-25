# Repair missing voucher inventory

Return an explicit uninitialized state for merchant-owned legacy discount vouchers without creating data on GET. On confirmed stock-in, atomically initialize a zero baseline with an audited backfill entry, then record the adjustment using its idempotency key. Preserve cross-merchant isolation, disallow stock-out before initialization, and show the state in both inventory tabs. Verify with targeted Vitest, backend integration and a read-only check of voucher 53; do not apply the unrelated pending product-image migration.
