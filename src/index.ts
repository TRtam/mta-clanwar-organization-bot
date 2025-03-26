require("dotenv").config();
import discordInit from "@discord/index";
import sequelizeInit from "@database/sqlite";
import serverInit from "@server/index";

discordInit();
sequelizeInit();
serverInit();
