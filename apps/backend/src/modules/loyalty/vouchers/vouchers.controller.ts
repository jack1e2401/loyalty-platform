import type { RequestHandler } from "express";
import { HttpError } from "../../../lib/http-error.js";
import { vouchersService } from "./vouchers.service.js";
import { readDefinitionInput, readDefinitionPatch, readFulfillmentNote, readIdempotencyKey, readCancellationReason } from "./vouchers.validation.js";

function readId(value: string): number {
  if (!/^[1-9][0-9]*$/.test(value)) throw new HttpError(400, "INVALID_INPUT");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id > 2_147_483_647) throw new HttpError(400, "INVALID_INPUT");
  return id;
}
function param(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}
export const listMerchantDefinitions: RequestHandler = async (request, response) => {
  if (request.query.page !== undefined || request.query.limit !== undefined) {
    const page = readId(param(request.query.page === undefined ? "1" : request.query.page as string | string[]));
    const limit = readId(param(request.query.limit === undefined ? "20" : request.query.limit as string | string[]));
    if (page > 1_000_000 || limit > 100) throw new HttpError(400, "INVALID_INPUT");
    const { q, type, status, sort } = request.query;
    if ((q !== undefined && (typeof q !== "string" || q.trim().length > 191)) ||
        (type !== undefined && type !== "DISCOUNT" && type !== "REWARD") ||
        (status !== undefined && status !== "active" && status !== "inactive") ||
        (sort !== undefined && sort !== "newest" && sort !== "name" && sort !== "points")) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    response.json(await vouchersService.listMerchantDefinitionsPage(response.locals.user.id, {
      page, limit, q: typeof q === "string" ? q.trim() : undefined, type, status, sort,
    }));
    return;
  }
  response.json({ definitions: await vouchersService.listMerchantDefinitions(response.locals.user.id) });
};
export const createDefinition: RequestHandler = async (request, response) => {
  const definition = await vouchersService.createDefinition(response.locals.user.id, readDefinitionInput(request.body));
  response.status(201).json({ definition });
};
export const updateDefinition: RequestHandler = async (request, response) => {
  const definition = await vouchersService.updateDefinition(response.locals.user.id, readId(param(request.params.id)), readDefinitionPatch(request.body));
  response.json({ definition });
};
export const listPublicDefinitions: RequestHandler = async (request, response) => {
  const definitions = await vouchersService.listPublicDefinitions(readId(param(request.params.merchantId)));
  response.json({ definitions });
};
export const listOwnedVouchers: RequestHandler = async (request, response) => {
  const vouchers = await vouchersService.listOwnedVouchers(response.locals.user.id, readId(param(request.params.merchantId)));
  response.json({ vouchers });
};
export const redeemVoucher: RequestHandler = async (request, response) => {
  const idempotencyKey = readIdempotencyKey(request.header("Idempotency-Key") ?? request.header("idempotency-key"));
  const result = await vouchersService.redeemVoucher(
    response.locals.user.id,
    readId(param(request.params.definitionId)),
    idempotencyKey,
  );
  response.status(201).json(result);
};
export const listRewardFulfillments: RequestHandler = async (_request, response) => {
  response.json({ rewards: await vouchersService.listRewardFulfillments(response.locals.user.id) });
};
export const fulfillReward: RequestHandler = async (request, response) => {
  const reward = await vouchersService.fulfillReward(response.locals.user.id, readId(param(request.params.memberVoucherId)), readFulfillmentNote(request.body));
  response.json({ reward });
};
export const cancelReward: RequestHandler = async (request, response) => {
  const reason = readCancellationReason(request.body);
  const result = await vouchersService.cancelReward(
    response.locals.user.id,
    readId(param(request.params.memberVoucherId)),
    reason,
  );
  response.json(result);
};
