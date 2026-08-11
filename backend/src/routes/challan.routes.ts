import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { listChallans, getChallan, createChallan, confirmChallan, cancelChallan } from "../controllers/challan.controller";

const router = Router();

router.use(authenticate);

router.get("/", listChallans);
router.get("/:id", getChallan);
router.post("/", authorize("ADMIN", "SALES"), createChallan);
router.post("/:id/confirm", authorize("ADMIN", "SALES", "WAREHOUSE"), confirmChallan);
router.post("/:id/cancel", authorize("ADMIN", "SALES"), cancelChallan);

export default router;
