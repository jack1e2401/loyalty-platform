import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { HttpError } from "../../../lib/http-error.js";
import { withTransactionRetry } from "../../../lib/prisma-transaction.js";
import type { StorefrontConfig, StorefrontMerchantSummaryDto } from "./storefront.types.js";
import { defaultStorefrontConfig, readStorefrontConfig } from "./storefront.validation.js";
import { storefrontPublicRepository } from "./storefront.public.repository.js";
import { assertOwnedFeaturedProductsTx } from "./storefront.persistence.js";

export const storefrontRepository = {
  ...storefrontPublicRepository,
  async findActiveMerchantBySlug(slug: string): Promise<StorefrontMerchantSummaryDto | null> {
    return prisma.merchant.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, slug: true } });
  },
  async getConfig(merchant: StorefrontMerchantSummaryDto): Promise<StorefrontConfig> {
    const row = await prisma.merchant.findUniqueOrThrow({ where: { id: merchant.id }, select: { storefrontConfig: true } });
    return row.storefrontConfig === null ? defaultStorefrontConfig(merchant.name, merchant.slug) : readStorefrontConfig(row.storefrontConfig);
  },
  async saveConfig(merchant: StorefrontMerchantSummaryDto, config: StorefrontConfig): Promise<StorefrontConfig> {
    return withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const row = await tx.merchant.findUniqueOrThrow({ where: { id: merchant.id }, select: { storefrontConfig: true } });
      const previous = row.storefrontConfig === null ? defaultStorefrontConfig(merchant.name, merchant.slug) : readStorefrontConfig(row.storefrontConfig);
      if (config.featuredProductIds.length > 6 && JSON.stringify(config.featuredProductIds) !== JSON.stringify(previous.featuredProductIds)) {
        throw new HttpError(400, "FEATURED_PRODUCTS_LIMIT");
      }
      await assertOwnedFeaturedProductsTx(tx, merchant.id, config.featuredProductIds);
      await tx.merchant.update({ where: { id: merchant.id }, data: { storefrontConfig: config as unknown as Prisma.InputJsonValue } });
      return config;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
  },
};
