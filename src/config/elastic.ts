import { Client } from "@elastic/elasticsearch";
import "dotenv/config";

import fs from "node:fs";

export const client = new Client({
  node: "https://localhost:9200",
  auth: {
    username: process.env.ELASTIC_USERNAME,
    password: process.env.ELASTIC_PASSWORD,
  },
  tls: {
    ca: fs.readFileSync("./http_ca.crt", "utf8"),
    rejectUnauthorized: false,
  },
});
