import { Router, type IRouter } from "express";
import healthRouter from "./health";
import madBuilderRouter from "./mad-builder";

const router: IRouter = Router();

router.use(healthRouter);
router.use(madBuilderRouter);

export default router;
