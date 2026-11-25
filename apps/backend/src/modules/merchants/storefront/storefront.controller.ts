import type { RequestHandler } from "express";
import { storefrontService } from "./storefront.service.js";
import { getStoreProfile, updateStoreProfile } from "./storefront.profile.js";
import { readStoreProfileUpdate, readStorefrontConfig } from "./storefront.validation.js";

export const getMerchantStoreProfile: RequestHandler = async (_request, response) => {
  response.json(await getStoreProfile(response.locals.user.id));
};

export const saveMerchantStoreProfile: RequestHandler = async (request, response) => {
  response.json(await updateStoreProfile(response.locals.user.id, readStoreProfileUpdate(request.body)));
};

export const getMerchantStorefront: RequestHandler = async (_request, response) => {
  response.json(await storefrontService.getMerchantStorefront(response.locals.user.id));
};

export const saveMerchantStorefront: RequestHandler = async (request, response) => {
  response.json(await storefrontService.saveConfig(response.locals.user.id, readStorefrontConfig(request.body)));
};

export const getPublicStorefrontBySlug: RequestHandler = async (request, response) => {
  response.json(await storefrontService.getPublicStorefront(typeof request.params.slug === "string" ? request.params.slug : ""));
};
