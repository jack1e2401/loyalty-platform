import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";
import { initializeDefaultStorefrontTx } from "../src/modules/merchants/storefront/storefront.persistence.js";
import { isValidStoreSlug } from "../src/modules/merchants/storefront/storefront.slug.js";

const baselineTiers = [
  { level: "BRONZE" as const, minLifetimePoints: 0, multiplier: "1.00" },
  { level: "SILVER" as const, minLifetimePoints: 1_000, multiplier: "1.20" },
  { level: "GOLD" as const, minLifetimePoints: 5_000, multiplier: "1.50" },
  { level: "PLATINUM" as const, minLifetimePoints: 10_000, multiplier: "2.00" },
];

function readBootstrapConfig() {
  const email = process.env.MERCHANT_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.MERCHANT_OWNER_PASSWORD;
  const name = process.env.MERCHANT_NAME?.trim();
  const slug = process.env.MERCHANT_SLUG?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("MERCHANT_OWNER_EMAIL must be a valid email address");
  }
  if (!password || password.length < 12) {
    throw new Error("MERCHANT_OWNER_PASSWORD must have at least 12 characters");
  }
  if (!name || name.length > 191) throw new Error("MERCHANT_NAME must contain 1 to 191 characters");
  if (!slug || !isValidStoreSlug(slug)) throw new Error("MERCHANT_SLUG must be a valid store slug");
  return { email, password, name, slug };
}

async function main(): Promise<void> {
  const config = readBootstrapConfig();
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

    await initializeDefaultStorefrontTx(tx, {
      id: merchant.id,
      name: merchant.name,
      slug: merchant.slug,
    }, owner.id);
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
