import { Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth.js";
import { getMerchantStorefront, saveMerchantStorefront, getMerchantStoreProfile, saveMerchantStoreProfile, getPublicStorefrontBySlug } from "./storefront.controller.js";

export const merchantStorefrontRoutes = Router();
merchantStorefrontRoutes.use(authenticate, requireRole("MERCHANT"));
merchantStorefrontRoutes.get("/", getMerchantStorefront);
merchantStorefrontRoutes.put("/", saveMerchantStorefront);
merchantStorefrontRoutes.get("/profile", getMerchantStoreProfile);
merchantStorefrontRoutes.put("/profile", saveMerchantStoreProfile);
export const publicStorefrontRoutes = Router();
publicStorefrontRoutes.get("/stores/:slug", getPublicStorefrontBySlug);
