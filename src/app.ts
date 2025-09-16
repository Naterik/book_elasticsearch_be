import express from "express";
const app = express();
import "dotenv/config";
const port = process.env.PORT;

app.get("/", (req, res) => {
  res.send("Hello World!adfadfádfádf");
});

app.get("/about", (req, res) => {
  res.status(200).json({
    data: "success",
  });
});

app.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
