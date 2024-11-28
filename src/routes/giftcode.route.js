import { Router } from "express";
import { createGiftcode, deactivateGiftcodes, getGiftcodes, revokeAppUserAccess } from "../controllers/giftcode.controller.js";
import { authMiddleware, doctorAuthMiddleware, verifyMiddleware } from "../shared/middleweres/auth.middlewere.js";

const routes = new Router();
const Path = {
  getcodes: "/",
  createcode: "/create",
  deactivatecode: "/deactivate",
  revokeEntitlement: "/revoke-appuser-raccess",
};

// Auth Token Gateway
routes.use(verifyMiddleware);
routes.use(doctorAuthMiddleware);

routes.get(Path.getcodes, getGiftcodes);
routes.post(Path.createcode, createGiftcode);
routes.post(Path.deactivatecode, deactivateGiftcodes);
routes.post(Path.revokeEntitlement, revokeAppUserAccess);

export default routes;