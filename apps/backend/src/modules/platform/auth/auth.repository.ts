import { prisma } from "../../../lib/prisma.js";
import type { AuthenticatedUser, LoginIdentity, MerchantDto, UserDto } from "./auth.types.js";

const userSelection = {
  id: true,
  email: true,
  role: true,
  accountStatus: true,
} as const;

function toUserDto(user: { id: number; email: string; role: UserDto["role"]; accountStatus: UserDto["accountStatus"] }): UserDto {
  return { id: user.id, email: user.email, role: user.role, accountStatus: user.accountStatus, isActive: user.accountStatus === "ACTIVE" };
}

export const authRepository = {
  async createRefreshSession(input: { userId: number; familyId: string; tokenHash: string; expiresAt: Date }) {
    return prisma.refreshSession.create({ data: input, select: { id: true } });
  },

  async findRefreshSession(tokenHash: string) {
    return prisma.refreshSession.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });
  },

  async rotateRefreshSession(input: {
    currentId: number;
    userId: number;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
  }): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: { id: input.currentId, revokedAt: null, expiresAt: { gt: input.now } },
        data: { revokedAt: input.now },
      });
      if (revoked.count !== 1) return false;

      const replacement = await tx.refreshSession.create({
        data: {
          userId: input.userId,
          familyId: input.familyId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
        select: { id: true },
      });
      await tx.refreshSession.update({
        where: { id: input.currentId },
        data: { replacedById: replacement.id },
      });
      return true;
    }, { isolationLevel: "Serializable" });
  },

  async revokeRefreshFamily(familyId: string, now = new Date()): Promise<void> {
    await prisma.refreshSession.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
  },

  async createMember(email: string, passwordHash: string): Promise<UserDto> {
    const user = await prisma.user.create({
      data: { email, passwordHash, role: "MEMBER", accountStatus: "ACTIVE" },
      select: userSelection,
    });
    return toUserDto(user);
  },

  async findByEmail(email: string): Promise<LoginIdentity | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...userSelection,
        passwordHash: true,
        merchant: { select: { id: true, name: true, slug: true, isActive: true } },
      },
    });
    if (!user) return null;
    return {
      user: toUserDto(user),
      passwordHash: user.passwordHash,
      merchant: user.merchant as MerchantDto | null,
    };
  },

  async findUser(userId: number): Promise<AuthenticatedUser | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { ...userSelection, merchant: { select: { isActive: true } } },
    });
    if (!user) return null;
    return { ...toUserDto(user), merchantIsActive: user.merchant?.isActive ?? null };
  },
};
