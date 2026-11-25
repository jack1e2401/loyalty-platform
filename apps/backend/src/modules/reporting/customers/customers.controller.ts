import type { RequestHandler } from "express";
import { HttpError } from "../../../lib/http-error.js";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { readRouteId } from "../../commerce/products/products.validation.js";
import { parseCustomerListQuery } from "./customers.domain.js";
import { getMerchantCustomerDetail, listMerchantCustomers } from "./customers.service.js";

export const listCustomers: RequestHandler = async (request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  const query = parseCustomerListQuery(request.query as Record<string, unknown>);
  response.json(await listMerchantCustomers(merchant.id, query));
};

export const getCustomerDetail: RequestHandler = async (request, response) => {
  const merchant = await merchantService.getOwnStore(response.locals.user.id);
  const memberId = readRouteId(request.params.memberId);
  const names = ["orders", "pointLedger", "vouchers"] as const;
  const pagination = request.query.paged === "1"
    ? Object.fromEntries(names.map((name) => {
        const page = readRouteId(request.query[`${name}Page`] ?? "1");
        const limit = readRouteId(request.query[`${name}Limit`] ?? "20");
        if (page > 1_000_000 || limit > 100) throw new HttpError(400, "INVALID_INPUT");
        return [name, { page, limit }];
      })) as Record<(typeof names)[number], { page: number; limit: number }>
    : undefined;
  response.json(await getMerchantCustomerDetail(merchant.id, memberId, pagination));
};
