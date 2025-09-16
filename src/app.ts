import express from "express";
const app = express();
import "dotenv/config";
import apiRoutes from "routes/api";
import initData from "configs/seed";
const port = process.env.PORT;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

apiRoutes(app);

initData();

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
