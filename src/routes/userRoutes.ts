import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middlewares/authMiddleware";

const router = Router();

router.get("/profile", authMiddleware, (req: AuthRequest, res) => {
  res.status(200).json({
    message: "Protected profile accessed successfully",
    user: req.user,
  });
});

export default router;