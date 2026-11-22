export { translateApiError } from "./commerce/shared";
import { createCatalogClient } from "./commerce/catalog";
import { createInventoryClient } from "./commerce/inventory";
import { createLoyaltyClient } from "./commerce/loyalty";
import { createMerchantsClient } from "./commerce/merchants";
import { createOrdersClient } from "./commerce/orders";
import { createVouchersClient } from "./commerce/vouchers";

export function createCommerceClient(baseUrl = "", fetcher: typeof fetch = fetch) {
  return {
    ...createCatalogClient(baseUrl, fetcher),
    ...createInventoryClient(baseUrl, fetcher),
    ...createLoyaltyClient(baseUrl, fetcher),
    ...createMerchantsClient(baseUrl, fetcher),
    ...createOrdersClient(baseUrl, fetcher),
    ...createVouchersClient(baseUrl, fetcher),
  };
}
