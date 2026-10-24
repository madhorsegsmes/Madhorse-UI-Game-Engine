import { Router, type IRouter } from "express";
import healthRouter from "./health";
import madBuilderRouter from "./mad-builder";
import multiplayerRouter from "./multiplayer";

const router: IRouter = Router();

router.use(healthRouter);
router.use(madBuilderRouter);
router.use(multiplayerRouter);

export default router;
