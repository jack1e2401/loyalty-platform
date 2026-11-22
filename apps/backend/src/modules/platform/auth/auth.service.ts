import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "../../../lib/password.js";
import { HttpError } from "../../../lib/http-error.js";
import { signAccessToken } from "../../../lib/access-token.js";
import { authRepository } from "./auth.repository.js";
import type { Credentials, UserDto } from "./auth.types.js";
import { generateRefreshToken, hashRefreshToken, REFRESH_SESSION_TTL_MS } from "./refresh-session.js";

type AuthSessionResult = { accessToken: string; user: UserDto; refreshToken: string };

function assertEligible(user: Awaited<ReturnType<typeof authRepository.findUser>>): asserts user is NonNullable<typeof user> {
  if (!user) throw new HttpError(401, "INVALID_REFRESH_TOKEN");
  if (user.accountStatus === "SUSPENDED") throw new HttpError(403, "ACCOUNT_SUSPENDED");
  if (user.accountStatus === "BANNED") throw new HttpError(403, "ACCOUNT_BANNED");
  if (user.accountStatus === "PENDING_APPROVAL") throw new HttpError(403, "MERCHANT_PENDING");
  if (user.accountStatus === "REJECTED") throw new HttpError(403, "MERCHANT_REJECTED");
  if (!user.isActive) throw new HttpError(403, "ACCOUNT_INACTIVE");
  if (user.role === "MERCHANT" && user.merchantIsActive !== true) throw new HttpError(403, "MERCHANT_NOT_ACTIVE");
}

function isTransactionConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function createWithUniqueFields<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueConstraintError(error)) throw new HttpError(409, "EMAIL_TAKEN");
    throw error;
  }
}

export const authService = {
  async registerMember(input: Credentials): Promise<UserDto> {
    const passwordHash = await hashPassword(input.password);
    return createWithUniqueFields(() => authRepository.createMember(input.email, passwordHash));
  },

  async login(input: Credentials): Promise<AuthSessionResult> {
    const identity = await authRepository.findByEmail(input.email);
    if (!identity || !(await verifyPassword(input.password, identity.passwordHash))) {
      throw new HttpError(401, "INVALID_CREDENTIALS");
    }
    assertEligible(identity.user.role === "MERCHANT" ? {
      ...identity.user,
      merchantIsActive: identity.merchant?.isActive ?? null,
    } : { ...identity.user, merchantIsActive: null });

    const refreshToken = generateRefreshToken();
    const now = new Date();
    await authRepository.createRefreshSession({
      userId: identity.user.id,
      familyId: randomUUID(),
      tokenHash: hashRefreshToken(refreshToken),
      expiresAt: new Date(now.getTime() + REFRESH_SESSION_TTL_MS),
    });

    return {
      accessToken: await signAccessToken(identity.user.id),
      user: identity.user,
      refreshToken,
    };
  },

  async refresh(token: string): Promise<AuthSessionResult> {
    const current = await authRepository.findRefreshSession(hashRefreshToken(token));
    if (!current) throw new HttpError(401, "INVALID_REFRESH_TOKEN");

    const now = new Date();
    if (current.revokedAt || current.expiresAt <= now) {
      await authRepository.revokeRefreshFamily(current.familyId, now);
      throw new HttpError(401, "INVALID_REFRESH_TOKEN");
    }

    const identity = await authRepository.findUser(current.userId);
    try {
      assertEligible(identity);
    } catch (error) {
      await authRepository.revokeRefreshFamily(current.familyId, now);
      throw error;
    }

    const refreshToken = generateRefreshToken();
    try {
      const rotated = await authRepository.rotateRefreshSession({
        currentId: current.id,
        userId: current.userId,
        familyId: current.familyId,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(now.getTime() + REFRESH_SESSION_TTL_MS),
        now,
      });
      if (!rotated) {
        await authRepository.revokeRefreshFamily(current.familyId, now);
        throw new HttpError(401, "INVALID_REFRESH_TOKEN");
      }
    } catch (error) {
      if (isTransactionConflict(error)) {
        await authRepository.revokeRefreshFamily(current.familyId, now);
        throw new HttpError(401, "INVALID_REFRESH_TOKEN");
      }
      throw error;
    }

    const { merchantIsActive: _merchantIsActive, ...user } = identity;
    return { accessToken: await signAccessToken(user.id), user, refreshToken };
  },

  async logout(token: string | null): Promise<void> {
    if (!token) return;
    const current = await authRepository.findRefreshSession(hashRefreshToken(token));
    if (current) await authRepository.revokeRefreshFamily(current.familyId);
  },
};
