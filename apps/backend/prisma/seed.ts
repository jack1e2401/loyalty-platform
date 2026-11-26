import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";
import { readBootstrapConfig } from "./bootstrap-config.js";

const baselineTiers = [
  { level: "default", name: "Default", minLifetimePoints: 0, minSpendVnd: null, sortOrder: 0, multiplier: "1.00", benefits: [], iconUrl: null, color: "#6B7280", maintenanceSpendVnd: null, isActive: true },
  { level: "silver", name: "Silver", minLifetimePoints: 1_000, minSpendVnd: null, sortOrder: 1, multiplier: "1.20", benefits: [], iconUrl: null, color: "#8A949D", maintenanceSpendVnd: null, isActive: true },
  { level: "gold", name: "Gold", minLifetimePoints: 5_000, minSpendVnd: null, sortOrder: 2, multiplier: "1.50", benefits: [], iconUrl: null, color: "#C6912D", maintenanceSpendVnd: null, isActive: true },
  { level: "platinum", name: "Platinum", minLifetimePoints: 10_000, minSpendVnd: null, sortOrder: 3, multiplier: "2.00", benefits: [], iconUrl: null, color: "#5B6F8D", maintenanceSpendVnd: null, isActive: true },
];

async function main(): Promise<void> {
  const config = readBootstrapConfig(process.env);
  const passwordHash = await hashPassword(config.password);

  await prisma.$transaction(async (tx) => {
    const [existingMerchants, configuredOwner] = await Promise.all([
      tx.merchant.findMany({
        select: { id: true, ownerId: true, name: true, slug: true },
        orderBy: { id: "asc" },
      }),
      tx.user.findUnique({ where: { email: config.email } }),
    ]);
    if (existingMerchants.length > 1) {
      throw new Error("Bootstrap requires an installation database with at most one Merchant");
    }

    let owner = configuredOwner;
    let merchant = existingMerchants[0];
    if (!merchant) {
      if (owner) throw new Error("MERCHANT_OWNER_EMAIL already belongs to a user; refusing to change its role");
      owner = await tx.user.create({
        data: {
          email: config.email,
          passwordHash,
          role: "MERCHANT",
          staffRole: "OWNER",
          accountStatus: "ACTIVE",
        },
      });
      merchant = await tx.merchant.create({
        data: {
          ownerId: owner.id,
          name: config.name,
          slug: config.slug,
          isActive: true,
        },
        select: { id: true, ownerId: true, name: true, slug: true },
      });
    } else {
      const rootOwner = await tx.user.findUnique({ where: { id: merchant.ownerId } });
      if (
        merchant.name !== config.name || merchant.slug !== config.slug ||
        !rootOwner || rootOwner.email !== config.email || rootOwner.role !== "MERCHANT" ||
        (owner && owner.id !== rootOwner.id)
      ) {
        throw new Error("Existing Merchant does not match the configured installation owner and store");
      }
      owner = rootOwner;
    }

    await tx.loyaltyRule.upsert({
      where: { merchantId: merchant.id },
      create: { merchantId: merchant.id, vndPerPoint: 10_000, isActive: true },
      update: {},
    });
    for (const tier of baselineTiers) {
      await tx.loyaltyTier.upsert({
        where: { merchantId_level: { merchantId: merchant.id, level: tier.level } },
        create: { merchantId: merchant.id, ...tier },
        update: {},
      });
    }

    const policyExists = await tx.loyaltyPolicyVersion.findFirst({
      where: { merchantId: merchant.id },
      select: { id: true },
    });
    if (!policyExists) {
      await tx.loyaltyPolicyVersion.create({
        data: {
          merchantId: merchant.id,
          version: 1,
          vndPerPoint: 10_000,
          isActive: true,
          tiers: baselineTiers.map((tier) => ({ ...tier })) as Prisma.InputJsonValue,
          source: "MERCHANT_PUBLISH",
          publishedById: owner.id,
        },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.info("Merchant installation bootstrap is ready.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
