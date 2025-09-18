import express from "express";
const app = express();
import "dotenv/config";
import apiRoutes from "routes/api";
import initData from "configs/seed";
import cors from "cors";
const port = process.env.PORT;
import { loginWithGoogle } from "configs/google";
// app.use(cors({origin:['http://localhost:3000']}))

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

apiRoutes(app);

initData();

loginWithGoogle();

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}/api/v1`);
});
