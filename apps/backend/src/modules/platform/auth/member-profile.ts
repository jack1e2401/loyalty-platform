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
