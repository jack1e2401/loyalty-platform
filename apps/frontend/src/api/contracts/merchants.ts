import type { BackendMerchantDto } from "./auth";

export type MerchantDirectoryItem = {
  id: number;
  name: string;
  slug: string;
  isActive?: boolean;
  coverImageUrl?: string | null;
};

export type MerchantDirectoryResponse = { merchants: MerchantDirectoryItem[] };

export type OwnMerchantResponse = { merchant: BackendMerchantDto };
