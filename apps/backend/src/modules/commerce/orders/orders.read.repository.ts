import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { toOrderDto } from "./orders.serialization.js";

type OrderReadRecord = Prisma.OrderGetPayload<{
  include: {
    items: true;
    pointTransactions: true;
    refund: true;
    refundRequest: true;
  };
}>;

function toOrderReadDto(order: OrderReadRecord) {
  return toOrderDto(order);
}

export const orderReadRepository = {
  async listMemberOrders(memberId: number, merchantId: number) {
    const orders = await prisma.order.findMany({
      where: { memberId, merchantId },
      include: {
        items: true,
        pointTransactions: true,
        refund: true,
        refundRequest: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return orders.map(toOrderReadDto);
  },

  async findMemberOrder(memberId: number, orderId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, memberId },
      include: {
        items: true,
        pointTransactions: true,
        refund: true,
        refundRequest: true,
      },
    });
    if (!order) return null;
    const earnTx = order.pointTransactions?.find((tx) => tx.type === "EARN");
    return {
      ...toOrderReadDto(order),
      promotedToTier: earnTx?.promotedToTier ?? null,
    };
  },

  async listMerchantOrders(merchantId: number) {
    const orders = await prisma.order.findMany({
      where: { merchantId },
      include: {
        items: true,
        pointTransactions: true,
        refund: true,
        refundRequest: true,
        member: { select: { email: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return orders.map((order) => ({
      ...toOrderReadDto(order),
      memberEmail: order.member.email,
    }));
  },

  async listMerchantOrdersPage(merchantId: number, page: number, limit: number, search: string, status: string) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const statusFilter = status ? Prisma.sql`AND o.status = ${status}` : Prisma.empty;
    const searchFilter = search ? Prisma.sql`AND (
      CAST(o.id AS CHAR) LIKE ${pattern}
      OR CAST(o.memberId AS CHAR) LIKE ${pattern}
      OR u.email LIKE ${pattern}
    )` : Prisma.empty;
    const where = Prisma.sql`FROM \`Order\` o JOIN \`User\` u ON u.id = o.memberId
      WHERE o.merchantId = ${merchantId} ${statusFilter} ${searchFilter}`;
    const [ids, counts] = await prisma.$transaction([
      prisma.$queryRaw<{ id: number }[]>(Prisma.sql`SELECT o.id ${where}
        ORDER BY o.createdAt DESC, o.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
      prisma.$queryRaw<{ total: bigint }[]>(Prisma.sql`SELECT COUNT(*) AS total ${where}`),
    ]);
    const records = ids.length ? await prisma.order.findMany({
      where: { merchantId, id: { in: ids.map(({ id }) => id) } },
      include: { items: true, pointTransactions: true, refund: true, refundRequest: true, member: { select: { email: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }) : [];
    const totalItems = Number(counts[0]?.total ?? 0);
    return {
      orders: records.map((order) => ({ ...toOrderReadDto(order), memberEmail: order.member.email })),
      pagination: { page, limit, totalItems, totalPages: Math.ceil(totalItems / limit) },
    };
  },

  async findMerchantOrder(merchantId: number, orderId: number) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, merchantId },
      include: {
        items: true,
        pointTransactions: true,
        refund: true,
        refundRequest: true,
      },
    });
    return order ? toOrderReadDto(order) : null;
  },
};
