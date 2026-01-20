import express from "express";
import http from "http";
const app = express();
import "dotenv/config";
import apiRoutes from "routes/api.routes";
import initData from "configs/seed";
import { initCronJobs } from "./jobs/cron"; // Relative path
import "./config/google";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import loginWithGoogle from "./config/google";
import { initializeWebSocket } from "configs/websocket";

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
const port = process.env.PORT;

apiRoutes(app);

initData();
initCronJobs();

loginWithGoogle();

// Tạo HTTP server cho Socket.IO
const httpServer = http.createServer(app);
initializeWebSocket(httpServer);

httpServer.listen(port, () => {
  return console.log(
    ` ----Express is listening at http://localhost:${port}/api/v1` +
      `-- WebSocket server running on port ${port}`
  );
});
