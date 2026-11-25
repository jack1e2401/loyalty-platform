import { prisma } from "../../../lib/prisma.js";
import type { MerchantDto } from "../../platform/auth/auth.types.js";

const directoryFields = { id: true, name: true, slug: true } as const;
const activeDirectory = { where: { isActive: true }, orderBy: { id: "asc" } } as const;

export const merchantRepository = {
  async findActiveStoreById(merchantId: number) {
    return prisma.merchant.findFirst({ where: { id: merchantId, isActive: true }, select: { id: true } });
  },

  async findStoreById(merchantId: number) {
    return prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
  },

  async listActiveStores(includeCover = false) {
    if (!includeCover) {
      return prisma.merchant.findMany({ ...activeDirectory, select: directoryFields });
    }

    const stores = await prisma.merchant.findMany({
      ...activeDirectory,
      select: {
        ...directoryFields,
        products: {
          where: { kind: "SALE", status: "ACTIVE", images: { some: {} } },
          orderBy: { id: "asc" },
          take: 1,
          select: { images: { select: { url: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1 } },
        },
      },
    });
    return stores.map(({ products, ...store }) => ({ ...store, coverImageUrl: products[0]?.images[0]?.url ?? null }));
  },

  async findActiveStoreByOwner(ownerId: number): Promise<MerchantDto | null> {
    return prisma.merchant.findFirst({
      where: { ownerId, isActive: true },
      select: { id: true, name: true, slug: true, isActive: true },
    });
  },
};
