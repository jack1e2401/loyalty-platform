import type { RequestHandler } from "express";
import { HttpError } from "../../../lib/http-error.js";
import { readRouteId } from "../../commerce/products/products.validation.js";
import { getAnalyticsSummary } from "./analytics.summary.js";
import { getProductTable, type AnalyticsProductTable } from "./analytics.product-page.js";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { parseAnalyticsQuery } from "./analytics.domain.js";
import { getMerchantAnalytics } from "./analytics.service.js";

export const getAnalytics: RequestHandler = async (request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  const range = parseAnalyticsQuery(request.query as Record<string, unknown>);
  response.json(request.query.summary === "1"
    ? await getAnalyticsSummary(merchant.id, range)
    : await getMerchantAnalytics(merchant.id, range));
};

export const getAnalyticsProductTable: RequestHandler = async (request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  const table = request.params.table;
  if (typeof table !== "string" || !["top", "slow", "no-sales", "low-stock"].includes(table)) {
    throw new HttpError(400, "INVALID_INPUT");
  }
  const page = readRouteId(request.query.page ?? "1");
  const limit = readRouteId(request.query.limit ?? "20");
  if (page > 1_000_000 || limit > 100) throw new HttpError(400, "INVALID_INPUT");
  const range = parseAnalyticsQuery(request.query as Record<string, unknown>);
  response.json(await getProductTable(merchant.id, range, table as AnalyticsProductTable, page, limit));
};
