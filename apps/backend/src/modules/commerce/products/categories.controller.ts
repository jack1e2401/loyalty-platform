import type { RequestHandler } from "express";
import { HttpError } from "../../../lib/http-error.js";
import { categoriesService } from "./categories.service.js";
import { readCategoryInput, readCategoryPatch } from "./categories.validation.js";
import { readRouteId } from "./products.validation.js";

export const listOwnCategories: RequestHandler = async (request, response) => {
  if (request.query.page !== undefined || request.query.limit !== undefined) {
    const page = readRouteId(request.query.page ?? "1");
    const limit = readRouteId(request.query.limit ?? "20");
    if (page > 1_000_000 || limit > 100) throw new HttpError(400, "INVALID_INPUT");
    response.json(await categoriesService.listOwnCategoriesPage(response.locals.user.id, page, limit));
    return;
  }
  const categories = await categoriesService.listOwnCategories(response.locals.user.id);
  response.json({ categories });
};

export const createCategory: RequestHandler = async (request, response) => {
  const input = readCategoryInput(request.body);
  const category = await categoriesService.createCategory(response.locals.user.id, input);
  response.status(201).json({ category });
};

export const updateCategory: RequestHandler = async (request, response) => {
  const categoryId = readRouteId(request.params.categoryId);
  const patch = readCategoryPatch(request.body);
  const category = await categoriesService.updateCategory(response.locals.user.id, categoryId, patch);
  response.json({ category });
};

export const deleteCategory: RequestHandler = async (request, response) => {
  const categoryId = readRouteId(request.params.categoryId);
  const result = await categoriesService.deleteCategory(response.locals.user.id, categoryId);
  response.json(result);
};
