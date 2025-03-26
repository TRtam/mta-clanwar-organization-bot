import express from "express";
import { client as discordClient } from "../discord";
import toptimeCreateSchema from "./body-validation/toptime-create-schema";
// import onlyLocalhost from "@server/middlewares/only-localhost";

const server = express();
server.use(express.json());
server.use(express.urlencoded({ extended: true }));

server.get("/ping", (_, res) => {
  res.send("pong");
});

server.post(
  "/mitico-bot/toptime-create",
  (req, res, next) => {
    const ip = req.ip?.replace(/^::ffff:/, "");
    const is_localhost = ["127.0.0.1", "::1", "localhost"].includes(ip || "");
    if (!is_localhost) {
      res.status(403).send();
    } else {
      next();
    }
  },
  (req, res) => {
    const body = toptimeCreateSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.errors });
    } else {
      discordClient.emit("ToptimeCreated", body.data);
      res.status(200).send();
    }
  }
);

export default function init() {
  server.listen(process.env.SERVER_PORT, () => {
    console.log(`Server is ready at port ${process.env.SERVER_PORT}`);
  });
}

export { server };
