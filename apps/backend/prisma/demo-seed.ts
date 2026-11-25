import "dotenv/config";
import { createHash } from "node:crypto";
import { Prisma } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";
import type { StorefrontConfig } from "../src/modules/merchants/storefront/storefront.types.js";
import { isValidStoreSlug } from "../src/modules/merchants/storefront/storefront.slug.js";

/**
 * Local Hikari Coffee UI fixtures. Run from apps/backend with `npm run db:seed:demo`.
 * This script refuses non-local/non-test databases and only upserts the configured merchant's demo records.
 */
const TARGET = {
  hosts: new Set(["127.0.0.1", "localhost"]),
  port: "3306",
  databasePrefix: "incomsg_testdb_",
} as const;

const DEMO_PASSWORD = "HikariDemo2026!";
const SHOP_NAME = "Hikari Coffee";

const photo = {
  interior: "https://images.unsplash.com/photo-1751956066306-c5684cbcf385?auto=format&fit=crop&w=1600&q=82",
  latte: "https://images.unsplash.com/photo-1537286164997-b6a9bbac8b55?auto=format&fit=crop&w=1100&q=82",
  matcha: "https://images.unsplash.com/photo-1560148196-df61132466ce?auto=format&fit=crop&w=1000&q=82",
  croissant: "https://images.unsplash.com/photo-1754652327649-b7f96de797bd?auto=format&fit=crop&w=1000&q=82",
  beans: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=1000&q=82",
  pastry: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=1000&q=82",
  cup: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=1000&q=82",
  icedCoffee: "https://images.unsplash.com/photo-1471922597728-92f81bfe2445?auto=format&fit=crop&w=1000&q=82",
} as const;

const categorySeeds = [
  { name: "Cà phê hạt", slug: "ca-phe-hat", description: "Hạt rang mới từ những vùng trồng được tuyển chọn.", sortOrder: 0 },
  { name: "Cà phê pha chế", slug: "ca-phe-pha-che", description: "Espresso, latte và cà phê ủ lạnh.", sortOrder: 1 },
  { name: "Trà & Matcha", slug: "tra-matcha", description: "Trà xanh và matcha pha tại quầy.", sortOrder: 2 },
  { name: "Bánh tươi", slug: "banh-tuoi", description: "Bánh nướng và món ngọt dùng cùng cà phê.", sortOrder: 3 },
] as const;

const productSeeds = [
  { sku: "DEMO-BEAN-250G", name: "Hikari Signature Blend 250g", categorySlug: "ca-phe-hat", description: "Hạt rang vừa, vị chocolate và caramel, hậu vị êm.", price: 168_000, stock: 42, kind: "SALE" as const, imageUrl: photo.beans, altText: "Túi cà phê hạt rang Hikari, ảnh Unsplash." },
  { sku: "DEMO-LATTE-01", name: "Latte nghệ thuật", categorySlug: "ca-phe-pha-che", description: "Espresso đậm vừa, sữa tươi và lớp latte art mềm mịn.", price: 68_000, stock: 30, kind: "SALE" as const, imageUrl: photo.latte, altText: "Tách latte có hình latte art, ảnh Unsplash." },
  { sku: "DEMO-COLDBREW-01", name: "Cold brew cam mật ong", categorySlug: "ca-phe-pha-che", description: "Cà phê ủ lạnh 16 giờ, điểm chút cam và mật ong.", price: 59_000, stock: 24, kind: "SALE" as const, imageUrl: photo.icedCoffee, altText: "Ly cà phê lạnh trong veo, ảnh Unsplash." },
  { sku: "DEMO-MATCHA-01", name: "Matcha latte", categorySlug: "tra-matcha", description: "Matcha Nhật, sữa tươi và vị trà xanh cân bằng.", price: 72_000, stock: 18, kind: "SALE" as const, imageUrl: photo.matcha, altText: "Tách matcha latte màu xanh, ảnh Unsplash." },
  { sku: "DEMO-CROISSANT-01", name: "Croissant bơ", categorySlug: "banh-tuoi", description: "Croissant nhiều lớp, nướng vàng mỗi sáng.", price: 69_000, stock: 16, kind: "SALE" as const, imageUrl: photo.croissant, altText: "Croissant vàng trên đĩa, ảnh Unsplash." },
  { sku: "DEMO-ALMOND-01", name: "Bánh bơ hạnh nhân", categorySlug: "banh-tuoi", description: "Bánh mềm thơm bơ, phủ hạnh nhân nướng.", price: 79_000, stock: 12, kind: "SALE" as const, imageUrl: photo.pastry, altText: "Bánh ngọt dùng cùng cà phê, ảnh Unsplash." },
  { sku: "DEMO-REWARD-PHIN", name: "Phin Hikari phiên bản mini", categorySlug: null, description: "Bộ phin nhỏ gọn dành cho phần thưởng hội viên.", price: 139_000, stock: 8, kind: "REWARD" as const, imageUrl: photo.cup, altText: "Ly và dụng cụ pha cà phê, ảnh Unsplash." },
] as const;

const memberSeeds = [
  { email: "member.bronze@hikari-demo.example.com", name: "Linh Nguyễn", address: "Địa chỉ demo 01, Singapore 018999", phone: "+65 5550 0101", tierLevel: "default" },
  { email: "member.silver@hikari-demo.example.com", name: "Minh Anh Trần", address: "Địa chỉ demo 02, Singapore 018999", phone: "+65 5550 0102", tierLevel: "silver" },
  { email: "member.gold@hikari-demo.example.com", name: "Quang Minh Lê", address: "Địa chỉ demo 03, Singapore 018999", phone: "+65 5550 0103", tierLevel: "gold" },
  { email: "member.platinum@hikari-demo.example.com", name: "Thảo Vy Phạm", address: "Địa chỉ demo 04, Singapore 018999", phone: "+65 5550 0104", tierLevel: "platinum" },
  { email: "member.diamond@hikari-demo.example.com", name: "Gia Hân Vũ", address: "Địa chỉ demo 05, Singapore 018999", phone: "+65 5550 0105", tierLevel: "diamond" },
] as const;

function addDays(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(10, 0, 0, 0);
  return date;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertLocalTarget(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("Refusing local demo seed: DATABASE_URL is missing");
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const merchantSlug = process.env.MERCHANT_SLUG?.trim();
  const merchantName = process.env.MERCHANT_NAME?.trim();
  if (
    url.protocol !== "mysql:" ||
    !TARGET.hosts.has(url.hostname) ||
    url.port !== TARGET.port ||
    !database.startsWith(TARGET.databasePrefix)
  ) {
    throw new Error("Refusing demo seed: datasource must be MySQL on localhost:3306 with an incomsg_testdb_* database");
  }
  if (!merchantSlug || !isValidStoreSlug(merchantSlug)) throw new Error("Refusing demo seed: MERCHANT_SLUG must identify the one merchant in this installation");
  if (merchantName !== SHOP_NAME) throw new Error(`Refusing demo seed: set MERCHANT_NAME=${SHOP_NAME} before seeding the Hikari sample dataset`);
  return merchantSlug;
}

async function ensureProductImage(
  tx: Prisma.TransactionClient,
  input: { productId: number; merchantId: number; url: string; altText: string },
): Promise<void> {
  const existing = await tx.productImage.findFirst({
    where: { productId: input.productId, altText: input.altText },
    select: { id: true },
  });
  if (existing) {
    await tx.productImage.update({ where: { id: existing.id }, data: { url: input.url, merchantId: input.merchantId, sortOrder: 0 } });
    return;
  }
  await tx.productImage.create({ data: { ...input, sortOrder: 0 } });
}

async function main(): Promise<void> {
  const merchantSlug = assertLocalTarget();

  const merchant = await prisma.merchant.findUnique({
    where: { slug: merchantSlug },
    select: { id: true, ownerId: true, slug: true },
  });
  if (!merchant) throw new Error("Refusing demo seed: configured merchant was not found");

  const owner = await prisma.user.findUnique({ where: { id: merchant.ownerId }, select: { id: true, role: true } });
  if (!owner || owner.role !== "MERCHANT") throw new Error("Refusing local demo seed: target store owner is not a merchant account");

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.merchant.update({ where: { id: merchant.id }, data: { name: SHOP_NAME, isActive: true } });
    await tx.user.update({ where: { id: owner.id }, data: { name: "Hikari Coffee — Chủ cửa hàng demo", passwordHash } });

    const categories = new Map<string, number>();
    for (const category of categorySeeds) {
      const row = await tx.productCategory.upsert({
        where: { merchantId_slug: { merchantId: merchant.id, slug: category.slug } },
        create: { merchantId: merchant.id, ...category },
        update: { name: category.name, description: category.description, sortOrder: category.sortOrder },
        select: { id: true, slug: true },
      });
      categories.set(row.slug, row.id);
    }

    const products = new Map<string, { id: number; name: string; price: Prisma.Decimal; kind: "SALE" | "REWARD" }>();
    for (const product of productSeeds) {
      const row = await tx.product.upsert({
        where: { merchantId_sku: { merchantId: merchant.id, sku: product.sku } },
        create: {
          merchantId: merchant.id,
          categoryId: product.categorySlug ? categories.get(product.categorySlug)! : null,
          sku: product.sku,
          name: product.name,
          description: product.description,
          price: String(product.price),
          lowStockThreshold: 5,
          status: "ACTIVE",
          kind: product.kind,
        },
        update: {
          categoryId: product.categorySlug ? categories.get(product.categorySlug)! : null,
          name: product.name,
          description: product.description,
          price: String(product.price),
          lowStockThreshold: 5,
          status: "ACTIVE",
          kind: product.kind,
        },
        select: { id: true, name: true, price: true, kind: true },
      });
      products.set(product.sku, row);
      await ensureProductImage(tx, { productId: row.id, merchantId: merchant.id, url: product.imageUrl, altText: product.altText });

      const ownerType = product.kind === "SALE" ? "SALE_PRODUCT" : "REWARD_PRODUCT";
      const inventory = await tx.inventoryBalance.upsert({
        where: { productId: row.id },
        create: { merchantId: merchant.id, productId: row.id, ownerType, onHandQuantity: product.stock, reservedQuantity: 0 },
        update: {},
        select: { id: true },
      });
      const eventRef = `local-demo-seed:${merchant.id}:stock:${product.sku}`;
      const movement = await tx.inventoryMovement.findUnique({ where: { eventRef }, select: { id: true } });
      if (!movement) {
        await tx.inventoryMovement.create({
          data: {
            balanceId: inventory.id,
            merchantId: merchant.id,
            ownerType,
            movementType: "INITIAL_STOCK",
            quantityDelta: product.stock,
            onHandBefore: 0,
            onHandAfter: product.stock,
            reservedBefore: 0,
            reservedAfter: 0,
            productId: row.id,
            actorId: owner.id,
            reason: "Tồn kho khởi tạo cho bộ dữ liệu demo local",
            eventRef,
            requestKey: `local-demo-stock:${product.sku}`,
          },
        });
      }
    }

    const sections: StorefrontConfig["sections"] = [
      { key: "hero", enabled: true, order: 0, title: null, subtitle: null },
      { key: "featured_products", enabled: true, order: 1, title: "Món được yêu thích", subtitle: "Chọn món cho buổi cà phê tiếp theo." },
      { key: "categories", enabled: true, order: 2, title: "Khám phá menu", subtitle: null },
      { key: "upcoming_events", enabled: true, order: 3, title: "Sự kiện tại Hikari", subtitle: null },
      { key: "store_info", enabled: true, order: 4, title: "Ghé thăm cửa hàng", subtitle: null },
      { key: "footer", enabled: true, order: 5, title: null, subtitle: null },
    ];
    const config: StorefrontConfig = {
      branding: {
        logoUrl: photo.latte,
        storeImageUrl: photo.interior,
        bannerUrl: photo.interior,
        primaryColor: "#49382D",
        heroTitle: "Cà phê tử tế, nhịp sống nhẹ nhàng",
        heroDescription: "Hạt rang mới, bánh nướng trong ngày và một góc nhỏ để bạn chậm lại.",
        heroImageUrl: photo.latte,
        heroCtaText: "Khám phá menu",
        heroCtaLink: `/s/${merchant.slug}`,
        footerDescription: "Hikari Coffee — cửa hàng demo local để kiểm tra trải nghiệm Mini App và CMS.",
        contactEmail: "hello@hikari-demo.example.com",
        contactPhone: "+65 5550 0100",
        address: "Hikari Coffee Demo, 1 Sample Lane, Singapore 018999",
        openingHours: [
          { day: 1, closed: false, openTime: "08:00", closeTime: "19:00" },
          { day: 2, closed: false, openTime: "08:00", closeTime: "19:00" },
          { day: 3, closed: false, openTime: "08:00", closeTime: "19:00" },
          { day: 4, closed: false, openTime: "08:00", closeTime: "19:00" },
          { day: 5, closed: false, openTime: "08:00", closeTime: "20:00" },
          { day: 6, closed: false, openTime: "09:00", closeTime: "20:00" },
          { day: 7, closed: false, openTime: "09:00", closeTime: "18:00" },
        ],
        allowedLinks: [],
      },
      sections,
      featuredProductIds: [
        products.get("DEMO-LATTE-01")!.id,
        products.get("DEMO-BEAN-250G")!.id,
        products.get("DEMO-CROISSANT-01")!.id,
        products.get("DEMO-MATCHA-01")!.id,
      ],
    };
    const configJson = config as unknown as Prisma.InputJsonValue;
    await tx.merchant.update({ where: { id: merchant.id }, data: { storefrontConfig: configJson } });

    await tx.merchantEvent.upsert({
      where: { merchantId_slug: { merchantId: merchant.id, slug: "hikari-weekend-tasting" } },
      create: {
        merchantId: merchant.id,
        title: "Hikari Weekend Tasting — thử vị mùa mới",
        slug: "hikari-weekend-tasting",
        description: "Thử ba kiểu rang mới cùng barista và nhận thêm điểm thành viên. Sự kiện demo để kiểm tra trang sự kiện.",
        bannerUrl: photo.interior,
        startAt: addDays(4),
        endAt: addDays(4 + 1),
        locationName: "Hikari Coffee Demo",
        locationAddress: "1 Sample Lane, Singapore 018999",
        status: "PUBLISHED",
        publishedAt: now,
      },
      update: {
        title: "Hikari Weekend Tasting — thử vị mùa mới",
        description: "Thử ba kiểu rang mới cùng barista và nhận thêm điểm thành viên. Sự kiện demo để kiểm tra trang sự kiện.",
        bannerUrl: photo.interior,
        startAt: addDays(4),
        endAt: addDays(5),
        locationName: "Hikari Coffee Demo",
        locationAddress: "1 Sample Lane, Singapore 018999",
        status: "PUBLISHED",
        publishedAt: now,
      },
    });

    const voucherSpecs = [
      { title: "DEMO · Giảm 20.000đ", type: "DISCOUNT" as const, pointsCost: 150, discountAmount: "20000", rewardDescription: null, rewardProductId: null },
      { title: "DEMO · Tặng phin Hikari mini", type: "REWARD" as const, pointsCost: 450, discountAmount: null, rewardDescription: "Đổi điểm nhận một bộ phin mini tại quầy.", rewardProductId: products.get("DEMO-REWARD-PHIN")!.id },
    ];
    const vouchers = new Map<string, { id: number; type: "DISCOUNT" | "REWARD"; title: string; pointsCost: number; discountAmount: Prisma.Decimal | null; rewardDescription: string | null; rewardProductId: number | null }>();
    for (const voucher of voucherSpecs) {
      const existing = await tx.voucherDefinition.findFirst({ where: { merchantId: merchant.id, title: voucher.title }, select: { id: true } });
      const row = existing
        ? await tx.voucherDefinition.update({ where: { id: existing.id }, data: { ...voucher, merchantId: merchant.id, isActive: true }, select: { id: true, type: true, title: true, pointsCost: true, discountAmount: true, rewardDescription: true, rewardProductId: true } })
        : await tx.voucherDefinition.create({ data: { ...voucher, merchantId: merchant.id, isActive: true }, select: { id: true, type: true, title: true, pointsCost: true, discountAmount: true, rewardDescription: true, rewardProductId: true } });
      vouchers.set(row.title, row);
    }

    const rule = await tx.loyaltyRule.findUniqueOrThrow({ where: { merchantId: merchant.id } });
    const policy = await tx.loyaltyPolicyVersion.findFirst({ where: { merchantId: merchant.id, isActive: true }, orderBy: { version: "desc" } });
    if (!policy) throw new Error("Target merchant has no active loyalty policy; aborting the demo data transaction");
    const tiers = await tx.loyaltyTier.findMany({ where: { merchantId: merchant.id, isActive: true }, orderBy: { sortOrder: "asc" } });
    const tierByLevel = new Map(tiers.map((tier) => [tier.level, tier]));
    const customTier = tiers.find((tier) => !["default", "silver", "gold", "platinum"].includes(tier.level));
    const supportedMemberSeeds = customTier ? memberSeeds : memberSeeds.filter((seed) => seed.tierLevel !== "diamond");
    const resolvedMembers = supportedMemberSeeds.map((seed) => ({
      ...seed,
      tier: tierByLevel.get(seed.tierLevel) ?? (seed.tierLevel === "diamond" ? customTier : undefined) ?? tierByLevel.get("default")!,
    }));
    const demoMembers = new Map<string, { id: number; membershipId: number; walletId: number | null; tierLevel: string; openingPoints: Prisma.Decimal; earnedPoints: Prisma.Decimal; finalBalance: Prisma.Decimal; isFreshMembership: boolean }>();

    for (const seed of resolvedMembers) {
      const user = await tx.user.upsert({
        where: { email: seed.email },
        create: {
          email: seed.email,
          passwordHash,
          name: seed.name,
          phone: seed.phone,
          address: seed.address,
          birthDate: new Date("1996-06-15T00:00:00.000Z"),
          role: "MEMBER",
          accountStatus: "ACTIVE",
        },
        update: { passwordHash, name: seed.name, phone: seed.phone, address: seed.address, role: "MEMBER", accountStatus: "ACTIVE" },
        select: { id: true },
      });
      const existingMembership = await tx.merchantMembership.findUnique({
        where: { memberId_merchantId: { memberId: user.id, merchantId: merchant.id } },
        select: { id: true },
      });
      const membership = await tx.merchantMembership.upsert({
        where: { memberId_merchantId: { memberId: user.id, merchantId: merchant.id } },
        create: { memberId: user.id, merchantId: merchant.id, tierId: seed.tier.id, qualificationProgress: 0 },
        update: {},
        select: { id: true, wallet: { select: { id: true } } },
      });
      demoMembers.set(seed.email, { id: user.id, membershipId: membership.id, walletId: membership.wallet?.id ?? null, tierLevel: seed.tier.level, openingPoints: new Prisma.Decimal(0), earnedPoints: new Prisma.Decimal(0), finalBalance: new Prisma.Decimal(0), isFreshMembership: !existingMembership });
    }

    const readLines = (lineSpecs: Array<{ sku: string; quantity: number }>) => lineSpecs.map((line) => {
      const product = products.get(line.sku);
      if (!product) throw new Error(`Missing seeded product ${line.sku}`);
      return { productId: product.id, productName: product.name, unitPrice: product.price, quantity: line.quantity, lineTotal: product.price.mul(line.quantity) };
    });

    const paidOrderSpecs = [
      { key: "bronze-paid", email: memberSeeds[0].email, lines: [{ sku: "DEMO-LATTE-01", quantity: 2 }], daysAgo: 1, refundRequest: true },
      { key: "silver-paid", email: memberSeeds[1].email, lines: [{ sku: "DEMO-BEAN-250G", quantity: 1 }, { sku: "DEMO-CROISSANT-01", quantity: 1 }], daysAgo: 2, refundRequest: false },
      { key: "gold-paid", email: memberSeeds[2].email, lines: [{ sku: "DEMO-BEAN-250G", quantity: 2 }, { sku: "DEMO-ALMOND-01", quantity: 1 }], daysAgo: 4, refundRequest: false },
      { key: "platinum-paid", email: memberSeeds[3].email, lines: [{ sku: "DEMO-LATTE-01", quantity: 2 }, { sku: "DEMO-MATCHA-01", quantity: 1 }, { sku: "DEMO-CROISSANT-01", quantity: 1 }], daysAgo: 5, refundRequest: false },
      { key: "diamond-paid", email: memberSeeds[4].email, lines: [{ sku: "DEMO-BEAN-250G", quantity: 1 }, { sku: "DEMO-ALMOND-01", quantity: 1 }], daysAgo: 7, refundRequest: false },
    ] as const;
    const supportedPaidOrderSpecs = paidOrderSpecs.filter((spec) => demoMembers.has(spec.email));

    const paidOrders = new Map<string, { id: number; memberId: number; total: Prisma.Decimal; earned: Prisma.Decimal; paidAt: Date; email: string }>();
    for (const spec of supportedPaidOrderSpecs) {
      const member = demoMembers.get(spec.email)!;
      const tier = tiers.find((row) => row.level === member.tierLevel)!;
      const lines = readLines([...spec.lines]);
      const subtotal = lines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
      const multiplier = tier.multiplier;
      const earned = subtotal.mul(multiplier).div(rule.vndPerPoint).toDecimalPlaces(12);
      const qualificationOpening = rule.qualificationMode === "SPEND"
        ? new Prisma.Decimal(tier.minSpendVnd ?? 0)
        : new Prisma.Decimal(tier.minLifetimePoints ?? 0);
      const openingPoints = rule.qualificationMode === "SPEND"
        ? new Prisma.Decimal(Math.max(tier.sortOrder, 0) * 1_000)
        : qualificationOpening;
      const qualificationProgress = qualificationOpening.add(rule.qualificationMode === "SPEND" ? subtotal : earned);
      const lifetimeAfterOrder = openingPoints.add(earned);
      const paidAt = addDays(-spec.daysAgo);
      const idempotencyKey = `local-demo-seed:order:${spec.key}`;
      const request = await tx.orderRequest.findUnique({
        where: { merchantId_memberId_idempotencyKey: { merchantId: merchant.id, memberId: member.id, idempotencyKey } },
        select: { orderId: true },
      });
      let orderId: number;
      if (request) {
        orderId = request.orderId;
      } else {
        const order = await tx.order.create({
          data: {
            merchantId: merchant.id,
            memberId: member.id,
            status: "PAID",
            subtotal,
            discountAmount: 0,
            total: subtotal,
            earnedPointsExact: earned,
            loyaltyPolicyVersionId: policy.id,
            loyaltySnapshot: {
              source: "MOCK_PAID",
              capturedAt: paidAt.toISOString(),
              pointScale: 12,
              rounding: "HALF_UP",
              netOrderAmount: subtotal.toFixed(0),
              vndPerPoint: rule.vndPerPoint,
              ruleActive: rule.isActive,
              tierLevel: tier.level,
              multiplier: tier.multiplier.toFixed(2),
              earnedPointsExact: earned.toFixed(12),
              policyVersionId: policy.id,
              policyVersion: policy.version,
              policyPublishedAt: policy.publishedAt.toISOString(),
              qualificationMode: rule.qualificationMode,
              tiers: tiers.map((item) => ({
                level: item.level,
                name: item.name,
                minLifetimePoints: item.minLifetimePoints,
                minSpendVnd: item.minSpendVnd?.toFixed(0) ?? null,
                sortOrder: item.sortOrder,
                multiplier: item.multiplier.toFixed(2),
                benefits: item.benefits,
                iconUrl: item.iconUrl,
                color: item.color,
              })),
            } as Prisma.InputJsonValue,
            paidAt,
            createdAt: paidAt,
          },
          select: { id: true },
        });
        orderId = order.id;
        await tx.orderItem.createMany({ data: lines.map((line) => ({ orderId, ...line })) });
        await tx.orderRequest.create({
          data: {
            merchantId: merchant.id,
            memberId: member.id,
            idempotencyKey,
            payloadHash: digest(lines.map((line) => ({ productId: line.productId, quantity: line.quantity }))),
            orderId,
          },
        });
      }
      paidOrders.set(spec.key, { id: orderId, memberId: member.id, total: subtotal, earned, paidAt, email: spec.email });

      if (member.isFreshMembership) {
        await tx.merchantMembership.update({ where: { id: member.membershipId }, data: { tierId: tier.id, qualificationProgress } });
      }
      const redemptionCost = spec.email === memberSeeds[1].email ? 150 : 0;
      const balanceAfterRedemption = lifetimeAfterOrder.sub(redemptionCost);
      const wallet = await tx.loyaltyWallet.upsert({
        where: { membershipId: member.membershipId },
        create: { membershipId: member.membershipId, exactBalance: balanceAfterRedemption, netLifetimeEarned: lifetimeAfterOrder },
        update: {},
        select: { id: true },
      });
      member.walletId = wallet.id;
      const walletId = wallet.id;
      member.openingPoints = openingPoints;
      member.earnedPoints = earned;
      member.finalBalance = balanceAfterRedemption;

      if (openingPoints.greaterThan(0)) {
        const eventRef = `local-demo-seed:opening:${spec.email}`;
        await tx.pointTransaction.upsert({
          where: { eventRef },
          create: {
            walletId,
            type: "EARN",
            delta: openingPoints,
            balanceAfter: openingPoints,
            promotedToTier: tier.level,
            reason: "Điểm tích luỹ mẫu để kiểm tra hạng thành viên",
            eventRef,
            source: "SYSTEM",
            actorId: owner.id,
          },
          update: {},
        });
      }
      const earnEventRef = `local-demo-seed:payment:${spec.key}`;
      await tx.pointTransaction.upsert({
        where: { eventRef: earnEventRef },
        create: {
          walletId,
          type: "EARN",
          delta: earned,
          balanceAfter: lifetimeAfterOrder,
          promotedToTier: tier.level,
          reason: `Tích điểm từ đơn demo #${orderId}`,
          eventRef: earnEventRef,
          source: "MOCK_PAYMENT",
          actorId: member.id,
          orderId,
        },
        update: {},
      });
      const activityEventKey = `local-demo-seed:paid:${spec.key}`;
      const activity = await tx.memberActivity.upsert({
        where: { eventKey: activityEventKey },
        create: { membershipId: member.membershipId, type: "ORDER_PAID", eventKey: activityEventKey, orderId, amountVnd: subtotal, occurredAt: paidAt },
        update: {},
        select: { id: true },
      });
      void activity;

      if (spec.refundRequest) {
        await tx.refundRequest.upsert({
          where: { orderId },
          create: { orderId, memberId: member.id, merchantId: merchant.id, reason: "Đơn demo: khách muốn đổi sang món khác" },
          update: {},
        });
      }
    }

    // A pending order gives both the member order history and merchant queue a non-paid example.
    const pendingMember = demoMembers.get(memberSeeds[1].email)!;
    const pendingLines = readLines([{ sku: "DEMO-COLDBREW-01", quantity: 1 }, { sku: "DEMO-CROISSANT-01", quantity: 1 }]);
    const pendingSubtotal = pendingLines.reduce((sum, line) => sum.add(line.lineTotal), new Prisma.Decimal(0));
    const pendingKey = "local-demo-seed:order:silver-pending";
    const pendingRequest = await tx.orderRequest.findUnique({
      where: { merchantId_memberId_idempotencyKey: { merchantId: merchant.id, memberId: pendingMember.id, idempotencyKey: pendingKey } },
      select: { orderId: true },
    });
    if (!pendingRequest) {
      const order = await tx.order.create({
        data: { merchantId: merchant.id, memberId: pendingMember.id, status: "PENDING", subtotal: pendingSubtotal, discountAmount: 0, total: pendingSubtotal, createdAt: addDays(-1) },
        select: { id: true },
      });
      await tx.orderItem.createMany({ data: pendingLines.map((line) => ({ orderId: order.id, ...line })) });
      await tx.orderRequest.create({
        data: { merchantId: merchant.id, memberId: pendingMember.id, idempotencyKey: pendingKey, payloadHash: digest(pendingLines.map((line) => ({ productId: line.productId, quantity: line.quantity }))), orderId: order.id },
      });
    }

    const discount = vouchers.get("DEMO · Giảm 20.000đ")!;
    const silver = demoMembers.get(memberSeeds[1].email)!;
    let memberVoucher = await tx.memberVoucher.findFirst({ where: { membershipId: silver.membershipId, definitionId: discount.id }, select: { id: true } });
    if (!memberVoucher) {
      memberVoucher = await tx.memberVoucher.create({
        data: {
          membershipId: silver.membershipId,
          definitionId: discount.id,
          snapshotType: "DISCOUNT",
          snapshotTitle: discount.title,
          snapshotPointsCost: discount.pointsCost,
          snapshotDiscountAmount: discount.discountAmount,
          snapshotRewardDescription: discount.rewardDescription,
          status: "AVAILABLE",
          redeemedAt: addDays(-3),
        },
        select: { id: true },
      });
    }
    const silverPaidOrder = paidOrders.get("silver-paid")!;
    const silverBalanceAfterEarn = silver.openingPoints.add(silver.earnedPoints);
    const discountRef = `local-demo-seed:redeem:${memberSeeds[1].email}`;
    await tx.pointTransaction.upsert({
      where: { eventRef: discountRef },
      create: {
        walletId: silver.walletId!,
        type: "REDEEM_DISCOUNT",
        delta: new Prisma.Decimal(-discount.pointsCost),
        balanceAfter: silverBalanceAfterEarn.sub(discount.pointsCost),
        promotedToTier: null,
        reason: `Đổi voucher demo: ${discount.title}`,
        eventRef: discountRef,
        source: "MEMBER_REDEMPTION",
        actorId: silver.id,
        memberVoucherId: memberVoucher.id,
      },
      update: {},
    });
    void silverPaidOrder;

    const challengeSpecs = [
      { title: "Ghé Hikari 3 lần trong tuần", description: "Tích luỹ đủ 3 đơn đã thanh toán trong thời gian diễn ra để nhận điểm thưởng.", type: "ORDER_COUNT" as const, targetValue: 3, rewardPoints: 50, budgetTotal: 5_000, isFeatured: true },
      { title: "Check-in 5 ngày", description: "Quay lại Hikari và check-in mỗi ngày để mở khoá điểm thưởng.", type: "DAILY_CHECKIN" as const, targetValue: 5, rewardPoints: 25, budgetTotal: 2_500, isFeatured: false },
    ];
    const challenges = new Map<string, { id: number; type: "ORDER_COUNT" | "DAILY_CHECKIN" }>();
    for (const spec of challengeSpecs) {
      const existing = await tx.challenge.findFirst({ where: { merchantId: merchant.id, title: spec.title }, select: { id: true } });
      const challenge = existing
        ? await tx.challenge.update({ where: { id: existing.id }, data: { ...spec, merchantId: merchant.id, status: "ACTIVE", startsAt: addDays(-1), endsAt: addDays(14), activatedAt: now }, select: { id: true, type: true } })
        : await tx.challenge.create({ data: { ...spec, merchantId: merchant.id, status: "ACTIVE", startsAt: addDays(-1), endsAt: addDays(14), activatedAt: now }, select: { id: true, type: true } });
      challenges.set(spec.title, challenge);
    }
    const orderChallenge = challenges.get(challengeSpecs[0].title)!;
    for (const spec of supportedPaidOrderSpecs) {
      const member = demoMembers.get(spec.email)!;
      const order = paidOrders.get(spec.key)!;
      const activity = await tx.memberActivity.findUniqueOrThrow({ where: { eventKey: `local-demo-seed:paid:${spec.key}` }, select: { id: true } });
      const progress = await tx.challengeProgress.upsert({
        where: { challengeId_membershipId: { challengeId: orderChallenge.id, membershipId: member.membershipId } },
        create: { challengeId: orderChallenge.id, membershipId: member.membershipId, currentValue: 1, rewardState: "IN_PROGRESS", rewardCycle: 1 },
        update: {},
        select: { id: true },
      });
      await tx.challengeProgressEntry.upsert({
        where: { progressId_activityId: { progressId: progress.id, activityId: activity.id } },
        create: { progressId: progress.id, activityId: activity.id, deltaValue: 1 },
        update: {},
      });
      void order;
    }

    const checkinChallenge = challenges.get(challengeSpecs[1].title)!;
    const silverProgress = await tx.challengeProgress.upsert({
      where: { challengeId_membershipId: { challengeId: checkinChallenge.id, membershipId: silver.membershipId } },
      create: { challengeId: checkinChallenge.id, membershipId: silver.membershipId, currentValue: 2, rewardState: "IN_PROGRESS", rewardCycle: 1 },
      update: {},
      select: { id: true },
    });
    for (const day of [4, 3]) {
      const eventKey = `local-demo-seed:checkin:${memberSeeds[1].email}:${day}`;
      const activity = await tx.memberActivity.upsert({
        where: { eventKey },
        create: { membershipId: silver.membershipId, type: "DAILY_CHECKIN", eventKey, occurredAt: addDays(-day) },
        update: {},
        select: { id: true },
      });
      await tx.challengeProgressEntry.upsert({
        where: { progressId_activityId: { progressId: silverProgress.id, activityId: activity.id } },
        create: { progressId: silverProgress.id, activityId: activity.id, deltaValue: 1 },
        update: {},
      });
    }

    const milestoneChallenge = orderChallenge;
    for (const milestone of [
      { position: 1, thresholdValue: 1, title: "Lần ghé đầu tiên", description: "Hoàn thành đơn đầu tiên." },
      { position: 2, thresholdValue: 3, title: "Khách quen Hikari", description: "Hoàn thành đủ ba đơn." },
    ]) {
      await tx.challengeMilestone.upsert({
        where: { challengeId_position: { challengeId: milestoneChallenge.id, position: milestone.position } },
        create: { challengeId: milestoneChallenge.id, ...milestone },
        update: { thresholdValue: milestone.thresholdValue, title: milestone.title, description: milestone.description },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.info("Local Hikari UI demo dataset is ready. Member login password is the shared local demo password.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Local demo seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
