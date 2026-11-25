import type { RequestHandler } from "express";
import { HttpError } from "../../../lib/http-error.js";
import { refundsService } from "./refunds.service.js";
import { merchantService } from "../../merchants/profile/merchant.service.js";
import { readRouteId } from "../products/products.validation.js";
export const createRefundRequest: RequestHandler = async (req, res) => res.status(201).json({ refundRequest: await refundsService.request(res.locals.user.id, readRouteId(req.params.orderId), req.body?.reason) });
export const getMemberRefundRequest: RequestHandler = async (req, res) => res.json({ refundRequest: await refundsService.getMember(res.locals.user.id, readRouteId(req.params.orderId)) });
export const listMerchantRefundRequests: RequestHandler = async (req, res) => res.json(await refundsService.listMerchant(res.locals.user.id, req.query));
export const merchantRefundRequestDetail: RequestHandler = async (req, res) => {
  const merchant = await merchantService.getOwnStore(res.locals.user.id);
  const paging = req.query.page === undefined && req.query.limit === undefined ? undefined : {
    page: readRouteId(req.query.page ?? "1"), limit: readRouteId(req.query.limit ?? "20"),
  };
  const challengePaging = req.query.challengePage === undefined && req.query.challengeLimit === undefined ? undefined : {
    page: readRouteId(req.query.challengePage ?? "1"), limit: readRouteId(req.query.challengeLimit ?? "20"),
  };
  if ((paging && (paging.page > 1_000_000 || paging.limit > 100)) ||
      (challengePaging && (challengePaging.page > 1_000_000 || challengePaging.limit > 100))) throw new HttpError(400, "INVALID_INPUT");
  res.json(await refundsService.detail(readRouteId(req.params.requestId), merchant.id, paging, challengePaging));
};
export const merchantApproveRefundRequest: RequestHandler = async (req, res) => res.json(await refundsService.merchantApprove(res.locals.user.id, readRouteId(req.params.requestId), req.body?.note));
export const merchantReconcileRefundRequest: RequestHandler = async (req, res) => res.json(await refundsService.merchantReconcile(res.locals.user.id, readRouteId(req.params.requestId), req.body));
export const merchantRejectRefundRequest: RequestHandler = async (req, res) => res.json({ refundRequest: await refundsService.merchantReject(res.locals.user.id, readRouteId(req.params.requestId), req.body?.reason) });
