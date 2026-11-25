import { Router } from "express";
import { authenticate, requireRole } from "../../../middleware/auth.js";
import { getAnalytics, getAnalyticsProductTable } from "./analytics.controller.js";

export const merchantAnalyticsRoutes = Router();
merchantAnalyticsRoutes.use(authenticate, requireRole("MERCHANT"));
merchantAnalyticsRoutes.get("/", getAnalytics);
merchantAnalyticsRoutes.get("/products/:table", getAnalyticsProductTable);
