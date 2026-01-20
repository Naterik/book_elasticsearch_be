"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const app = (0, express_1.default)();
require("dotenv/config");
const api_routes_1 = __importDefault(require("routes/api.routes"));
const seed_1 = __importDefault(require("configs/seed"));
const cron_1 = require("./jobs/cron"); // Relative path
require("./config/google");
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const google_1 = __importDefault(require("./config/google"));
const websocket_1 = require("configs/websocket");
app.use((0, cors_1.default)({ origin: "http://localhost:3000", credentials: true }));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(express_1.default.static("public"));
const port = process.env.PORT;
(0, api_routes_1.default)(app);
(0, seed_1.default)();
(0, cron_1.initCronJobs)();
(0, google_1.default)();
// Tạo HTTP server cho Socket.IO
const httpServer = http_1.default.createServer(app);
(0, websocket_1.initializeWebSocket)(httpServer);
httpServer.listen(port, () => {
    return console.log(` ----Express is listening at http://localhost:${port}/api/v1` +
        `-- WebSocket server running on port ${port}`);
});
//# sourceMappingURL=app.js.map