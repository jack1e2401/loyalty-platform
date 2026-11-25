import { Prisma } from "../../../generated/prisma/client.js";
import { HttpError } from "../../../lib/http-error.js";

export async function assertOwnedFeaturedProductsTx(
  tx: Prisma.TransactionClient,
  merchantId: number,
  featuredProductIds: number[],
): Promise<void> {
  if (featuredProductIds.length === 0) return;
  const rows = await tx.product.findMany({
    where: {
      id: { in: featuredProductIds },
      merchantId,
      kind: "SALE",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (rows.length !== featuredProductIds.length) {
    throw new HttpError(400, "INVALID_FEATURED_PRODUCTS");
  }
}
