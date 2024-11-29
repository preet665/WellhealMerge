import { Router } from "express";
import { createGiftcode, deactivateGiftcodes, getGiftcode, getGiftcodes, revokeAppUserAccess } from "../controllers/giftcode.controller.js";
import { authMiddleware, doctorAuthMiddleware, verifyMiddleware } from "../shared/middleweres/auth.middlewere.js";

const routes = new Router();
const Path = {
  getcode: "/:code",
  getcodes: "/",
  createcode: "/create",
  deactivatecode: "/deactivate",
  revokeEntitlement: "/revoke-appuser-access",
};

// Auth Token Gateway
routes.use(verifyMiddleware);
routes.use(doctorAuthMiddleware);

routes.get(Path.getcodes, getGiftcodes);
routes.get(Path.getcode, getGiftcode);
routes.post(Path.createcode, createGiftcode);
routes.post(Path.deactivatecode, deactivateGiftcodes);
routes.post(Path.revokeEntitlement, revokeAppUserAccess);

export default routes;