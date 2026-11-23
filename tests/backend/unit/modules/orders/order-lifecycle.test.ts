import assert from "node:assert/strict";
import { test } from "node:test";
import { Prisma } from "../../../../../apps/backend/src/generated/prisma/client.js";
import {
  computeOrderActions,
  toOrderDto,
} from "../../../../../apps/backend/src/modules/commerce/orders/orders.serialization.js";

test("order actions follow persisted order and refund state", () => {
  assert.deepEqual(computeOrderActions("PENDING", null, null), {
    canCancel: true,
    canRefund: false,
    canRequestRefund: false,
  });
  assert.deepEqual(computeOrderActions("PAID", null, null), {
    canCancel: false,
    canRefund: true,
    canRequestRefund: true,
  });
  assert.deepEqual(computeOrderActions("PAID", { status: "COMPLETED" }, null), {
    canCancel: false,
    canRefund: false,
    canRequestRefund: false,
  });
  assert.deepEqual(computeOrderActions("PAID", null, { status: "PENDING_MERCHANT" }), {
    canCancel: false,
    canRefund: true,
    canRequestRefund: false,
  });
});

test("toOrderDto formats authoritative loyalty events and refund state", () => {
  const mockOrder = {
    id: 10,
    merchantId: 1,
    memberId: 2,
    status: "PAID",
    subtotal: new Prisma.Decimal("100000"),
    discountAmount: new Prisma.Decimal("20000"),
    total: new Prisma.Decimal("80000"),
    paidAt: new Date("2026-11-11T10:00:00Z"),
    earnedPointsExact: new Prisma.Decimal("8.500000000000"),
    items: [
      {
        productId: 1,
        productName: "Coffee",
        unitPrice: new Prisma.Decimal("100000"),
        quantity: 1,
        lineTotal: new Prisma.Decimal("100000"),
      },
    ],
    refund: null,
    refundRequest: null,
    pointTransactions: [
      {
        id: 101,
        type: "EARN",
        delta: new Prisma.Decimal("8.500000000000"),
        balanceAfter: new Prisma.Decimal("8.500000000000"),
        reason: "Earned from order #10",
        source: "MOCK_PAYMENT",
        actorId: 2,
        createdAt: new Date("2026-11-11T10:00:00Z"),
      },
    ],
  };

  const dto = toOrderDto(mockOrder);
  assert.equal(dto.id, 10);
  assert.equal(dto.subtotal, "100000");
  assert.equal(dto.discountAmount, "20000");
  assert.equal(dto.total, "80000");
  assert.equal(dto.earnedPointsExact, "8.5");
  assert.equal(dto.refundStatus, null);
  assert.equal(dto.actions?.canCancel, false);
  assert.equal(dto.actions?.canRefund, true);
  assert.equal(dto.actions?.canRequestRefund, true);
  assert.equal(dto.loyaltyEvents?.length, 1);
  assert.equal(dto.loyaltyEvents?.[0]?.delta, "8.5");
  assert.equal(dto.loyaltyEvents?.[0]?.type, "EARN");
});
