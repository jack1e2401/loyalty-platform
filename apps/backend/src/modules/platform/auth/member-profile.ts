import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { authenticate, requireRole } from "../../../middleware/auth.js";
import { HttpError } from "../../../lib/http-error.js";

export const memberProfileRoutes = Router();
memberProfileRoutes.use(authenticate, requireRole("MEMBER"));

memberProfileRoutes.get("/profile", async (_request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: response.locals.user.id },
    select: { id: true, email: true, name: true, phone: true, address: true, birthDate: true },
  });
  if (!user) throw new HttpError(404, "MEMBER_NOT_FOUND");
  response.json({ profile: { ...user, birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null } });
});

memberProfileRoutes.patch("/profile", async (request, response) => {
  const body = request.body as Record<string, unknown>;
  const fields = ["name", "phone", "address", "birthDate"] as const;
  if (!body || typeof body !== "object" || Object.keys(body).some((key) => !fields.includes(key as (typeof fields)[number]))) {
    throw new HttpError(400, "INVALID_MEMBER_PROFILE");
  }
  const data: { name?: string | null; phone?: string | null; address?: string | null; birthDate?: Date | null } = {};
  for (const field of fields) {
    const value = body[field];
    if (value === undefined) continue;
    if (value === null || value === "") {
      data[field] = null;
      continue;
    }
    if (typeof value !== "string" || value.length > (field === "address" ? 500 : field === "phone" ? 40 : 191)) {
      throw new HttpError(400, "INVALID_MEMBER_PROFILE");
    }
    if (field === "birthDate") {
      const birthDate = new Date(`${value}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(birthDate.getTime()) || birthDate.toISOString().slice(0, 10) !== value || birthDate > new Date()) throw new HttpError(400, "INVALID_MEMBER_PROFILE");
      data.birthDate = birthDate;
    } else data[field] = value.trim() || null;
  }
  const user = await prisma.user.update({
    where: { id: response.locals.user.id },
    data,
    select: { id: true, email: true, name: true, phone: true, address: true, birthDate: true },
  });
  response.json({ profile: { ...user, birthDate: user.birthDate?.toISOString().slice(0, 10) ?? null } });
});

export const merchantMemberTagRoutes = Router();
merchantMemberTagRoutes.use(authenticate, requireRole("MERCHANT"));
merchantMemberTagRoutes.patch("/:memberId/tags", async (request, response) => {
  const memberId = Number(request.params.memberId);
  const body = request.body as { tags?: unknown };
  if (!Number.isSafeInteger(memberId) || memberId < 1 || !Array.isArray(body?.tags) || body.tags.length > 50 || body.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 64)) {
    throw new HttpError(400, "INVALID_MEMBER_TAGS");
  }
  const merchant = await prisma.merchant.findUnique({ where: { ownerId: response.locals.user.id }, select: { id: true } });
  if (!merchant) throw new HttpError(403, "MERCHANT_REQUIRED");
  const tags = [...new Set((body.tags as string[]).map((tag) => tag.trim()))];
  const result = await prisma.merchantMembership.updateMany({
    where: { merchantId: merchant.id, memberId },
    data: { tags },
  });
  if (result.count === 0) throw new HttpError(404, "MEMBER_NOT_FOUND");
  response.json({ memberId, tags });
});
