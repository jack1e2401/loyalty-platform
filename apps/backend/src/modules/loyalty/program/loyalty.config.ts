import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../lib/prisma.js";
import { withTransactionRetry } from "../../../lib/prisma-transaction.js";
import type { TierQualificationMode, TierThreshold } from "./loyalty.calculation.js";
import type { LoyaltyConfigDto, LoyaltyConfigInput, LoyaltyTierDto } from "./loyalty.types.js";

type StoredTier = {
  id: number;
  level: string;
  name: string;
  minLifetimePoints: number | null;
  minSpendVnd: Prisma.Decimal | null;
  sortOrder: number;
  multiplier: Prisma.Decimal;
  benefits: Prisma.JsonValue;
  iconUrl: string | null;
  color: string;
  maintenanceSpendVnd: Prisma.Decimal | null;
  isActive: boolean;
};

type PolicyTier = TierThreshold & {
  name: string;
  multiplier: Prisma.Decimal | string;
  benefits: string[];
  iconUrl: string | null;
  color: string;
  maintenanceSpendVnd: string | null;
};

type EarningPolicy = {
  vndPerPoint: number;
  isActive: boolean;
  qualificationMode: TierQualificationMode;
  tiers: StoredTier[];
  policyVersion: Prisma.LoyaltyPolicyVersionGetPayload<{}>;
};

export const defaultTiers: LoyaltyTierDto[] = [
  { level: "default", name: "Default", minLifetimePoints: 0, multiplier: "1.00", benefits: [], iconUrl: null, color: "#6B7280", maintenanceSpendVnd: null, sortOrder: 0, isActive: true },
  { level: "silver", name: "Silver", minLifetimePoints: 1000, multiplier: "1.20", benefits: [], iconUrl: null, color: "#8A949D", maintenanceSpendVnd: null, sortOrder: 1, isActive: true },
  { level: "gold", name: "Gold", minLifetimePoints: 5000, multiplier: "1.50", benefits: [], iconUrl: null, color: "#C6912D", maintenanceSpendVnd: null, sortOrder: 2, isActive: true },
  { level: "platinum", name: "Platinum", minLifetimePoints: 10000, multiplier: "2.00", benefits: [], iconUrl: null, color: "#5B6F8D", maintenanceSpendVnd: null, sortOrder: 3, isActive: true },
];

function decimal(value: Prisma.Decimal | string | null | undefined): string | null {
  return value == null ? null : typeof value === "string" ? value : value.toFixed(0);
}

function benefits(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function tierDto(tier: StoredTier | LoyaltyTierDto, mode: TierQualificationMode): LoyaltyTierDto {
  return {
    level: tier.level,
    name: tier.name,
    ...(mode === "POINTS" ? { minLifetimePoints: tier.minLifetimePoints ?? 0 } : { minSpendVnd: decimal(tier.minSpendVnd) ?? "0" }),
    multiplier: typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2),
    benefits: "benefits" in tier && Array.isArray(tier.benefits) ? benefits(tier.benefits as Prisma.JsonValue) : [],
    iconUrl: tier.iconUrl,
    color: tier.color,
    maintenanceSpendVnd: decimal(tier.maintenanceSpendVnd),
    sortOrder: tier.sortOrder,
    isActive: tier.isActive,
  };
}

function jsonTiers(tiers: readonly PolicyTier[]): Prisma.InputJsonObject[] {
  return tiers.map((tier) => ({
    level: tier.level,
    name: tier.name,
    ...(tier.minLifetimePoints !== undefined && tier.minLifetimePoints !== null ? { minLifetimePoints: tier.minLifetimePoints } : {}),
    ...(tier.minSpendVnd !== undefined && tier.minSpendVnd !== null ? { minSpendVnd: String(tier.minSpendVnd) } : {}),
    sortOrder: tier.sortOrder ?? 0,
    multiplier: typeof tier.multiplier === "string" ? tier.multiplier : tier.multiplier.toFixed(2),
    benefits: tier.benefits,
    iconUrl: tier.iconUrl,
    color: tier.color,
    maintenanceSpendVnd: tier.maintenanceSpendVnd,
  }));
}

function fromStored(tier: StoredTier): PolicyTier {
  return {
    level: tier.level,
    name: tier.name,
    ...(tier.minLifetimePoints !== null ? { minLifetimePoints: tier.minLifetimePoints } : {}),
    ...(tier.minSpendVnd !== null ? { minSpendVnd: tier.minSpendVnd.toFixed(0) } : {}),
    sortOrder: tier.sortOrder,
    multiplier: tier.multiplier,
    benefits: benefits(tier.benefits),
    iconUrl: tier.iconUrl,
    color: tier.color,
    maintenanceSpendVnd: decimal(tier.maintenanceSpendVnd),
    isActive: tier.isActive,
  };
}

export async function loadEarningPolicy(tx: Prisma.TransactionClient, merchantId: number): Promise<EarningPolicy> {
  const [rule, configured] = await Promise.all([
    tx.loyaltyRule.findUnique({ where: { merchantId } }),
    tx.loyaltyTier.findMany({ where: { merchantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const mode = (rule?.qualificationMode ?? "POINTS") as TierQualificationMode;
  let tiers: StoredTier[] = configured;
  if (tiers.length === 0) {
    for (const [index, tier] of defaultTiers.entries()) {
      await tx.loyaltyTier.upsert({
        where: { merchantId_level: { merchantId, level: tier.level } },
        create: {
          merchantId,
          level: tier.level,
          name: tier.name,
          minLifetimePoints: tier.minLifetimePoints,
          minSpendVnd: tier.minSpendVnd ? new Prisma.Decimal(tier.minSpendVnd) : null,
          sortOrder: index,
          multiplier: new Prisma.Decimal(tier.multiplier),
          benefits: tier.benefits as Prisma.InputJsonValue,
          iconUrl: tier.iconUrl,
          color: tier.color,
          maintenanceSpendVnd: null,
        },
        update: {},
      });
    }
    tiers = await tx.loyaltyTier.findMany({ where: { merchantId, isActive: true }, orderBy: { sortOrder: "asc" } });
  }
  const policy = {
    vndPerPoint: rule?.vndPerPoint ?? 10000,
    isActive: rule?.isActive ?? true,
    qualificationMode: mode,
    tiers,
  };
  let version = await tx.loyaltyPolicyVersion.findFirst({ where: { merchantId }, orderBy: { version: "desc" } });
  if (!version) {
    version = await tx.loyaltyPolicyVersion.create({
      data: {
        merchantId,
        version: 1,
        vndPerPoint: policy.vndPerPoint,
        isActive: policy.isActive,
        tiers: jsonTiers(tiers.map(fromStored)),
        source: "LEGACY_BACKFILL",
      },
    });
  }
  return { ...policy, policyVersion: version };
}

function configMatches(current: { vndPerPoint: number; isActive: boolean; qualificationMode: TierQualificationMode; resetEnabled: boolean; resetMonth: number | null; resetDay: number | null; resetStrategy: string; resetTargetLevel: string | null; tiers: StoredTier[] }, input: LoyaltyConfigInput) {
  if (current.vndPerPoint !== input.vndPerPoint || current.isActive !== input.isActive || current.qualificationMode !== input.qualificationMode ||
    current.resetEnabled !== input.reset.enabled || current.resetMonth !== input.reset.month || current.resetDay !== input.reset.day ||
    current.resetStrategy !== input.reset.strategy || current.resetTargetLevel !== input.reset.targetLevel || current.tiers.length !== input.tiers.length) return false;
  const byLevel = new Map(current.tiers.map((tier) => [tier.level, tier]));
  return input.tiers.every((tier) => {
    const old = byLevel.get(tier.level);
    return old !== undefined && old.name === tier.name && old.minLifetimePoints === (tier.minLifetimePoints ?? null) &&
      (old.minSpendVnd?.toFixed(0) ?? null) === (tier.minSpendVnd ?? null) && old.sortOrder === tier.sortOrder &&
      old.multiplier.equals(tier.multiplier) && JSON.stringify(benefits(old.benefits)) === JSON.stringify(tier.benefits) &&
      old.iconUrl === tier.iconUrl && old.color === tier.color &&
      (old.maintenanceSpendVnd?.toFixed(0) ?? null) === tier.maintenanceSpendVnd && old.isActive === tier.isActive;
  });
}

export const loyaltyConfigRepository = {
  async getConfig(merchantId: number): Promise<LoyaltyConfigDto> {
    const [rule, tiers] = await Promise.all([
      prisma.loyaltyRule.findUnique({ where: { merchantId } }),
      prisma.loyaltyTier.findMany({ where: { merchantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    const mode = (rule?.qualificationMode ?? "POINTS") as TierQualificationMode;
    return {
      merchantId,
      vndPerPoint: rule?.vndPerPoint ?? 10000,
      isActive: rule?.isActive ?? true,
      qualificationMode: mode,
      tiers: tiers.length ? tiers.map((tier) => tierDto(tier, mode)) : defaultTiers,
      reset: {
        enabled: rule?.resetEnabled ?? false,
        month: rule?.resetMonth ?? 1,
        day: rule?.resetDay ?? 1,
        strategy: rule?.resetStrategy ?? "ONE_DOWN",
        targetLevel: rule?.resetTargetLevel ?? null,
      },
    };
  },

  async saveConfig(merchantId: number, publishedById: number, input: LoyaltyConfigInput): Promise<LoyaltyConfigDto> {
    await withTransactionRetry(() => prisma.$transaction(async (tx) => {
      const [currentRule, currentTiers, latest] = await Promise.all([
        tx.loyaltyRule.findUnique({ where: { merchantId } }),
        tx.loyaltyTier.findMany({ where: { merchantId, isActive: true }, orderBy: { sortOrder: "asc" } }),
        tx.loyaltyPolicyVersion.findFirst({ where: { merchantId }, orderBy: { version: "desc" } }),
      ]);
      const wasUnchanged = currentRule !== null && configMatches({
        vndPerPoint: currentRule.vndPerPoint,
        isActive: currentRule.isActive,
        qualificationMode: currentRule.qualificationMode,
        resetEnabled: currentRule.resetEnabled,
        resetMonth: currentRule.resetMonth,
        resetDay: currentRule.resetDay,
        resetStrategy: currentRule.resetStrategy,
        resetTargetLevel: currentRule.resetTargetLevel,
        tiers: currentTiers,
      }, input);
      await tx.loyaltyRule.upsert({
        where: { merchantId },
        create: {
          merchantId, vndPerPoint: input.vndPerPoint, isActive: input.isActive, qualificationMode: input.qualificationMode,
          resetEnabled: input.reset.enabled, resetMonth: input.reset.month, resetDay: input.reset.day,
          resetStrategy: input.reset.strategy, resetTargetLevel: input.reset.targetLevel,
        },
        update: {
          vndPerPoint: input.vndPerPoint, isActive: input.isActive, qualificationMode: input.qualificationMode,
          resetEnabled: input.reset.enabled, resetMonth: input.reset.month, resetDay: input.reset.day,
          resetStrategy: input.reset.strategy, resetTargetLevel: input.reset.targetLevel,
        },
      });
      const activeLevels = input.tiers.map(({ level }) => level);
      await tx.loyaltyTier.updateMany({ where: { merchantId, level: { notIn: activeLevels } }, data: { isActive: false } });
      for (const tier of input.tiers) {
        await tx.loyaltyTier.upsert({
          where: { merchantId_level: { merchantId, level: tier.level } },
          create: {
            merchantId,
            level: tier.level,
            name: tier.name,
            minLifetimePoints: tier.minLifetimePoints ?? null,
            minSpendVnd: tier.minSpendVnd ? new Prisma.Decimal(tier.minSpendVnd) : null,
            sortOrder: tier.sortOrder,
            multiplier: new Prisma.Decimal(tier.multiplier),
            benefits: tier.benefits as Prisma.InputJsonValue,
            iconUrl: tier.iconUrl,
            color: tier.color,
            maintenanceSpendVnd: tier.maintenanceSpendVnd ? new Prisma.Decimal(tier.maintenanceSpendVnd) : null,
            isActive: tier.isActive,
          },
          update: {
            name: tier.name,
            minLifetimePoints: tier.minLifetimePoints ?? null,
            minSpendVnd: tier.minSpendVnd ? new Prisma.Decimal(tier.minSpendVnd) : null,
            sortOrder: tier.sortOrder,
            multiplier: new Prisma.Decimal(tier.multiplier),
            benefits: tier.benefits as Prisma.InputJsonValue,
            iconUrl: tier.iconUrl,
            color: tier.color,
            maintenanceSpendVnd: tier.maintenanceSpendVnd ? new Prisma.Decimal(tier.maintenanceSpendVnd) : null,
            isActive: tier.isActive,
          },
        });
      }
      if (!wasUnchanged || !latest || input.publishAsNewVersion === true) {
        await tx.loyaltyPolicyVersion.create({
          data: {
            merchantId,
            version: (latest?.version ?? 0) + 1,
            vndPerPoint: input.vndPerPoint,
            isActive: input.isActive,
            qualificationMode: input.qualificationMode,
            resetEnabled: input.reset.enabled,
            resetMonth: input.reset.month,
            resetDay: input.reset.day,
            resetStrategy: input.reset.strategy,
            resetTargetLevel: input.reset.targetLevel,
            tiers: jsonTiers(input.tiers),
            source: "MERCHANT_PUBLISH",
            publishedById,
          },
        });
      }
    }, { isolationLevel: "Serializable" }));
    return this.getConfig(merchantId);
  },

  async countHistory(merchantId: number) {
    return prisma.loyaltyPolicyVersion.count({ where: { merchantId } });
  },

  async listHistory(merchantId: number, paging?: { page: number; limit: number }) {
    const versions = await prisma.loyaltyPolicyVersion.findMany({
      where: { merchantId },
      include: { publishedBy: { select: { email: true } } },
      orderBy: [{ version: "desc" }],
      ...(paging ? { skip: (paging.page - 1) * paging.limit, take: paging.limit } : {}),
    });
    return versions.map((version, index) => ({
      id: version.id,
      version: version.version,
      vndPerPoint: version.vndPerPoint,
      isActive: version.isActive,
      qualificationMode: version.qualificationMode,
      reset: version.resetEnabled === null ? null : {
        enabled: version.resetEnabled,
        month: version.resetMonth,
        day: version.resetDay,
        strategy: version.resetStrategy,
        targetLevel: version.resetTargetLevel,
      },
      tiers: version.tiers,
      source: version.source,
      publishedAt: version.publishedAt.toISOString(),
      publishedById: version.publishedById,
      publishedByEmail: version.publishedBy?.email ?? null,
      isCurrent: index === 0 && (!paging || paging.page === 1),
    }));
  },
};
