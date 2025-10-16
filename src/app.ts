import express from "express";
const app = express();
import "dotenv/config";
import apiRoutes from "routes/api.routes";
import initData from "configs/seed";
import "./config/google";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import loginWithGoogle from "./config/google";

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT;

apiRoutes(app);

initData();

loginWithGoogle();

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}/api/v1`);
});
