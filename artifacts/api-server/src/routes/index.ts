import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tokensRouter from "./tokens";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tokensRouter);
router.use(statsRouter);

export default router;
