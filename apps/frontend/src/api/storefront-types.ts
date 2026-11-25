export type StorefrontSectionKey =
  | "hero"
  | "featured_products"
  | "categories"
  | "upcoming_events"
  | "store_info"
  | "footer";

export interface StorefrontSectionConfig {
  key: StorefrontSectionKey;
  enabled: boolean;
  order: number;
  title?: string | null;
  subtitle?: string | null;
}

export interface StorefrontAllowedLink {
  label: string;
  url: string;
}

export type StorefrontWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface StorefrontOpeningHoursDay {
  day: StorefrontWeekday;
  closed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface StorefrontBrandingConfig {
  logoUrl: string | null;
  storeImageUrl?: string | null;
  bannerUrl: string | null;
  primaryColor: string;
  heroTitle: string;
  heroDescription: string | null;
  heroImageUrl: string | null;
  heroCtaText: string | null;
  heroCtaLink: string | null;
  footerDescription: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  openingHours?: StorefrontOpeningHoursDay[] | null;
  allowedLinks: StorefrontAllowedLink[];
}

export interface StorefrontConfig {
  branding: StorefrontBrandingConfig;
  sections: StorefrontSectionConfig[];
  featuredProductIds: number[];
}

export interface StorefrontMerchantSummaryDto {
  id: number;
  name: string;
  slug: string;
}

export interface StorefrontCategoryDto {
  id: number;
  merchantId: number;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface StorefrontEventDto {
  id: number;
  merchantId: number;
  title: string;
  slug: string;
  description: string;
  bannerUrl: string | null;
  startAt: string;
  endAt: string;
  locationName: string;
  locationAddress: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
}

export interface StorefrontProductDto {
  id: number;
  merchantId: number;
  categoryId: number | null;
  category: { id: number; name: string; slug: string } | null;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  kind: "SALE" | "REWARD";
  status: "ACTIVE" | "HIDDEN";
  price: string;
  inventory: { availableQuantity: number };
}

export interface MerchantStorefrontStateResponse {
  merchant: StorefrontMerchantSummaryDto & { isActive: boolean };
  config: StorefrontConfig;
}

export interface PublicStorefrontResponse {
  merchant: StorefrontMerchantSummaryDto;
  config: StorefrontConfig;
  featuredProducts: StorefrontProductDto[];
  categories: StorefrontCategoryDto[];
  upcomingEvents: StorefrontEventDto[];
}

export interface UploadedMediaResponse {
  url: string;
  mimeType: string;
  size: number;
}


export type StoreProfile = Pick<StorefrontBrandingConfig,
  "logoUrl" | "storeImageUrl" | "footerDescription" | "contactEmail" | "contactPhone" | "address" | "openingHours"
>;

export type StoreProfileResponse = {
  merchant: StorefrontMerchantSummaryDto & { isActive: boolean };
  profile: StoreProfile;
  counts: { members: number; monthlyOrders: number; activeProducts: number };
};
