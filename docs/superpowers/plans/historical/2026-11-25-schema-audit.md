# Schema audit: primary product image

Remove the unreferenced Prisma TierLevel enum. Store product images only in ProductImage while retaining imageUrl in API DTOs for compatibility. Before dropping Product.imageUrl, backfill gallery entries whenever necessary to preserve the currently displayed primary image, including legacy and mismatched data. Keep loyalty snapshots, refund state, legacy payment evidence and inventory reservation fields because runtime reads them. Verify catalog and storefront reads and migration against an isolated MySQL test database before applying it.
