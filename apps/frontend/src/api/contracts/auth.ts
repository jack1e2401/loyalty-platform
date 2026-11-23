/** Exact JSON contract for member authentication and the seeded merchant owner. */
export type BackendRole = "MERCHANT" | "MEMBER";

export interface BackendUserDto {
  id: number;
  email: string;
  role: BackendRole;
  isActive: boolean;
}

export interface BackendMerchantDto {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: BackendUserDto;
}

export interface MemberRegistrationResponse {
  user: BackendUserDto;
}

export interface OwnMerchantResponse {
  merchant: BackendMerchantDto;
}

export interface BackendErrorResponse {
  error: string;
}

export const authPaths = {
  registerMember: "/api/auth/register/member",
  login: "/api/auth/login",
  refresh: "/api/auth/refresh",
  logout: "/api/auth/logout",
  ownMerchant: "/api/merchant/me",
} as const;
