import { withStoreProfile } from "./storefront.profile.js";
import { HttpError } from "../../../lib/http-error.js";
import { merchantService } from "../profile/merchant.service.js";
import { storefrontRepository } from "./storefront.repository.js";
import { isValidStoreSlug } from "./storefront.slug.js";
import type { StorefrontConfig } from "./storefront.types.js";

export const storefrontService = {
  async getMerchantStorefront(ownerId: number) {
    const merchant = await merchantService.getOwnStore(ownerId);
    const config = await storefrontRepository.getConfig(merchant);
    return { merchant, config: await withStoreProfile(merchant.id, config, config) };
  },
  async saveConfig(ownerId: number, input: StorefrontConfig) {
    const merchant = await merchantService.getOwnStore(ownerId);
    const config = await storefrontRepository.saveConfig(merchant, input);
    return { config: await withStoreProfile(merchant.id, config, config) };
  },
  async getPublicStorefront(slug: string) {
    const normalizedSlug = slug.trim();
    if (!isValidStoreSlug(normalizedSlug)) throw new HttpError(404, "MERCHANT_NOT_FOUND");
    const merchant = await storefrontRepository.findActiveMerchantBySlug(normalizedSlug);
    if (!merchant) throw new HttpError(404, "MERCHANT_NOT_FOUND");
    const config = await storefrontRepository.getConfig(merchant);
    const dynamic = await storefrontRepository.loadDynamicStorefrontData(merchant.id, config.featuredProductIds);
    return { merchant, config: await withStoreProfile(merchant.id, config, config), ...dynamic };
  },
};
