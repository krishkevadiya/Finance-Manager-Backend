import { Router } from "express";

import {
  register,
  login,
  getPublicKey,
} from "../controllers/authController";

const router = Router();

router.get(
  "/public-key",
  getPublicKey
);

router.post(
  "/register",
  register
);

router.post(
  "/login",
  login
);

export default router;