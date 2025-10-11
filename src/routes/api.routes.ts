import express, { Express } from "express";
import verifyValidJWT from "middleware/jwt.middleware";
import publicRouter from "./public.routes";
import privateRouter from "./private.routes";
const router = express.Router();
const apiRoutes = (app: Express) => {
  app.use("/api/v1", publicRouter);

  app.use("/api/v1", verifyValidJWT, privateRouter);
};

export default apiRoutes;
