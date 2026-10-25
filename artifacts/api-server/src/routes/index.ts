import { Router, type IRouter } from "express";
import healthRouter from "./health";
import madBuilderRouter from "./mad-builder";
import multiplayerRouter from "./multiplayer";
import templateTutorialsRouter from "./template-tutorials";

const router: IRouter = Router();

router.use(healthRouter);
// These fixed system-authored video assets contain no user/project data.
// Register them before Mad Builder's router-wide authentication middleware.
router.use(templateTutorialsRouter);
router.use(madBuilderRouter);
router.use(multiplayerRouter);

export default router;
