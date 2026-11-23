import { isValidStoreSlug } from "../src/modules/merchants/storefront/storefront.slug.js";

export type MerchantBootstrapConfig = {
  email: string;
  password: string;
  name: string;
  slug: string;
};

export function readBootstrapConfig(
  source: NodeJS.ProcessEnv = process.env,
): MerchantBootstrapConfig {
  const email = source.MERCHANT_OWNER_EMAIL?.trim().toLowerCase();
  const password = source.MERCHANT_OWNER_PASSWORD;
  const name = source.MERCHANT_NAME?.trim();
  const slug = source.MERCHANT_SLUG?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("MERCHANT_OWNER_EMAIL must be a valid email address");
  }
  if (!password || password.length < 12) {
    throw new Error("MERCHANT_OWNER_PASSWORD must have at least 12 characters");
  }
  if (password.length > 128) {
    throw new Error("MERCHANT_OWNER_PASSWORD must have at most 128 characters");
  }
  if (!name || name.length > 191)
    throw new Error("MERCHANT_NAME must contain 1 to 191 characters");
  if (!slug || !isValidStoreSlug(slug))
    throw new Error("MERCHANT_SLUG must be a valid store slug");
  return { email, password, name, slug };
}
