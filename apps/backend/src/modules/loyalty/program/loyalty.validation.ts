import { HttpError } from "../../../lib/http-error.js";
import type { LoyaltyConfigInput, LoyaltyTierInput, TierResetConfigInput } from "./loyalty.types.js";
import type { TierQualificationMode } from "./loyalty.calculation.js";

const maxInt = 2147483647;
const maxVnd = "999999999999999";

function invalid(): never {
  throw new HttpError(400, "INVALID_INPUT");
}

function validOptionalImageUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 512) return false;
  return value.startsWith("/uploads/") || value.startsWith("/images/") || value.startsWith("https://");
}

function validVnd(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,15}$/.test(value) && value.length <= maxVnd.length && (value.length < maxVnd.length || value <= maxVnd);
}

function ascendingVnd(current: string, previous: string): boolean {
  return current.length > previous.length || (current.length === previous.length && current > previous);
}

function parseReset(value: unknown): TierResetConfigInput {
  if (value === undefined) return { enabled: false, month: 1, day: 1, strategy: "ONE_DOWN", targetLevel: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const reset = value as Record<string, unknown>;
  if (typeof reset.enabled !== "boolean" || !Number.isInteger(reset.month) || (reset.month as number) < 1 || (reset.month as number) > 12 ||
    !Number.isInteger(reset.day) || (reset.day as number) < 1 || (reset.day as number) > 31 ||
    (reset.strategy !== "ONE_DOWN" && reset.strategy !== "SELECTED") ||
    (reset.targetLevel !== null && (typeof reset.targetLevel !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(reset.targetLevel)))) invalid();
  if (reset.strategy === "SELECTED" && !reset.targetLevel) invalid();
  return { enabled: reset.enabled, month: reset.month as number, day: reset.day as number, strategy: reset.strategy, targetLevel: reset.targetLevel as string | null };
}

export function parseConfig(value: unknown): LoyaltyConfigInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const input = value as Record<string, unknown>;
  if (!Number.isInteger(input.vndPerPoint) || (input.vndPerPoint as number) <= 0 || (input.vndPerPoint as number) > maxInt || typeof input.isActive !== "boolean") invalid();
  if (input.publishAsNewVersion !== undefined && typeof input.publishAsNewVersion !== "boolean") invalid();
  if (input.qualificationMode !== "POINTS" && input.qualificationMode !== "SPEND") invalid();
  const mode = input.qualificationMode as TierQualificationMode;
  if (!Array.isArray(input.tiers) || input.tiers.length < 1 || input.tiers.length > 100) invalid();

  const rawTiers = input.tiers as unknown[];
  const codes = new Set<string>();
  const names = new Set<string>();
  let previousThreshold = "0";
  const tiers = rawTiers.map((value, index): LoyaltyTierInput => {
    if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
    const tier = value as Record<string, unknown>;
    const code = typeof tier.level === "string" ? tier.level.trim() : "";
    const name = typeof tier.name === "string" ? tier.name.trim() : "";
    const normalizedName = name.toLocaleLowerCase("vi-VN");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code) || code.length > 64 || !name || name.length > 80 || codes.has(code) || names.has(normalizedName)) invalid();
    if (index === 0 && code !== "default" || index > 0 && code === "default") invalid();
    codes.add(code);
    names.add(normalizedName);

    const threshold = mode === "POINTS" ? tier.minLifetimePoints : tier.minSpendVnd;
    if (mode === "POINTS") {
      if (!Number.isInteger(threshold) || (threshold as number) < 0 || (threshold as number) > maxInt || tier.minSpendVnd !== undefined) invalid();
      if (index === 0 && threshold !== 0 || index > 0 && (threshold as number) <= Number(previousThreshold)) invalid();
      previousThreshold = String(threshold);
    } else {
      if (!validVnd(threshold) || tier.minLifetimePoints !== undefined) invalid();
      if (index === 0 && threshold !== "0" || index > 0 && !ascendingVnd(threshold, previousThreshold)) invalid();
      previousThreshold = threshold;
    }
    if (typeof tier.multiplier !== "string" || !/^\d{1,3}\.\d{2}$/.test(tier.multiplier) || Number(tier.multiplier) <= 0) invalid();
    if (!Array.isArray(tier.benefits) || tier.benefits.length > 12 || tier.benefits.some((item) => typeof item !== "string" || !item.trim() || item.length > 255)) invalid();
    if (!validOptionalImageUrl(tier.iconUrl) || typeof tier.color !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(tier.color)) invalid();
    if (tier.maintenanceSpendVnd !== null && !validVnd(tier.maintenanceSpendVnd)) invalid();
    if (tier.sortOrder !== undefined && tier.sortOrder !== index || tier.isActive !== undefined && tier.isActive !== true) invalid();

    return {
      level: code,
      name,
      ...(mode === "POINTS" ? { minLifetimePoints: threshold as number } : { minSpendVnd: threshold as string }),
      multiplier: tier.multiplier,
      benefits: (tier.benefits as string[]).map((item) => item.trim()),
      iconUrl: tier.iconUrl,
      color: tier.color,
      maintenanceSpendVnd: tier.maintenanceSpendVnd as string | null,
      sortOrder: index,
      isActive: true,
    };
  });
  const reset = parseReset(input.reset);
  if (reset.targetLevel && !codes.has(reset.targetLevel)) invalid();
  return {
    ...(input.publishAsNewVersion === true ? { publishAsNewVersion: true } : {}),
    vndPerPoint: input.vndPerPoint as number,
    isActive: input.isActive,
    qualificationMode: mode,
    tiers,
    reset,
  };
}
