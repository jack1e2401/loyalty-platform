import { Router } from "express";
import { login, logout, refresh, registerMember } from "./auth.controller.js";

export const authRoutes = Router();
authRoutes.post("/register/member", registerMember);
authRoutes.post("/login", login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", logout);
