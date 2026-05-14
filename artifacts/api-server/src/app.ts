import { createRequire } from "node:module";
import type { IncomingMessage, ServerResponse } from "node:http";
import express, { type Express, type RequestHandler } from "express";
import cors from "cors";
import router from "./routes";
import { logger } from "./lib/logger";

type PinoHttpFactory = (options: {
  logger: typeof logger;
  serializers: {
    req: (req: IncomingMessage & { id?: unknown }) => object;
    res: (res: ServerResponse) => object;
  };
}) => RequestHandler;

const require = createRequire(import.meta.url);
const pinoHttp = require("pino-http") as PinoHttpFactory;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

export default app;
