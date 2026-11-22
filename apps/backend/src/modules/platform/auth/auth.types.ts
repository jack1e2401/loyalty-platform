import type { AccountStatus, UserRole } from "../../../generated/prisma/enums.js";

export type Credentials = { email: string; password: string };
export type UserDto = {
  id: number;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  isActive: boolean;
};

export type AuthenticatedUser = UserDto & { merchantIsActive: boolean | null };

export type MerchantDto = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
};

export type LoginIdentity = {
  user: UserDto;
  passwordHash: string;
  merchant: MerchantDto | null;
};
