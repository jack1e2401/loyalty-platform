import { prisma } from "../../../lib/prisma.js";
import { merchantService } from "../profile/merchant.service.js";
import { storefrontRepository } from "./storefront.repository.js";
import { readStoreProfile, type readStoreProfileUpdate } from "./storefront.validation.js";
import type { StorefrontConfig } from "./storefront.types.js";

export async function loadStoreProfile(merchantId: number) {
  const merchant = await prisma.merchant.findUniqueOrThrow({
    where: { id: merchantId },
    select: { storeProfile: true },
  });
  return merchant.storeProfile === null ? null : readStoreProfile(merchant.storeProfile);
}

export async function withStoreProfile(merchantId: number, config: StorefrontConfig, fallback: StorefrontConfig) {
  const profile = await loadStoreProfile(merchantId) ?? readStoreProfile(fallback.branding);
  return { ...config, branding: { ...config.branding, ...profile } };
}

export async function getStoreProfile(ownerId: number) {
  const merchant = await merchantService.getOwnStore(ownerId);
  const { published } = await storefrontRepository.ensureInitialized(merchant, ownerId);
  const profile = await loadStoreProfile(merchant.id) ?? readStoreProfile(published.config.branding);
  // The installation reports calendar months in Vietnam time (UTC+7).
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, -7));
  const where = { merchantId: merchant.id };
  const [members, monthlyOrders, activeProducts] = await Promise.all([
    prisma.merchantMembership.count({ where }),
    prisma.order.count({ where: { ...where, createdAt: { gte: month } } }),
    prisma.product.count({ where: { ...where, kind: "SALE", status: "ACTIVE" } }),
  ]);
  return { merchant, profile, counts: { members, monthlyOrders, activeProducts } };
}

export async function updateStoreProfile(ownerId: number, update: ReturnType<typeof readStoreProfileUpdate>) {
  const merchant = await merchantService.getOwnStore(ownerId);
  const saved = await prisma.merchant.update({
    where: { id: merchant.id, ownerId, isActive: true },
    data: {
      name: update.name,
      storeProfile: {
        ...update.profile,
        openingHours: update.profile.openingHours?.map((day) => ({ ...day })) ?? null,
      },
    },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  return { merchant: saved, profile: update.profile };
}
