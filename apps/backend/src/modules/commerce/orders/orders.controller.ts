import type { RequestHandler } from "express";
import { readRouteId } from "../products/products.validation.js";
import { ordersService } from "./orders.service.js";
import { readCreateOrderInput } from "./orders.validation.js";
import { HttpError } from "../../../lib/http-error.js";
import { OrderNotCancellableError } from "./orders.types.js";

export const createOrder: RequestHandler = async (request, response) => {
  const input = readCreateOrderInput(request.body);
  const key = request.get("Idempotency-Key");
  if (!key || key.length < 8 || key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) throw new HttpError(400, "IDEMPOTENCY_KEY_REQUIRED");
  const result = await ordersService.createOrder(response.locals.user.id, input, key);
  response.status(result.replayed ? 200 : 201).json({ order: result.order });
};

export const payOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId);
  const order = await ordersService.payOrder(response.locals.user.id, orderId);
  response.json({ order });
};

export const listMemberOrders: RequestHandler = async (request, response) => {
  const merchantId = readRouteId(request.query.merchantId);
  const orders = await ordersService.listMemberOrders(response.locals.user.id, merchantId);
  response.json({ orders });
};

export const getMemberOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId!);
  const order = await ordersService.getMemberOrder(response.locals.user.id, orderId);
  response.json({ order });
};

export const listMerchantOrders: RequestHandler = async (request, response) => {
  if (request.query.page !== undefined || request.query.limit !== undefined) {
    const page = Number(request.query.page ?? 1);
    const limit = Number(request.query.limit ?? 20);
    const search = request.query.q ?? "";
    const status = request.query.status ?? "";
    if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000 ||
        !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
        typeof search !== "string" || search.length > 191 ||
        typeof status !== "string" || (status && !["PENDING", "PAID", "FAILED", "CANCELLED", "REFUND_PENDING", "REFUNDED"].includes(status))) {
      throw new HttpError(400, "INVALID_INPUT");
    }
    response.json(await ordersService.listMerchantOrdersPage(response.locals.user.id, page, limit, search.trim().replace(/^#/, ""), status));
    return;
  }
  const orders = await ordersService.listMerchantOrders(response.locals.user.id);
  response.json({ orders });
};

export const getMerchantOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId!);
  const paging = request.query.page === undefined && request.query.limit === undefined ? undefined : {
    page: readRouteId(request.query.page ?? "1"), limit: readRouteId(request.query.limit ?? "20"),
  };
  if (paging && (paging.page > 1_000_000 || paging.limit > 100)) throw new HttpError(400, "INVALID_INPUT");
  response.json(await ordersService.getMerchantOrder(response.locals.user.id, orderId, paging));
};

export const cancelOrder: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId);
  try {
    const result = await ordersService.cancelOrder(response.locals.user.id, orderId);
    response.json(result);
  } catch (error: unknown) {
    if (error instanceof OrderNotCancellableError) {
      response.status(409).json({
        error: "ORDER_NOT_CANCELLABLE",
        orderStatus: error.orderStatus,
      });
      return;
    }
    throw error;
  }
};

export const getRefundPreview: RequestHandler = async (request, response) => {
  const orderId = readRouteId(request.params.orderId);
  const preview = await ordersService.getRefundPreview(response.locals.user.id, orderId);
  response.json(preview);
};

export const refundOrder: RequestHandler = async (request, response) => {
  void request;
  void response;
  throw new HttpError(409, "USE_REFUND_APPROVAL_WORKFLOW");
};
